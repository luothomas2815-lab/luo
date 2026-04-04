import type { AIProvider, AIChatRequest, AITextStream } from "@/lib/ai/types";
import {
  generateMiniMaxChatResponse,
  streamMiniMaxChatResponse,
} from "@/lib/ai/minimax";

const provider: AIProvider = {
  async streamChatResponse(input: AIChatRequest): Promise<AITextStream> {
    return streamMiniMaxChatResponse(input);
  },
  async generateChatResponse(input: AIChatRequest): Promise<string> {
    return generateMiniMaxChatResponse(input);
  },
};

export async function streamChatResponse(
  input: AIChatRequest,
): Promise<AITextStream> {
  return provider.streamChatResponse(input);
}

export async function generateChatResponse(
  input: AIChatRequest,
): Promise<string> {
  return provider.generateChatResponse(input);
}
