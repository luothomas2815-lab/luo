import type { DiaryRow } from "@/app/actions/diary";
import { formatHoursOneDecimal } from "@/lib/diary/format";
import { getMetricsFromPayload } from "@/lib/diary/row-metrics";

const CHART_DAYS = 14;

export function DiaryChart({ entries }: { entries: DiaryRow[] }) {
  const sorted = [...entries]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .slice(-CHART_DAYS);

  const points = sorted
    .map((row) => {
      const m = getMetricsFromPayload(row.payload);
      if (!m) return null;
      return {
        date: row.entry_date.slice(5),
        se: m.sleepEfficiencyPercent,
        tstHours: m.estimatedNightSleepMinutes / 60,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (points.length === 0) {
    return (
      <p className="text-center text-sm text-zinc-500">
        记录达到 1 天后即可查看趋势（近 {CHART_DAYS} 天）。
      </p>
    );
  }

  const maxSe = Math.max(100, ...points.map((p) => p.se));
  const maxTst = Math.max(0.1, ...points.map((p) => p.tstHours));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-600">睡眠效率 %</p>
        <div className="flex h-36 items-end gap-1 border-b border-zinc-200 pb-1">
          {points.map((p) => (
            <div
              key={p.date}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${p.date} ${p.se.toFixed(0)}%`}
            >
              <div
                className="w-full max-w-8 rounded-t bg-zinc-800"
                style={{ height: `${(p.se / maxSe) * 100}%`, minHeight: "4px" }}
              />
              <span className="truncate text-[10px] text-zinc-500">{p.date}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-600">估计夜间睡眠（小时）</p>
        <div className="flex h-36 items-end gap-1 border-b border-zinc-200 pb-1">
          {points.map((p) => (
            <div
              key={p.date}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${p.date} ${formatHoursOneDecimal(p.tstHours)}`}
            >
              <div
                className="w-full max-w-8 rounded-t bg-emerald-700"
                style={{
                  height: `${(p.tstHours / maxTst) * 100}%`,
                  minHeight: "4px",
                }}
              />
              <span className="truncate text-[10px] text-zinc-500">{p.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
