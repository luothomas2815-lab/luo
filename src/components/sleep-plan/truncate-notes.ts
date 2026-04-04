/** 首页卡片用简短 notes（非规则，纯展示） */
export function truncateForCardNotes(text: string | null, maxChars = 120): string {
  if (!text) return "";
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1)}…`;
}
