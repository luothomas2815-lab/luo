"use client";

import { CoachMessageItem } from "@/components/coach/coach-message-item";

export type CoachUiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  safetyFlag?: boolean;
  status?: "streaming" | "error" | "done";
};

type CoachMessageListProps = {
  messages: CoachUiMessage[];
};

export function CoachMessageList({ messages }: CoachMessageListProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      {messages.length === 0 ? (
        <div className="flex h-full min-h-40 items-center justify-center text-center text-sm text-zinc-500">
          开始提问后，这里会显示你与 AI 教练的对话。
        </div>
      ) : (
        messages.map((message) => (
          <CoachMessageItem
            key={message.id}
            role={message.role}
            content={message.content}
            safetyFlag={message.safetyFlag}
            status={message.status}
          />
        ))
      )}
    </div>
  );
}
