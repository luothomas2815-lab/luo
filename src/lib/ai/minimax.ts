import OpenAI from "openai";
import { getMiniMaxConfig } from "@/lib/ai/config";
import type { AIChatRequest, AITextStream } from "@/lib/ai/types";

function createMiniMaxClient() {
  const config = getMiniMaxConfig();

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

function toOpenAIMessages(input: AIChatRequest) {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  if (input.systemPrompt?.trim()) {
    messages.push({
      role: "system",
      content: input.systemPrompt.trim(),
    });
  }

  for (const message of input.messages) {
    messages.push({
      role: message.role,
      content: message.content,
    });
  }

  return messages;
}

export async function streamMiniMaxChatResponse(
  input: AIChatRequest,
): Promise<AITextStream> {
  const client = createMiniMaxClient();
  const { model } = getMiniMaxConfig();

  const stream = await client.chat.completions.create({
    model,
    messages: toOpenAIMessages(input),
    temperature: input.temperature,
    stream: true,
  });

  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (typeof content === "string" && content.length > 0) {
          yield content;
        }
      }
    },
  };
}

export async function generateMiniMaxChatResponse(
  input: AIChatRequest,
): Promise<string> {
  const stream = await streamMiniMaxChatResponse(input);
  let output = "";

  for await (const chunk of stream) {
    output += chunk;
  }

  return output;
}
