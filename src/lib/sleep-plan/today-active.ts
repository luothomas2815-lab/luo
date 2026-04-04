import { createClient } from "@/lib/supabase/server";
import { getPlanCalendarDateForUser } from "@/lib/sleep-plan/calendar-today";
import { fetchActiveSleepPlan } from "@/lib/sleep-plan/db";
import type { SleepPlanRecord } from "@/lib/sleep-plan/types";

export type TodayActiveSleepPlanResult = {
  planDate: string;
  data: SleepPlanRecord | null;
  error: string | null;
};

/**
 * 只读：获取当前用户「今天」的 active 计划。
 * 不触发规则引擎，不创建/修改计划。
 */
export async function getTodayActiveSleepPlan(
  userId: string,
): Promise<TodayActiveSleepPlanResult> {
  const supabase = await createClient();
  const planDate = await getPlanCalendarDateForUser(supabase, userId);
  const result = await fetchActiveSleepPlan(supabase, userId, planDate);

  return {
    planDate,
    data: result.data,
    error: result.error,
  };
}
