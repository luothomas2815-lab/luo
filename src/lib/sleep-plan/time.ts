/**
 * 计划相关时间工具（单独封装；规则层只用本模块 + diary sleep-metrics 的解析）。
 */

import { parseTimeToMinutes as parseHHMMToMinutes } from "@/lib/diary/sleep-metrics";

export { parseHHMMToMinutes as parseTimeToMinutes };

/** HH:mm → 当日 0:00 起算分钟数 [0, 1440) */
export function formatMinutesAsHHMM(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** 向最近 step 分钟取整 */
export function roundMinutesToNearestStep(
  minutesSinceMidnight: number,
  stepMinutes: number,
): number {
  if (stepMinutes <= 0) return minutesSinceMidnight;
  const m = ((minutesSinceMidnight % 1440) + 1440) % 1440;
  const rounded = Math.round(m / stepMinutes) * stepMinutes;
  return ((rounded % 1440) + 1440) % 1440;
}

/**
 * 从起床时刻向前推 durationMinutes，得到最早上床时刻（仅时钟，跨日回绕）。
 */
export function subtractMinutesFromClockHHMM(
  wakeHHMM: string,
  durationMinutes: number,
): string | null {
  const wake = parseHHMMToMinutes(wakeHHMM);
  if (wake === null || !Number.isFinite(durationMinutes)) return null;
  let bed = wake - durationMinutes;
  bed = ((bed % 1440) + 1440) % 1440;
  return formatMinutesAsHHMM(bed);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 日历日加减天数（本地日历语义，中午锚点避免 DST 边界） */
export function addCalendarDays(isoDate: string, deltaDays: number): string {
  if (!DATE_RE.test(isoDate)) throw new Error("Invalid date string");
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** 含端点的 7 日窗口：[planDate-6, planDate] */
export function sevenDayWindowInclusive(planDate: string): {
  start: string;
  end: string;
} {
  return {
    start: addCalendarDays(planDate, -6),
    end: planDate,
  };
}
