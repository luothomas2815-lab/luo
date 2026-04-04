"use client";

type CoachMessageItemProps = {
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "error" | "done";
  safetyFlag?: boolean;
};

export function CoachMessageItem({
  role,
  content,
  status = "done",
  safetyFlag = false,
}: CoachMessageItemProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-zinc-900 text-white"
            : safetyFlag
              ? "border border-amber-200 bg-amber-50 text-amber-950"
              : "border border-zinc-200 bg-white text-zinc-900",
          status === "error" ? "border-red-300 bg-red-50 text-red-800" : "",
        ].join(" ")}
      >
        {!isUser ? (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {safetyFlag ? "安全提示" : "AI 教练"}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap break-words">
          {content || (status === "streaming" ? "正在回复..." : "")}
        </p>
        {status === "error" ? (
          <p className="mt-2 text-[11px] text-red-700">回复中断，请重试。</p>
        ) : null}
      </div>
    </div>
  );
}
