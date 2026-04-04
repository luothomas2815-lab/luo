/**
 * 用户「今日」日历日（YYYY-MM-DD），用于睡眠计划 plan_date；无业务规则。
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export function formatCalendarDateInTimeZone(
  date: Date,
  timeZone: string,
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** 从 profiles 读时区，缺省 Asia/Shanghai */
export async function getPlanCalendarDateForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  const tz =
    data?.timezone && typeof data.timezone === "string" && data.timezone.length
      ? data.timezone
      : "Asia/Shanghai";

  return formatCalendarDateInTimeZone(new Date(), tz);
}
