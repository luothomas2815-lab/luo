"use client";

import { useState } from "react";

export type CoachConversationSummary = {
  conversationId: string;
  title: string | null;
  updatedAt: string;
};

type CoachHistoryListProps = {
  conversations: CoachConversationSummary[];
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
};

function formatUpdatedAt(iso: string): string {
  const value = iso.replace("T", " ");
  return value.length >= 16 ? value.slice(0, 16) : value;
}

export function CoachHistoryList({
  conversations,
  currentConversationId,
  onSelectConversation,
}: CoachHistoryListProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <aside className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900">历史会话</h2>
        <button
          type="button"
          className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 md:hidden"
          aria-expanded={isMobileOpen}
          aria-controls="coach-history-list-mobile"
          data-testid="coach-history-toggle"
          onClick={() => setIsMobileOpen((v) => !v)}
        >
          {isMobileOpen ? "收起" : "展开"}
        </button>
      </div>

      {conversations.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">暂无历史会话</p>
      ) : null}

      <ul
        id="coach-history-list-mobile"
        className={`${isMobileOpen ? "mt-3 block" : "mt-3 hidden"} md:block`}
        data-mobile-open={isMobileOpen ? "true" : "false"}
      >
        {conversations.map((conversation) => {
          const isActive = conversation.conversationId === currentConversationId;
          return (
            <li key={conversation.conversationId} className="mb-2 last:mb-0">
              <button
                type="button"
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left text-xs",
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
                onClick={() => onSelectConversation(conversation.conversationId)}
                aria-current={isActive ? "page" : undefined}
                data-testid={`coach-history-item-${conversation.conversationId}`}
              >
                <p className="truncate font-medium">
                  {conversation.title?.trim() || "未命名会话"}
                </p>
                <p className={isActive ? "mt-1 text-white/80" : "mt-1 text-zinc-500"}>
                  {formatUpdatedAt(conversation.updatedAt)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
