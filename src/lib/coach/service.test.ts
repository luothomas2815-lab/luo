import OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import type { CoachServiceDependencies } from "@/lib/coach/service";
import { startCoachChat } from "@/lib/coach/service";
import type { CoachPromptContext } from "@/lib/coach/context";
import { isCoachChatError } from "@/lib/coach/coach-chat-error";

function makeDeps(): CoachServiceDependencies {
  return {
    createConversation: vi.fn().mockResolvedValue({
      id: "c1",
      user_id: "u1",
      title: null,
      created_at: "",
      updated_at: "",
    }),
    appendUserMessage: vi.fn().mockResolvedValue({
      id: "u-msg",
      conversation_id: "c1",
      user_id: "u1",
      role: "user",
      content: "hi",
      safety_flag: false,
      metadata: null,
      created_at: "",
      updated_at: "",
    }),
    appendAssistantMessage: vi.fn().mockResolvedValue({
      id: "a-msg",
      conversation_id: "c1",
      user_id: "u1",
      role: "assistant",
      content: "reply",
      safety_flag: false,
      metadata: null,
      created_at: "",
      updated_at: "",
    }),
    classifySafety: vi.fn().mockReturnValue({
      kind: "safe",
      matched: false,
      severity: null,
      code: "ok",
      matchedKeywords: [],
    }),
    buildSafetyResponse: vi.fn().mockReturnValue({
      blocked: false,
      shouldRecordEvent: false,
      message: "",
    }),
    recordSafetyEvent: vi.fn().mockResolvedValue({ ok: true, id: "e1" }),
    buildCoachPromptContext: vi.fn().mockResolvedValue({
      generatedAt: "2026-04-06T00:00:00Z",
      activePlan: {
        status: "available",
        fixedWakeTime: "07:00",
        earliestBedtime: "23:30",
        allowNap: false,
        napLimitMinutes: 20,
        sleepIfNotSleepyAction: "未困不要上床",
        awakeTooLongAction: "先离床",
        notes: "基于最近数据",
      },
      sleepSummary7d: {
        windowStart: "2026-03-31",
        windowEnd: "2026-04-06",
        validEntryCount: 3,
        avgTstMinutes: 390,
        avgTibMinutes: 450,
        avgSleepEfficiencyPercent: 86,
        avgWakeTime: "07:05",
        hasMissingRecentDays: true,
      },
      conversationHistory: [
        {
          role: "user",
          content: "为什么不能赖床？",
          createdAt: "2026-04-06T00:00:00Z",
        },
      ],
    } satisfies CoachPromptContext),
    buildCoachSystemPromptFromContext: vi
      .fn()
      .mockReturnValue("system prompt"),
    buildCoachModelMessages: vi.fn().mockReturnValue([
      { role: "user", content: "为什么不能赖床？" },
    ]),
    streamChatResponse: vi.fn().mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield "你好";
        yield "，这是解释。";
      },
    }),
    logError: vi.fn(),
  };
}

describe("startCoachChat", () => {
  it("正常流程：先存 user，再走 provider，结束后存 assistant", async () => {
    const deps = makeDeps();
    const result = await startCoachChat(
      {
        userId: "u1",
        conversationId: "c1",
        message: "为什么不能赖床？",
        logId: "log-happy",
      },
      deps,
    );

    expect(deps.appendUserMessage).toHaveBeenCalledOnce();
    expect(deps.streamChatResponse).toHaveBeenCalledOnce();
    expect(result.kind).toBe("stream");

    if (result.kind === "stream") {
      const reader = result.stream.getReader();
      const decoder = new TextDecoder();
      let output = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        output += decoder.decode(value);
      }

      expect(output).toBe("你好，这是解释。");
    }

    expect(deps.appendAssistantMessage).toHaveBeenCalledWith(
      "c1",
      "u1",
      "你好，这是解释。",
      false,
      { source: "coach_provider" },
    );
  });

  it("安全优先拦截：保存 user + safety assistant，并记录 event", async () => {
    const deps = makeDeps();
    vi.mocked(deps.classifySafety).mockReturnValue({
      kind: "high_risk",
      matched: true,
      severity: "high",
      code: "high_risk_crisis",
      matchedKeywords: ["不想活了"],
    });
    vi.mocked(deps.buildSafetyResponse).mockReturnValue({
      blocked: true,
      shouldRecordEvent: true,
      message: "安全提示",
    });

    const result = await startCoachChat(
      {
        userId: "u1",
        conversationId: "c1",
        message: "我不想活了",
        logId: "log-safe",
      },
      deps,
    );

    expect(result.kind).toBe("blocked");
    expect(deps.appendUserMessage).toHaveBeenCalledOnce();
    expect(deps.streamChatResponse).not.toHaveBeenCalled();
    expect(deps.appendAssistantMessage).toHaveBeenCalledWith(
      "c1",
      "u1",
      "安全提示",
      true,
      expect.objectContaining({
        source: "coach_safety_guard",
      }),
    );
    expect(deps.recordSafetyEvent).toHaveBeenCalledOnce();
  });

  it("provider 鉴权失败时抛出 CoachChatError（provider_auth）", async () => {
    const deps = makeDeps();
    vi.mocked(deps.streamChatResponse).mockRejectedValue(
      new OpenAI.AuthenticationError(401, undefined, "nope", new Headers()),
    );

    let thrown: unknown;
    try {
      await startCoachChat(
        {
          userId: "u1",
          conversationId: "c1",
          message: "hi",
          logId: "log-401",
        },
        deps,
      );
    } catch (e) {
      thrown = e;
    }
    expect(isCoachChatError(thrown)).toBe(true);
    if (isCoachChatError(thrown)) {
      expect(thrown.code).toBe("provider_auth");
      expect(thrown.logId).toBe("log-401");
    }
  });

  it("流式输出中途失败：reader 收到 stream_interrupted", async () => {
    const deps = makeDeps();
    vi.mocked(deps.streamChatResponse).mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield "a";
        throw new Error("mid-stream");
      },
    });

    const result = await startCoachChat(
      {
        userId: "u1",
        conversationId: "c1",
        message: "hi",
        logId: "log-stream",
      },
      deps,
    );

    expect(result.kind).toBe("stream");
    if (result.kind !== "stream") {
      throw new Error("expected stream");
    }

    const reader = result.stream.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);

    let thrown: unknown;
    try {
      await reader.read();
    } catch (e) {
      thrown = e;
    }
    expect(isCoachChatError(thrown)).toBe(true);
    if (isCoachChatError(thrown)) {
      expect(thrown.code).toBe("stream_interrupted");
      expect(thrown.logId).toBe("log-stream");
    }
  });
});
