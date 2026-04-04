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
import { GET, POST } from "./route";

describe("/api/coach/chat", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    vi.mocked(getMiniMaxConfig).mockReset();
    vi.mocked(startCoachChat).mockReset();
  });

  it("GET 返回 405 与 JSON 错误体", async () => {
    const res = GET();
    expect(res.status).toBe(405);
    const body = JSON.parse(await res.text()) as {
      code: string;
      userMessage: string;
      logId: string;
      retryable: boolean;
    };
    expect(body.code).toBe("validation");
    expect(body.userMessage).toContain("POST");
    expect(body.logId).toBeTruthy();
    expect(typeof body.retryable).toBe("boolean");
    expect(res.headers.get("Allow")).toBe("POST");
  });

  it("未登录返回 401 与统一 JSON", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      }),
    );
    expect(res.status).toBe(401);
    const body = JSON.parse(await res.text()) as { code: string; logId: string };
    expect(body.code).toBe("auth");
    expect(body.logId).toBeTruthy();
    expect(res.headers.get("X-Coach-Log-Id")).toBe(body.logId);
  });

  it("非法 JSON 返回 400", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
    const body = JSON.parse(await res.text()) as { code: string };
    expect(body.code).toBe("validation");
  });

  it("message 非字符串返回 400", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: 123 }),
      }),
    );
    expect(res.status).toBe(400);
    const body = JSON.parse(await res.text()) as { code: string };
    expect(body.code).toBe("validation");
  });

  it("配置缺失返回 503（config，不进入编排）", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
    } as never);
    vi.mocked(getMiniMaxConfig).mockImplementation(() => {
      throw new Error("缺少 MINIMAX_API_KEY：请配置");
    });

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      }),
    );
    expect(res.status).toBe(503);
    const body = JSON.parse(await res.text()) as { code: string; userMessage: string };
    expect(body.code).toBe("config");
    expect(body.userMessage).toBeTruthy();
    expect(vi.mocked(startCoachChat)).not.toHaveBeenCalled();
  });

  it("正常请求仍调用 startCoachChat 并下发 X-Coach-Log-Id", async () => {
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

    const stream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    vi.mocked(startCoachChat).mockResolvedValue({
      kind: "stream",
      conversationId: "c1",
      stream,
    });

    const res = await POST(
      new Request("http://localhost/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Coach-Response-Mode")).toBe("stream");
    const logHeader = res.headers.get("X-Coach-Log-Id");
    expect(logHeader).toBeTruthy();

    expect(vi.mocked(startCoachChat)).toHaveBeenCalledWith({
      userId: "u1",
      conversationId: null,
      message: "hello",
      logId: logHeader,
    });
  });
});
