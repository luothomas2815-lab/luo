import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  buildConversationTitleFromFirstUserMessage,
  getLatestConversationWithMessages,
  mapConversationRow,
  mapMessageRow,
} from "@/lib/coach/storage";

describe("mapConversationRow", () => {
  it("映射 ai_conversations 行", () => {
    expect(
      mapConversationRow({
        id: "c1",
        user_id: "u1",
        title: "最近总是半夜醒",
        created_at: "2026-04-06T00:00:00Z",
        updated_at: "2026-04-06T00:00:01Z",
      }),
    ).toEqual({
      id: "c1",
      user_id: "u1",
      title: "最近总是半夜醒",
      created_at: "2026-04-06T00:00:00Z",
      updated_at: "2026-04-06T00:00:01Z",
    });
  });
});

describe("mapMessageRow", () => {
  it("映射 ai_messages 行并保留 safety_flag 与 metadata", () => {
    expect(
      mapMessageRow({
        id: "m1",
        conversation_id: "c1",
        user_id: "u1",
        role: "assistant",
        content: "这是安全提示",
        safety_flag: true,
        metadata: { source: "guard" },
        created_at: "2026-04-06T00:00:00Z",
        updated_at: "2026-04-06T00:00:01Z",
      }),
    ).toEqual({
      id: "m1",
      conversation_id: "c1",
      user_id: "u1",
      role: "assistant",
      content: "这是安全提示",
      safety_flag: true,
      metadata: { source: "guard" },
      created_at: "2026-04-06T00:00:00Z",
      updated_at: "2026-04-06T00:00:01Z",
    });
  });
});

describe("buildConversationTitleFromFirstUserMessage", () => {
  it("根据第一条用户消息生成简短标题", () => {
    const title = buildConversationTitleFromFirstUserMessage(
      "最近三天总是在凌晨两点醒来，然后很难再次入睡",
    );
    expect(title).toBeTruthy();
    expect(title!.length).toBeLessThanOrEqual(24);
  });

  it("空白内容返回 null", () => {
    expect(buildConversationTitleFromFirstUserMessage("   ")).toBeNull();
  });
});

describe("getLatestConversationWithMessages", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
  });

  it("以 ai_messages 中该用户最后一条消息定位会话并拉取历史", async () => {
    let aiMessagesFromCount = 0;
    const row = {
      id: "m1",
      conversation_id: "c-from-msg",
      user_id: "u1",
      role: "user",
      content: "hello",
      safety_flag: false,
      metadata: null,
      created_at: "t",
      updated_at: "t",
    };

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "ai_messages") {
          aiMessagesFromCount += 1;
          if (aiMessagesFromCount === 1) {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: { conversation_id: "c-from-msg" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: vi.fn().mockResolvedValue({
                    data: [row],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "ai_conversations") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "c-from-msg",
                      user_id: "u1",
                      title: null,
                      created_at: "t",
                      updated_at: "t",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as never);

    const result = await getLatestConversationWithMessages("u1");
    expect(result?.id).toBe("c-from-msg");
    expect(result?.messages).toHaveLength(1);
    expect(result?.messages[0]?.content).toBe("hello");
  });

  it("无消息时回退到 listConversations 的第一条会话", async () => {
    let aiMessagesFromCount = 0;
    let aiConversationsFromCount = 0;

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "ai_messages") {
          aiMessagesFromCount += 1;
          if (aiMessagesFromCount === 1) {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "ai_conversations") {
          aiConversationsFromCount += 1;
          if (aiConversationsFromCount === 1) {
            return {
              select: () => ({
                eq: () => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "c-latest",
                        user_id: "u1",
                        title: null,
                        created_at: "t",
                        updated_at: "t",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "c-latest",
                      user_id: "u1",
                      title: null,
                      created_at: "t",
                      updated_at: "t",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as never);

    const result = await getLatestConversationWithMessages("u1");
    expect(result?.id).toBe("c-latest");
    expect(result?.messages).toEqual([]);
  });
});
