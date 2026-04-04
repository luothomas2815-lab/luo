/** 本地日历 YYYY-MM-DD */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 「昨晚」对应日期：相对今天的本地昨天 */
export function yesterdayLocalDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return formatLocalDate(d);
}
