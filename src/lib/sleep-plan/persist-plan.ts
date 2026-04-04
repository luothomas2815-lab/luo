/**
 * 将生成结果写入 sleep_plans：先 supersede 当日 active，再插入新 active。
 * 仅依赖 Supabase 客户端类型，不依赖 React。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PersistSleepPlanPayload,
  PersistSleepPlanResult,
} from "@/lib/sleep-plan/types";

/**
 * @param supabase — 已带用户会话的 server client（RLS 生效）
 */
export async function persistSleepPlan(
  supabase: SupabaseClient,
  payload: PersistSleepPlanPayload,
): Promise<PersistSleepPlanResult> {
  const { userId, planDate, sourceWindowStart, sourceWindowEnd, basedOnEntryIds, generated } =
    payload;

  const { error: supErr } = await supabase
    .from("sleep_plans")
    .update({ status: "superseded" })
    .eq("user_id", userId)
    .eq("plan_date", planDate)
    .eq("status", "active");

  if (supErr) {
    return { ok: false, error: supErr.message };
  }

  const { data, error: insErr } = await supabase
    .from("sleep_plans")
    .insert({
      user_id: userId,
      plan_date: planDate,
      source_window_start: sourceWindowStart,
      source_window_end: sourceWindowEnd,
      based_on_entry_count: basedOnEntryIds.length,
      based_on_entry_ids: basedOnEntryIds,
      status: "active",
      fixed_wake_time: generated.fixedWakeTime,
      earliest_bedtime: generated.earliestBedtime,
      allow_nap: generated.allowNap,
      nap_limit_minutes: generated.allowNap ? generated.napLimitMinutes : null,
      sleep_if_not_sleepy_action: generated.sleepIfNotSleepyAction,
      awake_too_long_action: generated.awakeTooLongAction,
      notes: generated.notes,
      rule_version: generated.ruleVersion,
      rule_inputs: generated.ruleInputs,
      rule_outputs: generated.ruleOutputs,
      created_by: "rules_engine",
    })
    .select("id")
    .single();

  if (insErr || !data) {
    return { ok: false, error: insErr?.message ?? "插入失败" };
  }

  return { ok: true, planId: data.id as string };
}
