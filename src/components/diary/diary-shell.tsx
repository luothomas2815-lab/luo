import type { DiaryRow } from "@/app/actions/diary";
import { DiaryChart } from "@/components/diary/diary-chart";
import { DiaryList } from "@/components/diary/diary-list";
import Link from "next/link";

export type DiaryView = "list" | "chart";

export function DiaryShell({
  entries,
  view,
}: {
  entries: DiaryRow[];
  view: DiaryView;
}) {
  return (
    <div className="mx-auto max-w-md px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-900">睡眠日记</h1>
        <Link
          href="/app/diary/new"
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          记一笔
        </Link>
      </div>

      <div className="mb-4 flex rounded-xl border border-zinc-200 bg-white p-1">
        <Link
          href="/app/diary?view=list"
          scroll={false}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-medium ${
            view === "list" ? "bg-zinc-900 text-white" : "text-zinc-600"
          }`}
        >
          列表
        </Link>
        <Link
          href="/app/diary?view=chart"
          scroll={false}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-medium ${
            view === "chart" ? "bg-zinc-900 text-white" : "text-zinc-600"
          }`}
        >
          趋势
        </Link>
      </div>

      {view === "list" ? (
        <DiaryList entries={entries} />
      ) : (
        <DiaryChart entries={entries} />
      )}
    </div>
  );
}
