import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import {
  CoachChatError,
  STREAM_INTERRUPTED_USER_MESSAGE,
} from "./coach-chat-error";
import { coachChatErrorFromUnknown } from "./coach-chat-error-map";

describe("coachChatErrorFromUnknown", () => {
  it("config：MINIMAX 相关文案映射为 config", () => {
    const err = coachChatErrorFromUnknown(
      "log-1",
      new Error("缺少 MINIMAX_API_KEY：请配置"),
    );
    expect(err.code).toBe("config");
    expect(err.logId).toBe("log-1");
    expect(err.retryable).toBe(false);
    expect(err.userMessage).toContain("配置");
  });

  it("provider 401 → provider_auth", () => {
    const err = coachChatErrorFromUnknown(
      "log-2",
      new OpenAI.AuthenticationError(401, undefined, "bad", new Headers()),
    );
    expect(err.code).toBe("provider_auth");
    expect(err.retryable).toBe(false);
  });

  it("provider 404 → provider_not_found", () => {
    const err = coachChatErrorFromUnknown(
      "log-3",
      new OpenAI.NotFoundError(404, undefined, "nf", new Headers()),
    );
    expect(err.code).toBe("provider_not_found");
    expect(err.retryable).toBe(false);
  });

  it("stream_interrupted：由 CoachChatError 固定构造", () => {
    const err = new CoachChatError({
      code: "stream_interrupted",
      userMessage: STREAM_INTERRUPTED_USER_MESSAGE,
      logId: "log-s",
      retryable: true,
      cause: new Error("boom"),
    });
    expect(err.toJSON()).toEqual({
      code: "stream_interrupted",
      userMessage: STREAM_INTERRUPTED_USER_MESSAGE,
      logId: "log-s",
      retryable: true,
    });
    expect(coachChatErrorFromUnknown("x", err)).toBe(err);
  });

  it("unknown：普通 Error 不暴露原始文案", () => {
    const err = coachChatErrorFromUnknown(
      "log-u",
      new Error("internal postgres detail"),
    );
    expect(err.code).toBe("unknown");
    expect(err.userMessage).not.toContain("postgres");
    expect(err.retryable).toBe(true);
  });
});
