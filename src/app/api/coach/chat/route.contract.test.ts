/**
 * /api/coach/chat 契约测试：冻结成功态（blocked / stream）与错误态的 header、Content-Type、JSON 形状。
 * 勿在此处测业务编排；仅测对客户端可见的稳定协议。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/ai/config", () => ({
  getMiniMaxConfig: vi.fn(),
}));

vi.mock("@/lib/coach/service", () => ({
  startCoachChat: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { getMiniMaxConfig } from "@/lib/ai/config";
import { startCoachChat } from "@/lib/coach/service";
import { POST } from "./route";

/** 错误响应体：前后端约定字段，变更须同步客户端 parseCoachChatErrorJson */
type CoachChatErrorBody = {
  code: string;
  userMessage: string;
  logId: string;
  retryable: boolean;
};

async function expectCoachErrorEnvelope(
  res: Response,
  status: number,
): Promise<CoachChatErrorBody> {
  expect(res.status).toBe(status);
  expect(res.headers.get("Content-Type")).toMatch(
    /^application\/json(; charset=utf-8)?$/i,
  );
  const headerLog = res.headers.get("X-Coach-Log-Id");
  expect(headerLog).toBeTruthy();

  const body = JSON.parse(await res.text()) as CoachChatErrorBody;
  expect(typeof body.code).toBe("string");
  expect(body.code.length).toBeGreaterThan(0);
  expect(typeof body.userMessage).toBe("string");
  expect(body.userMessage.trim().length).toBeGreaterThan(0);
  expect(typeof body.logId).toBe("string");
  expect(body.logId).toBe(headerLog);
  expect(typeof body.retryable).toBe("boolean");

  return body;
}

describe("contract: POST /api/coach/chat — blocked", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(getMiniMaxConfig).mockReset();
    vi.mocked(startCoachChat).mockReset();
  });

  it("契约：200 + X-Coach-Response-Mode=blocked + X-Conversation-Id + 纯文本正文", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);
    vi.mocked(getMiniMaxConfig).mockReturnValue({
      apiKey: "k",
      baseURL: "https://api.minimax.io/v1",
      model: "m",
    });

    const blockedText = "契约-fixture：blocked 模式固定正文（安全提示或拦截文案）";
    const conversationId = "contract-conv-blocked-001";

    vi.mocked(startCoachChat).mockResolvedValue({
      kind: "blocked",
      conversationId,
      text: blockedText,
    });

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "trigger-blocked" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Coach-Response-Mode")).toBe("blocked");
    expect(res.headers.get("X-Conversation-Id")).toBe(conversationId);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("X-Coach-Log-Id")).toBeTruthy();

    const bodyText = await res.text();
    expect(bodyText).toBe(blockedText);
    expect(() => JSON.parse(bodyText)).toThrow();
  });
});

describe("contract: POST /api/coach/chat — stream", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(getMiniMaxConfig).mockReset();
    vi.mocked(startCoachChat).mockReset();
  });

  it("契约：200 + X-Coach-Response-Mode=stream + X-Conversation-Id + Content-Type 固定", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);
    vi.mocked(getMiniMaxConfig).mockReturnValue({
      apiKey: "k",
      baseURL: "https://api.minimax.io/v1",
      model: "m",
    });

    const conversationId = "contract-conv-stream-001";
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("chunk-contract"));
        controller.close();
      },
    });

    vi.mocked(startCoachChat).mockResolvedValue({
      kind: "stream",
      conversationId,
      stream,
    });

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Coach-Response-Mode")).toBe("stream");
    expect(res.headers.get("X-Conversation-Id")).toBe(conversationId);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Coach-Log-Id")).toBeTruthy();

    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();
    const dec = new TextDecoder();
    let out = "";
    for (;;) {
      const { done, value } = await reader!.read();
      if (done) break;
      out += dec.decode(value);
    }
    expect(out).toBe("chunk-contract");
  });
});

describe("contract: POST /api/coach/chat — error JSON", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(getMiniMaxConfig).mockReset();
    vi.mocked(startCoachChat).mockReset();
  });

  it("契约：401 返回标准错误信封（userMessage + logId 与 X-Coach-Log-Id 一致）", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "x" }),
      }),
    );

    const body = await expectCoachErrorEnvelope(res, 401);
    expect(body.code).toBe("auth");
    expect(body.userMessage).toBe("请先登录后再使用 AI 教练。");
  });

  it("契约：503 config 仍含四字段且 userMessage 非空", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);
    vi.mocked(getMiniMaxConfig).mockImplementation(() => {
      throw new Error("缺少 MINIMAX_API_KEY");
    });

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "x" }),
      }),
    );

    const body = await expectCoachErrorEnvelope(res, 503);
    expect(body.code).toBe("config");
  });
});
