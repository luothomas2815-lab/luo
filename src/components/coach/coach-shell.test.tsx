import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CoachChatError,
  STREAM_INTERRUPTED_USER_MESSAGE,
} from "@/lib/coach/coach-chat-error";
import { CoachShell } from "./coach-shell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function streamResponse(
  chunks: string[],
  mode: "stream" | "blocked",
  conversationId = "c1",
  logId = "log-fixture-1",
) {
  const enc = new TextEncoder();
  return {
    ok: true,
    headers: new Headers({
      "X-Conversation-Id": conversationId,
      "X-Coach-Response-Mode": mode,
      "X-Coach-Log-Id": logId,
    }),
    body: new ReadableStream({
      start(controller) {
        for (const c of chunks) {
          controller.enqueue(enc.encode(c));
        }
        controller.close();
      },
    }),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  };
}

describe("CoachShell", () => {
  it("历史会话列表可见，切换后消息与高亮更新，且草稿会清空", async () => {
    const user = userEvent.setup();
    let resolveSwitchLoad!: () => void;
    const switchLoad = new Promise<void>((resolve) => {
      resolveSwitchLoad = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/coach/conversations/c2/messages")) {
        await switchLoad;
        return jsonResponse({
          conversationId: "c2",
          messages: [
            {
              id: "m2",
              role: "assistant",
              content: "会话二-消息",
              safetyFlag: false,
            },
          ],
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal(
      "fetch",
      fetchMock,
    );
    render(
      <CoachShell
        initialConversationId="c1"
        initialTitle="会话一"
        initialMessages={[
          {
            id: "m1",
            role: "user",
            content: "会话一-消息",
            safetyFlag: false,
          },
        ]}
        initialConversationHistory={[
          {
            conversationId: "c1",
            title: "会话一",
            updatedAt: "2026-04-04T10:00:00Z",
          },
          {
            conversationId: "c2",
            title: "会话二",
            updatedAt: "2026-04-04T09:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("coach-history-item-c1")).toBeInTheDocument();
    expect(screen.getByTestId("coach-history-item-c2")).toBeInTheDocument();
    expect(screen.getByText("会话一-消息")).toBeInTheDocument();
    expect(screen.queryByText("会话二-消息")).not.toBeInTheDocument();

    const input = screen.getByRole("textbox");
    await user.type(input, "待发送草稿");
    expect(input).toHaveValue("待发送草稿");

    const secondConversationButton = screen.getByTestId("coach-history-item-c2");
    await user.click(secondConversationButton);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/coach/conversations/c2/messages",
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.getByText("切换会话加载中...")).toBeInTheDocument();

    resolveSwitchLoad();

    await waitFor(() => {
      expect(screen.getByText("会话二-消息")).toBeInTheDocument();
    });
    expect(screen.queryByText("会话一-消息")).not.toBeInTheDocument();
    expect(secondConversationButton).toHaveAttribute("aria-current", "page");
    expect(input).toHaveValue("");
  });

  it("第二次切回同一会话命中缓存，不重复请求", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/coach/conversations/c2/messages")) {
        return jsonResponse({
          conversationId: "c2",
          messages: [
            {
              id: "m2",
              role: "assistant",
              content: "会话二-消息",
              safetyFlag: false,
            },
          ],
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId="c1"
        initialTitle="会话一"
        initialMessages={[
          {
            id: "m1",
            role: "user",
            content: "会话一-消息",
            safetyFlag: false,
          },
        ]}
        initialConversationHistory={[
          {
            conversationId: "c1",
            title: "会话一",
            updatedAt: "2026-04-04T10:00:00Z",
          },
          {
            conversationId: "c2",
            title: "会话二",
            updatedAt: "2026-04-04T09:00:00Z",
          },
        ]}
      />,
    );

    await user.click(screen.getByTestId("coach-history-item-c2"));
    await waitFor(() => {
      expect(screen.getByText("会话二-消息")).toBeInTheDocument();
    });
    await user.click(screen.getByTestId("coach-history-item-c1"));
    expect(screen.getByText("会话一-消息")).toBeInTheDocument();
    await user.click(screen.getByTestId("coach-history-item-c2"));
    expect(screen.getByText("会话二-消息")).toBeInTheDocument();
    expect(screen.queryByText("切换会话加载中...")).not.toBeInTheDocument();

    const loadCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/coach/conversations/c2/messages"),
    );
    expect(loadCalls).toHaveLength(1);
  });

  it("快速切换 A->B->C 时，旧请求不会覆盖最后目标会话", async () => {
    const user = userEvent.setup();
    let resolveC2!: () => void;
    let resolveC3!: () => void;
    const c2Gate = new Promise<void>((resolve) => {
      resolveC2 = resolve;
    });
    const c3Gate = new Promise<void>((resolve) => {
      resolveC3 = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/coach/conversations/c2/messages")) {
        await c2Gate;
        return jsonResponse({
          conversationId: "c2",
          messages: [
            {
              id: "m-c2",
              role: "assistant",
              content: "会话二-消息",
              safetyFlag: false,
            },
          ],
        });
      }
      if (url.includes("/api/coach/conversations/c3/messages")) {
        await c3Gate;
        return jsonResponse({
          conversationId: "c3",
          messages: [
            {
              id: "m-c3",
              role: "assistant",
              content: "会话三-消息",
              safetyFlag: false,
            },
          ],
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId="c1"
        initialTitle="会话一"
        initialMessages={[
          {
            id: "m-c1",
            role: "user",
            content: "会话一-消息",
            safetyFlag: false,
          },
        ]}
        initialConversationHistory={[
          {
            conversationId: "c1",
            title: "会话一",
            updatedAt: "2026-04-04T10:00:00Z",
          },
          {
            conversationId: "c2",
            title: "会话二",
            updatedAt: "2026-04-04T09:00:00Z",
          },
          {
            conversationId: "c3",
            title: "会话三",
            updatedAt: "2026-04-04T08:00:00Z",
          },
        ]}
      />,
    );

    await user.click(screen.getByTestId("coach-history-item-c2"));
    await user.click(screen.getByTestId("coach-history-item-c3"));
    expect(screen.getByText("切换会话加载中...")).toBeInTheDocument();

    resolveC3();
    await waitFor(() => {
      expect(screen.getByText("会话三-消息")).toBeInTheDocument();
    });
    expect(screen.getByTestId("coach-history-item-c3")).toHaveAttribute(
      "aria-current",
      "page",
    );

    resolveC2();
    await waitFor(() => {
      expect(screen.queryByText("切换会话加载中...")).not.toBeInTheDocument();
    });
    expect(screen.getByText("会话三-消息")).toBeInTheDocument();
    expect(screen.queryByText("会话二-消息")).not.toBeInTheDocument();
  });

  it("切换历史会话后发送，conversationId 会更新为所选会话", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(
      (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/coach/conversations/c2/messages")) {
          return Promise.resolve(
            jsonResponse({
              conversationId: "c2",
              messages: [],
            }),
          );
        }
        return Promise.resolve(streamResponse(["ok"], "stream"));
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId="c1"
        initialTitle="会话一"
        initialMessages={[]}
        initialConversationHistory={[
          {
            conversationId: "c1",
            title: "会话一",
            updatedAt: "2026-04-04T10:00:00Z",
          },
          {
            conversationId: "c2",
            title: "会话二",
            updatedAt: "2026-04-04T09:00:00Z",
          },
        ]}
      />,
    );

    await user.click(screen.getByTestId("coach-history-item-c2"));
    await user.type(screen.getByRole("textbox"), "切换后发送");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const chatCall = fetchMock.mock.calls.find(
      (call) => call[0] === "/api/coach/chat",
    ) as [string, RequestInit] | undefined;
    expect(chatCall).toBeDefined();
    const [, init] = chatCall as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.conversationId).toBe("c2");
  });

  it("当前会话发送消息后会同步更新缓存，切走再切回不会回退旧内容", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/coach/conversations/c2/messages")) {
        return Promise.resolve(
          jsonResponse({
            conversationId: "c2",
            messages: [
              {
                id: "c2-old",
                role: "assistant",
                content: "会话二-旧消息",
                safetyFlag: false,
              },
            ],
          }),
        );
      }
      return Promise.resolve(streamResponse(["新回复"], "stream", "c2"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId="c1"
        initialTitle="会话一"
        initialMessages={[
          {
            id: "c1-m1",
            role: "user",
            content: "会话一-消息",
            safetyFlag: false,
          },
        ]}
        initialConversationHistory={[
          {
            conversationId: "c1",
            title: "会话一",
            updatedAt: "2026-04-04T10:00:00Z",
          },
          {
            conversationId: "c2",
            title: "会话二",
            updatedAt: "2026-04-04T09:00:00Z",
          },
        ]}
      />,
    );

    await user.click(screen.getByTestId("coach-history-item-c2"));
    await waitFor(() => {
      expect(screen.getByText("会话二-旧消息")).toBeInTheDocument();
    });

    await user.type(screen.getByRole("textbox"), "在 c2 发送");
    await user.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => {
      expect(screen.getByText("新回复")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("coach-history-item-c1"));
    await user.click(screen.getByTestId("coach-history-item-c2"));

    expect(screen.getByText("在 c2 发送")).toBeInTheDocument();
    expect(screen.getByText("新回复")).toBeInTheDocument();
    const loadCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes("/api/coach/conversations/c2/messages"),
    );
    expect(loadCalls).toHaveLength(1);
  });

  it("移动端折叠按钮可展开历史会话列表", async () => {
    const user = userEvent.setup();
    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
        initialConversationHistory={[]}
      />,
    );

    const toggle = screen.getByTestId("coach-history-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("有 active plan 时卡片展示两条计划相关提示；点击后填入、聚焦且不自动发送", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
        showPlanSummary={{
          fixedWakeTime: "07:00",
          earliestBedtime: "23:30",
          allowNap: false,
          napLimitMinutes: null,
          notes: null,
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "为什么今天不建议补觉？" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "为什么今晚最早上床时间是这个？" }),
    ).toBeInTheDocument();

    const input = screen.getByRole("textbox");
    await user.type(input, "原有草稿");
    await user.click(screen.getByRole("button", { name: "为什么今天不建议补觉？" }));

    expect(input).toHaveValue("为什么今天不建议补觉？");
    expect(input).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("无 active plan 时展示降级提示问题；点击后填入输入框且不自动发送", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
        showPlanSummary={null}
      />,
    );

    const downgrade =
      "我现在先做什么，才能尽快生成今日计划？";
    expect(screen.getByRole("button", { name: downgrade })).toBeInTheDocument();

    const input = screen.getByRole("textbox");
    await user.click(screen.getByRole("button", { name: downgrade }));

    expect(input).toHaveValue(downgrade);
    expect(input).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("手动输入后点击发送仍会走原有发送逻辑", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(streamResponse(["ok"], "stream")),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "手动输入的问题");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.message).toBe("手动输入的问题");
  });

  it("空会话显示欢迎区与推荐问题", () => {
    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /欢迎来到 AI 睡眠教练/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "推荐问题" })).toBeInTheDocument();
  });

  it("从服务端带入的最近会话消息会出现在列表中（恢复逻辑在服务端；此处测展示）", () => {
    render(
      <CoachShell
        initialConversationId="c-restore"
        initialMessages={[
          {
            id: "m1",
            role: "user",
            content: "server-restored-turn",
            safetyFlag: false,
          },
        ]}
        initialTitle="历史会话"
      />,
    );

    expect(screen.getByText("server-restored-turn")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /欢迎来到 AI 睡眠教练/ }),
    ).not.toBeInTheDocument();
  });

  it("点击推荐问题会向 /api/coach/chat 发起 POST（fetch 为 mock）", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(streamResponse(["done"], "stream")),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /为什么我昨晚只睡 5 小时/ }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/coach/chat",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.message).toContain("5 小时");
  });

  it("stream 模式下助手内容随分片累积（mock 流）", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(streamResponse(["hel", "lo"], "stream")),
      ),
    );

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /半夜醒来很久睡不着/ }));

    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });
  });

  it("blocked 模式下助手气泡使用安全提示样式", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(streamResponse(["请关注安全"], "blocked")),
      ),
    );

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /为什么我昨晚只睡 5 小时/ }));

    await waitFor(() => {
      expect(screen.getByText("安全提示")).toBeInTheDocument();
      expect(screen.getByText("请关注安全")).toBeInTheDocument();
    });
  });

  it("新建会话会清空本地消息并回到欢迎区", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(streamResponse(["reply"], "stream")),
      ),
    );

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /为什么我昨晚只睡 5 小时/ }));
    await waitFor(() => {
      expect(screen.getByText("reply")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "新建会话" }));

    expect(
      screen.getByRole("heading", { name: /欢迎来到 AI 睡眠教练/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("reply")).not.toBeInTheDocument();
  });

  it("500 时解析 JSON 错误体并展示 userMessage 与错误编号", async () => {
    const user = userEvent.setup();
    const payload = {
      code: "unknown" as const,
      userMessage:
        "AI 教练暂时不可用，请稍后重试。若持续失败，可提供错误编号协助排查。",
      logId: "log-500-test",
      retryable: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "X-Coach-Log-Id": "log-500-test" }),
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /为什么我昨晚只睡 5 小时/ }));

    await waitFor(() => {
      expect(screen.getByText(payload.userMessage)).toBeInTheDocument();
      expect(screen.getByText(/错误编号：log-500-test/)).toBeInTheDocument();
    });
  });

  it("流式响应中断时展示 STREAM 说明与错误编号", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          "X-Conversation-Id": "c1",
          "X-Coach-Response-Mode": "stream",
          "X-Coach-Log-Id": "log-stream-client",
        }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("x"));
            controller.error(
              new CoachChatError({
                code: "stream_interrupted",
                userMessage: STREAM_INTERRUPTED_USER_MESSAGE,
                logId: "log-stream-client",
                retryable: true,
              }),
            );
          },
        }),
      }),
    );

    render(
      <CoachShell
        initialConversationId={null}
        initialMessages={[]}
        initialTitle={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /为什么我昨晚只睡 5 小时/ }));

    await waitFor(() => {
      expect(screen.getByText(STREAM_INTERRUPTED_USER_MESSAGE)).toBeInTheDocument();
      expect(screen.getByText(/错误编号：log-stream-client/)).toBeInTheDocument();
    });
  });
});
