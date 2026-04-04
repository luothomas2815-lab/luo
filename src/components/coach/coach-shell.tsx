"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CoachHistoryList,
  type CoachConversationSummary,
} from "@/components/coach/coach-history-list";
import { CoachInput } from "@/components/coach/coach-input";
import {
  CoachMessageList,
  type CoachUiMessage,
} from "@/components/coach/coach-message-list";
import {
  CoachPlanSummaryCard,
  type CoachPlanSummary,
} from "@/components/coach/coach-plan-summary-card";
import { CoachSuggestedPrompts } from "@/components/coach/coach-suggested-prompts";
import {
  isCoachChatError,
  parseCoachChatErrorJson,
  STREAM_INTERRUPTED_USER_MESSAGE,
} from "@/lib/coach/coach-chat-error";

type CoachClientError = {
  userMessage: string;
  logId?: string;
  retryable?: boolean;
};

type InitialMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  safetyFlag: boolean;
};

type CoachShellProps = {
  initialConversationId: string | null;
  initialMessages: InitialMessage[];
  initialTitle: string | null;
  initialConversationHistory?: CoachConversationSummary[];
  showPlanSummary?: CoachPlanSummary | null;
};

type ConversationMessageCache = Record<string, CoachUiMessage[]>;

function toUiMessages(messages: InitialMessage[]): CoachUiMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    safetyFlag: message.safetyFlag,
    status: "done",
  }));
}

export function CoachShell({
  initialConversationId,
  initialMessages,
  initialTitle,
  initialConversationHistory = [],
  showPlanSummary = null,
}: CoachShellProps) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [messages, setMessages] = useState<CoachUiMessage[]>(
    toUiMessages(initialMessages),
  );
  const [draftMessage, setDraftMessage] = useState("");
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isConversationLoading, setIsConversationLoading] = useState(false);
  const [error, setError] = useState<CoachClientError | null>(null);
  const [conversationHistory, setConversationHistory] = useState(initialConversationHistory);
  const latestConversationLoadSeqRef = useRef(0);
  const [conversationMessageCache, setConversationMessageCache] =
    useState<ConversationMessageCache>(() => {
      if (!initialConversationId) return {};
      return {
        [initialConversationId]: toUiMessages(initialMessages),
      };
    });

  const isEmpty = messages.length === 0;
  const pageTitle = useMemo(() => {
    const currentTitle = conversationHistory.find(
      (item) => item.conversationId === conversationId,
    )?.title;
    return currentTitle || initialTitle || "AI 睡眠教练";
  }, [conversationHistory, conversationId, initialTitle]);

  function updateHistorySummary(conversationIdValue: string, titleHint?: string) {
    const now = new Date().toISOString();
    setConversationHistory((prev) => {
      const idx = prev.findIndex(
        (item) => item.conversationId === conversationIdValue,
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], updatedAt: now };
        return [updated[idx], ...updated.filter((_, i) => i !== idx)];
      }
      return [
        {
          conversationId: conversationIdValue,
          title: titleHint ?? null,
          updatedAt: now,
        },
        ...prev,
      ];
    });
  }

  async function handleSelectConversation(nextConversationId: string) {
    setConversationId(nextConversationId);
    setDraftMessage("");
    setError(null);
    const cachedMessages = conversationMessageCache[nextConversationId];
    if (cachedMessages) {
      setIsConversationLoading(false);
      setMessages(cachedMessages);
      return;
    }
    const loadSeq = latestConversationLoadSeqRef.current + 1;
    latestConversationLoadSeqRef.current = loadSeq;
    setIsConversationLoading(true);
    setMessages([]);
    try {
      const response = await fetch(
        `/api/coach/conversations/${encodeURIComponent(nextConversationId)}/messages`,
        { method: "GET" },
      );
      if (!response.ok) {
        if (loadSeq !== latestConversationLoadSeqRef.current) {
          // 旧请求已过期：用户已切到更新的目标会话，丢弃该返回结果。
          return;
        }
        setError({
          userMessage: "会话加载失败，请稍后重试。",
          retryable: true,
        });
        return;
      }
      const payload = (await response.json()) as {
        messages?: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          safetyFlag: boolean;
        }>;
      };
      if (loadSeq !== latestConversationLoadSeqRef.current) {
        // 旧请求已过期：用户已切到更新的目标会话，丢弃该返回结果。
        return;
      }
      setMessages(
        (payload.messages ?? []).map((message) => ({
          ...message,
          status: "done" as const,
        })),
      );
      setConversationMessageCache((prev) => ({
        ...prev,
        [nextConversationId]: (payload.messages ?? []).map((message) => ({
          ...message,
          status: "done" as const,
        })),
      }));
    } catch (err) {
      if (loadSeq !== latestConversationLoadSeqRef.current) {
        // 旧请求已过期：用户已切到更新的目标会话，丢弃该返回结果。
        return;
      }
      setError({
        userMessage:
          err instanceof Error ? err.message : "会话加载失败，请稍后重试。",
        retryable: true,
      });
    } finally {
      if (loadSeq === latestConversationLoadSeqRef.current) {
        setIsConversationLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!conversationId) return;
    setConversationMessageCache((prev) => ({
      ...prev,
      [conversationId]: messages,
    }));
  }, [conversationId, messages]);

  async function sendMessage(message: string) {
    const userMessageId = `local-user-${Date.now()}`;
    const assistantMessageId = `local-assistant-${Date.now()}`;

    setError(null);
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: message,
        status: "done",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "streaming",
      },
    ]);

    try {
      const response = await fetch("/api/coach/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      const headerLogId = response.headers.get("X-Coach-Log-Id") ?? undefined;

      if (!response.ok) {
        const errorText = (await response.text()).trim();
        const parsed = parseCoachChatErrorJson(errorText);
        setError(
          parsed
            ? {
                userMessage: parsed.userMessage,
                logId: parsed.logId ?? headerLogId,
                retryable: parsed.retryable,
              }
            : {
                userMessage: errorText || `请求失败（${response.status}）`,
                logId: headerLogId,
                retryable: response.status >= 500,
              },
        );
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: item.content || "回复中断，请重试。",
                  status: "error",
                }
              : item,
          ),
        );
        return;
      }

      const returnedConversationId = response.headers.get("X-Conversation-Id");
      if (returnedConversationId) {
        setConversationId(returnedConversationId);
        updateHistorySummary(returnedConversationId, message.slice(0, 24));
      }

      const mode = response.headers.get("X-Coach-Response-Mode");
      const reader = response.body?.getReader();

      if (!reader) {
        setError({
          userMessage: "未获取到响应流，请稍后重试。",
          logId: headerLogId,
          retryable: true,
        });
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: item.content || "回复中断，请重试。",
                  status: "error",
                }
              : item,
          ),
        );
        return;
      }

      const decoder = new TextDecoder();
      let fullText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantMessageId
                ? {
                    ...item,
                    content: fullText,
                    safetyFlag: mode === "blocked",
                    status: "streaming",
                  }
                : item,
            ),
          );
        }

        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: fullText || "暂无回复内容",
                  safetyFlag: mode === "blocked",
                  status: "done",
                }
              : item,
          ),
        );
      } catch (readErr) {
        if (isCoachChatError(readErr)) {
          setError({
            userMessage: readErr.userMessage,
            logId: readErr.logId,
            retryable: readErr.retryable,
          });
        } else {
          setError({
            userMessage: STREAM_INTERRUPTED_USER_MESSAGE,
            logId: headerLogId,
            retryable: true,
          });
        }
        setMessages((prev) =>
          prev.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: item.content || "回复中断，请重试。",
                  status: "error",
                }
              : item,
          ),
        );
      }
    } catch (err) {
      setError({
        userMessage:
          err instanceof Error
            ? err.message
            : "发送失败，请稍后重试",
        retryable: true,
      });
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: item.content || "回复中断，请重试。",
                status: "error",
              }
            : item,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-4 sm:py-6 md:grid-cols-[240px_minmax(0,1fr)]">
      <CoachHistoryList
        conversations={conversationHistory}
        currentConversationId={conversationId}
        onSelectConversation={(id) => {
          void handleSelectConversation(id);
        }}
      />

      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">{pageTitle}</h1>
            <p className="mt-1 text-sm text-zinc-600">
              可解释计划、说明 CBT-I 原理，并回答操作类问题。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setConversationId(null);
              setMessages([]);
              setDraftMessage("");
              setError(null);
            }}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
          >
            新建会话
          </button>
        </div>
        <CoachPlanSummaryCard
          summary={showPlanSummary}
          onPromptSelect={(prompt) => {
            // 采用覆盖策略：点击建议问题表示用户希望直接改写为该问题，再自行编辑后发送
            setDraftMessage(prompt);
            setFocusRequestKey((k) => k + 1);
          }}
        />

        {isEmpty && !isConversationLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-medium text-zinc-900">欢迎来到 AI 睡眠教练</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              你可以问我为什么要这样安排睡眠计划，或询问常见 CBT-I 原理。我不会修改计划，只会解释。
            </p>
          </div>
        ) : null}

        {isEmpty && !isConversationLoading ? (
          <CoachSuggestedPrompts onPick={sendMessage} disabled={isSending} />
        ) : null}

        {isConversationLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            切换会话加载中...
          </div>
        ) : (
          <CoachMessageList messages={messages} />
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{error.userMessage}</p>
            {error.logId ? (
              <p className="mt-1 text-xs font-mono text-red-600/90">
                错误编号：{error.logId}
              </p>
            ) : null}
          </div>
        ) : null}

        <CoachInput
          onSend={sendMessage}
          disabled={isSending}
          value={draftMessage}
          onValueChange={setDraftMessage}
          focusRequestKey={focusRequestKey}
        />
      </div>
    </div>
  );
}
