export function formatDurationMinutes(m: number): string {
  if (!Number.isFinite(m)) return "—";
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  if (h === 0) return `${mm} 分钟`;
  if (mm === 0) return `${h} 小时`;
  return `${h} 小时 ${mm} 分`;
}

export function formatHoursOneDecimal(h: number): string {
  if (!Number.isFinite(h)) return "—";
  return `${Math.round(h * 10) / 10} 小时`;
}
