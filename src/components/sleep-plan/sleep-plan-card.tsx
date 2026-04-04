import Link from "next/link";

export type SleepPlanCardProps = {
  planDateLabel: string;
  fixedWakeTime: string;
  earliestBedtime: string;
  allowNap: boolean;
  napLimitMinutes: number | null;
  sleepIfNotSleepyAction: string;
  awakeTooLongAction: string;
  notesShort: string;
};

export function SleepPlanCard({
  planDateLabel,
  fixedWakeTime,
  earliestBedtime,
  allowNap,
  napLimitMinutes,
  sleepIfNotSleepyAction,
  awakeTooLongAction,
  notesShort,
}: SleepPlanCardProps) {
  const napLine = allowNap
    ? napLimitMinutes != null
      ? `允许小睡，不超过 ${napLimitMinutes} 分钟/天`
      : "允许小睡"
    : "本周计划不建议小睡（依据睡眠效率规则）";

  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="today-sleep-plan-heading"
    >
      <div className="flex items-start justify-between gap-2">
        <h2
          id="today-sleep-plan-heading"
          className="text-base font-semibold text-zinc-900"
        >
          今日睡眠计划
        </h2>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">
          {planDateLabel}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between gap-4 border-b border-zinc-100 pb-3">
          <dt className="text-zinc-500">固定起床</dt>
          <dd className="font-medium tabular-nums text-zinc-900">{fixedWakeTime}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-zinc-100 pb-3">
          <dt className="text-zinc-500">建议最早卧床</dt>
          <dd className="font-medium tabular-nums text-zinc-900">
            {earliestBedtime}
          </dd>
        </div>
        <div className="border-b border-zinc-100 pb-3">
          <dt className="text-zinc-500">小睡</dt>
          <dd className="mt-1 font-medium text-zinc-900">{napLine}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2 rounded-xl bg-zinc-50 px-3 py-3 text-sm leading-relaxed text-zinc-800">
        <p>{sleepIfNotSleepyAction}</p>
        <p>{awakeTooLongAction}</p>
      </div>

      {notesShort ? (
        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-zinc-500">
          {notesShort}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/app/diary"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 active:bg-zinc-50"
        >
          去填写睡眠日记
        </Link>
        <Link
          href="/app/coach"
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white active:bg-zinc-800"
        >
          问 AI 教练
        </Link>
      </div>
    </section>
  );
}
