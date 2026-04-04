import type { DiaryRow } from "@/app/actions/diary";
import { formatDurationMinutes } from "@/lib/diary/format";
import { getMetricsFromPayload } from "@/lib/diary/row-metrics";
import Link from "next/link";

export function DiaryList({ entries }: { entries: DiaryRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
        暂无记录。点击下方填写昨晚睡眠，约 1 分钟。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((row) => {
        const m = getMetricsFromPayload(row.payload);
        return (
          <li key={row.id}>
            <Link
              href={`/app/diary/${row.entry_date}/edit`}
              className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 active:bg-zinc-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900">
                  {row.entry_date}
                </span>
                {m ? (
                  <span className="text-xs text-zinc-500">
                    效率 {m.sleepEfficiencyPercent}%
                  </span>
                ) : (
                  <span className="text-xs text-amber-600">数据不完整</span>
                )}
              </div>
              {m ? (
                <div className="flex flex-wrap gap-x-3 text-xs text-zinc-600">
                  <span>在床 {formatDurationMinutes(m.timeInBedMinutes)}</span>
                  <span>
                    估计睡眠 {formatDurationMinutes(m.estimatedNightSleepMinutes)}
                  </span>
                </div>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
