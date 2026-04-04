"use client";

const prompts = [
  "为什么我昨晚只睡 5 小时，今天还不能赖床？",
  "今晚我不困，要不要按计划时间上床？",
  "半夜醒来很久睡不着该怎么办？",
  "我白天很困，为什么还不建议补觉？",
];

type CoachSuggestedPromptsProps = {
  onPick: (prompt: string) => Promise<void>;
  disabled?: boolean;
};

export function CoachSuggestedPrompts({
  onPick,
  disabled = false,
}: CoachSuggestedPromptsProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-zinc-900">推荐问题</h2>
      <div className="mt-3 flex flex-col gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => void onPick(prompt)}
            className="rounded-xl border border-zinc-200 px-3 py-3 text-left text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
