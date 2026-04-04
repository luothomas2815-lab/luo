import Link from "next/link";
import { getCoachPromptSuggestions } from "./coach-prompt-suggestions";

export type CoachPlanSummary = {
  fixedWakeTime: string | null;
  earliestBedtime: string | null;
  allowNap: boolean | null;
  napLimitMinutes: number | null;
  notes: string | null;
};

type CoachPlanSummaryCardProps = {
  summary: CoachPlanSummary | null;
  onPromptSelect?: (prompt: string) => void;
};

const PLAN_BOUNDARY_TEXT =
  "今日计划由系统根据睡眠日记生成，AI 教练可以帮助解释，但不能直接修改计划。";

export function CoachPlanSummaryCard({
  summary,
  onPromptSelect,
}: CoachPlanSummaryCardProps) {
  const promptSuggestions = getCoachPromptSuggestions(summary);

  if (!summary) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
        <h2 className="text-sm font-medium text-zinc-900">今日计划摘要</h2>
        <p className="mt-2 text-zinc-700">今天还没有可用的睡眠计划。</p>
        <p className="mt-1 text-zinc-600">
          先填写睡眠日记，系统会生成今日计划，再由 AI 教练帮你解释安排原因。
        </p>
        <Link
          href="/app/diary/new"
          className="mt-3 inline-block rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
        >
          先填写睡眠日记
        </Link>
        {onPromptSelect ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {promptSuggestions.map((prompt) => (
              <button
                key={prompt}
                data-testid="coach-prompt-suggestion"
                type="button"
                onClick={() => onPromptSelect(prompt)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
      <h2 className="text-sm font-medium text-zinc-900">今日计划摘要</h2>
      <div className="mt-2 grid grid-cols-1 gap-2 text-zinc-700 sm:grid-cols-2">
        <p>固定起床：{summary.fixedWakeTime ?? "暂无"}</p>
        <p>最早上床：{summary.earliestBedtime ?? "暂无"}</p>
        <p>
          今天能否小睡：
          {summary.allowNap === null ? "暂无" : summary.allowNap ? "允许" : "不建议"}
        </p>
        {summary.allowNap && summary.napLimitMinutes !== null ? (
          <p>小睡上限：{summary.napLimitMinutes} 分钟</p>
        ) : null}
      </div>
      {summary.notes ? (
        <p className="mt-2 text-zinc-700">
          计划说明：<span className="text-zinc-600">{summary.notes}</span>
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {promptSuggestions.map((prompt) => (
          <button
            key={prompt}
            data-testid="coach-prompt-suggestion"
            type="button"
            onClick={() => onPromptSelect?.(prompt)}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
          >
            {prompt}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">{PLAN_BOUNDARY_TEXT}</p>
    </section>
  );
}
