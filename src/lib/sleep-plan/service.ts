/**
 * 页面与 Route Handler 应使用的入口：获取或创建当日 active 睡眠计划。
 * 勿在 page.tsx 中拼接规则逻辑。
 */

import { createClient } from "@/lib/supabase/server";
import {
  fetchActiveSleepPlan,
  fetchSleepPlanById,
} from "@/lib/sleep-plan/db";
import { generateSleepPlan } from "@/lib/sleep-plan/generate-plan";
import { persistSleepPlan } from "@/lib/sleep-plan/persist-plan";
import type { DiaryEntryForPlan } from "@/lib/sleep-plan/types";
import type { GetOrCreateSleepPlanResult } from "@/lib/sleep-plan/types";
import { sevenDayWindowInclusive } from "@/lib/sleep-plan/time";

/**
 * 读取某用户某日的 active 计划；若不存在则基于最近 7 天日记生成并持久化。
 * 第一版：日记变更后不会自动重算（需后续任务显式触发或次日再请求）。
 */
export async function getOrCreateActiveSleepPlanForDate(
  planDate: string,
  options: { onboardingDefaultWakeTime?: string | null } = {},
): Promise<GetOrCreateSleepPlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: "未登录",
      stage: "auth",
    };
  }

  const existing = await fetchActiveSleepPlan(supabase, user.id, planDate);
  if (existing.error) {
    return {
      ok: false,
      error: existing.error,
      stage: "fetch_plan",
    };
  }
  if (existing.data) {
    return {
      ok: true,
      source: "existing",
      plan: existing.data,
    };
  }

  const { start, end } = sevenDayWindowInclusive(planDate);

  const { data: rows, error: diaryErr } = await supabase
    .from("sleep_diary_entries")
    .select("id, entry_date, payload")
    .eq("user_id", user.id)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true });

  if (diaryErr) {
    return {
      ok: false,
      error: diaryErr.message,
      stage: "fetch_diary",
    };
  }

  const diaryEntries: DiaryEntryForPlan[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    entry_date: r.entry_date as string,
    payload: r.payload,
  }));

  const generated = generateSleepPlan({
    planDate,
    diaryEntries,
    onboardingDefaultWakeTime:
      options.onboardingDefaultWakeTime ?? null,
  });

  const persisted = await persistSleepPlan(supabase, {
    userId: user.id,
    planDate,
    sourceWindowStart: start,
    sourceWindowEnd: end,
    basedOnEntryIds: diaryEntries.map((e) => e.id),
    generated,
  });

  if (!persisted.ok) {
    return {
      ok: false,
      error: persisted.error,
      stage: "persist",
    };
  }

  const created = await fetchSleepPlanById(supabase, persisted.planId);
  if (created.error || !created.data) {
    return {
      ok: false,
      error: created.error ?? "无法读取刚创建的计划",
      stage: "fetch_created",
    };
  }

  return {
    ok: true,
    source: "created",
    plan: created.data,
  };
}
