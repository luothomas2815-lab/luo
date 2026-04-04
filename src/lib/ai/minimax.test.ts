import { describe, expect, it, vi } from "vitest";
import { generateMiniMaxChatResponse, streamMiniMaxChatResponse } from "@/lib/ai/minimax";

const createMock = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("openai", () => {
  function OpenAIMock() {
    return {
      chat: {
        completions: {
          create: createMock.create,
        },
      },
    };
  }
  return {
    default: vi.fn(OpenAIMock),
  };
});

vi.mock("@/lib/ai/config", () => ({
  getMiniMaxConfig: vi.fn().mockReturnValue({
    apiKey: "test-key",
    baseURL: "https://api.minimax.io/v1",
    model: "M2-her",
  }),
}));

function makeChunk(content: string) {
  return { choices: [{ delta: { content } }] };
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const chunk of stream) {
    text += chunk;
  }
  return text;
}

describe("minimax think-tag filtering", () => {
  it("stream 模式会移除完整 <think> 段", async () => {
    async function* fakeStream() {
      yield makeChunk("你好");
      yield makeChunk("<think>内部推理</think>");
      yield makeChunk("世界");
    }
    createMock.create.mockResolvedValue(fakeStream());

    const stream = await streamMiniMaxChatResponse({
      messages: [{ role: "user", content: "hi" }],
    });

    await expect(collect(stream)).resolves.toBe("你好世界");
  });

  it("stream 模式支持跨 chunk 的 think 标签", async () => {
    async function* fakeStream() {
      yield makeChunk("A<th");
      yield makeChunk("ink>hidden");
      yield makeChunk("</th");
      yield makeChunk("ink>B");
    }
    createMock.create.mockResolvedValue(fakeStream());

    const stream = await streamMiniMaxChatResponse({
      messages: [{ role: "user", content: "hi" }],
    });

    await expect(collect(stream)).resolves.toBe("AB");
  });

  it("generate 模式同样不返回 think 内容", async () => {
    async function* fakeStream() {
      yield makeChunk("<think>plan</think>最终答案");
    }
    createMock.create.mockResolvedValue(fakeStream());

    const text = await generateMiniMaxChatResponse({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(text).toBe("最终答案");
  });
});
