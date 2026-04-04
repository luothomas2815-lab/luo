import { describe, expect, it, vi } from "vitest";
import {
  generateMiniMaxChatResponse,
  streamMiniMaxChatResponse,
} from "@/lib/ai/minimax";
import {
  generateChatResponse,
  streamChatResponse,
} from "@/lib/ai/provider";

vi.mock("@/lib/ai/minimax", () => ({
  streamMiniMaxChatResponse: vi.fn(),
  generateMiniMaxChatResponse: vi.fn(),
}));

describe("ai.provider", () => {
  it("streamChatResponse 通过 MiniMax 适配层输出流", async () => {
    async function* fakeStream() {
      yield "hello";
      yield " world";
    }

    vi.mocked(streamMiniMaxChatResponse).mockResolvedValue(fakeStream());

    const stream = await streamChatResponse({
      systemPrompt: "sys",
      messages: [{ role: "user", content: "hi" }],
    });

    let output = "";
    for await (const chunk of stream) {
      output += chunk;
    }

    expect(output).toBe("hello world");
    expect(streamMiniMaxChatResponse).toHaveBeenCalledOnce();
  });

  it("generateChatResponse 通过 MiniMax 适配层返回完整文本", async () => {
    vi.mocked(generateMiniMaxChatResponse).mockResolvedValue("final answer");

    const result = await generateChatResponse({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result).toBe("final answer");
    expect(generateMiniMaxChatResponse).toHaveBeenCalledOnce();
  });
});
