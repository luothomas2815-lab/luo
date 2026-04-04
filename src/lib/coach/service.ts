"use server";

import { streamChatResponse } from "@/lib/ai/provider";
import type { AITextStream } from "@/lib/ai/types";
import { buildCoachPromptContext } from "@/lib/coach/context";
import { CoachChatError, STREAM_INTERRUPTED_USER_MESSAGE } from "@/lib/coach/coach-chat-error";
import { coachChatErrorFromUnknown } from "@/lib/coach/coach-chat-error-map";
import {
  appendAssistantMessage,
  appendUserMessage,
  createConversation,
} from "@/lib/coach/storage";
import {
  buildSafetyResponse,
  classifySafety,
  recordSafetyEvent,
} from "@/lib/coach/safety";
import {
  buildCoachModelMessages,
  buildCoachSystemPromptFromContext,
} from "@/lib/coach/system-prompt";

export interface CoachChatInput {
  userId: string;
  conversationId?: string | null;
  message: string;
  logId: string;
}

export type CoachChatResult =
  | {
      kind: "blocked";
      conversationId: string;
      text: string;
    }
  | {
      kind: "stream";
      conversationId: string;
      stream: ReadableStream<Uint8Array>;
    };

export interface CoachServiceDependencies {
  createConversation: typeof createConversation;
  appendUserMessage: typeof appendUserMessage;
  appendAssistantMessage: typeof appendAssistantMessage;
  classifySafety: typeof classifySafety;
  buildSafetyResponse: typeof buildSafetyResponse;
  recordSafetyEvent: typeof recordSafetyEvent;
  buildCoachPromptContext: typeof buildCoachPromptContext;
  buildCoachSystemPromptFromContext: typeof buildCoachSystemPromptFromContext;
  buildCoachModelMessages: typeof buildCoachModelMessages;
  streamChatResponse: typeof streamChatResponse;
  logError: typeof console.error;
}

const defaultDependencies: CoachServiceDependencies = {
  createConversation,
  appendUserMessage,
  appendAssistantMessage,
  classifySafety,
  buildSafetyResponse,
  recordSafetyEvent,
  buildCoachPromptContext,
  buildCoachSystemPromptFromContext,
  buildCoachModelMessages,
  streamChatResponse,
  logError: console.error,
};

async function resolveConversationId(
  userId: string,
  conversationId: string | null | undefined,
  deps: CoachServiceDependencies,
): Promise<string> {
  if (conversationId?.trim()) {
    return conversationId.trim();
  }

  const conversation = await deps.createConversation(userId);
  return conversation.id;
}

const UPSTREAM_USER_MESSAGE =
  "暂时无法完成对话处理，请稍后再试。若持续失败，可提供错误编号协助排查。";

export async function startCoachChat(
  input: CoachChatInput,
  deps: CoachServiceDependencies = defaultDependencies,
): Promise<CoachChatResult> {
  const { logId } = input;

  let conversationId: string;
  try {
    conversationId = await resolveConversationId(
      input.userId,
      input.conversationId,
      deps,
    );

    await deps.appendUserMessage(
      conversationId,
      input.userId,
      input.message,
      { source: "coach_chat" },
    );
  } catch (error) {
    deps.logError("[coach.service.persistence_failed]", {
      logId,
      userId: input.userId,
      phase: "user_message",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new CoachChatError({
      code: "upstream",
      userMessage: UPSTREAM_USER_MESSAGE,
      logId,
      retryable: true,
      cause: error,
    });
  }

  const classification = deps.classifySafety(input.message);
  const safetyResponse = deps.buildSafetyResponse(classification);

  if (classification.matched && safetyResponse.blocked) {
    await deps.appendAssistantMessage(
      conversationId,
      input.userId,
      safetyResponse.message,
      true,
      {
        source: "coach_safety_guard",
        classificationCode: classification.code,
      },
    );

    if (safetyResponse.shouldRecordEvent) {
      await deps.recordSafetyEvent({
        userId: input.userId,
        message: input.message,
        classification,
        metadata: {
          conversationId,
        },
      });
    }

    return {
      kind: "blocked",
      conversationId,
      text: safetyResponse.message,
    };
  }

  let context: Awaited<ReturnType<typeof buildCoachPromptContext>>;
  let systemPrompt: string;
  let messages: ReturnType<typeof buildCoachModelMessages>;

  try {
    context = await deps.buildCoachPromptContext(input.userId, {
      conversationId,
      maxHistoryTurns: 6,
    });
    systemPrompt = deps.buildCoachSystemPromptFromContext(context);
    messages = deps.buildCoachModelMessages(context);
  } catch (error) {
    deps.logError("[coach.service.context_failed]", {
      logId,
      conversationId,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new CoachChatError({
      code: "upstream",
      userMessage: UPSTREAM_USER_MESSAGE,
      logId,
      retryable: true,
      cause: error,
    });
  }

  let providerStream: AITextStream;
  try {
    providerStream = await deps.streamChatResponse({
      systemPrompt,
      messages,
    });
  } catch (error) {
    const mapped = coachChatErrorFromUnknown(logId, error);
    deps.logError("[coach.service.provider_failed]", {
      logId,
      conversationId,
      userId: input.userId,
      code: mapped.code,
      retryable: mapped.retryable,
      providerMessage: error instanceof Error ? error.message : String(error),
    });
    throw mapped;
  }

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of providerStream) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        if (fullText.trim()) {
          await deps.appendAssistantMessage(
            conversationId,
            input.userId,
            fullText,
            false,
            { source: "coach_provider" },
          );
        }

        controller.close();
      } catch (error) {
        const chatErr = new CoachChatError({
          code: "stream_interrupted",
          userMessage: STREAM_INTERRUPTED_USER_MESSAGE,
          logId,
          retryable: true,
          cause: error,
        });
        deps.logError("[coach.service.stream_failed]", {
          logId,
          conversationId,
          userId: input.userId,
          code: chatErr.code,
          retryable: chatErr.retryable,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          generatedLength: fullText.length,
        });
        controller.error(chatErr);
      }
    },
    cancel(reason) {
      deps.logError("[coach.service.stream_cancelled]", {
        logId,
        conversationId,
        userId: input.userId,
        error:
          reason instanceof Error ? reason.message : String(reason ?? "cancelled"),
        generatedLength: fullText.length,
      });
    },
  });

  return {
    kind: "stream",
    conversationId,
    stream,
  };
}
