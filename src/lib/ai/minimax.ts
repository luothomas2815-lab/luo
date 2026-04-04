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

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

function stripThinkTagsFromText(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "");
}

interface ThinkTagFilter {
  push(chunk: string): string;
  flush(): string;
}

function createThinkTagFilter(): ThinkTagFilter {
  let buffer = "";
  let inThink = false;

  function tryConsumeFromBuffer(): string {
    let output = "";

    while (buffer.length > 0) {
      if (!inThink) {
        const openIdx = buffer.indexOf(THINK_OPEN);
        if (openIdx === -1) {
          const keepTail = Math.max(THINK_OPEN.length - 1, 0);
          if (buffer.length > keepTail) {
            output += buffer.slice(0, buffer.length - keepTail);
            buffer = buffer.slice(buffer.length - keepTail);
          }
          break;
        }

        output += buffer.slice(0, openIdx);
        buffer = buffer.slice(openIdx + THINK_OPEN.length);
        inThink = true;
        continue;
      }

      const closeIdx = buffer.indexOf(THINK_CLOSE);
      if (closeIdx === -1) {
        const keepTail = Math.max(THINK_CLOSE.length - 1, 0);
        if (buffer.length > keepTail) {
          buffer = buffer.slice(buffer.length - keepTail);
        }
        break;
      }

      buffer = buffer.slice(closeIdx + THINK_CLOSE.length);
      inThink = false;
    }

    return output;
  }

  return {
    push(chunk: string): string {
      if (!chunk) return "";
      buffer += chunk;
      return tryConsumeFromBuffer();
    },
    flush(): string {
      if (inThink) {
        buffer = "";
        return "";
      }
      const out = buffer.replace(/<\/?think>/gi, "");
      buffer = "";
      return out;
    },
  };
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
      const filter = createThinkTagFilter();
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (typeof content === "string" && content.length > 0) {
          const cleaned = filter.push(content);
          if (cleaned) {
            yield cleaned;
          }
        }
      }
      const tail = filter.flush();
      if (tail) {
        yield tail;
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

  return stripThinkTagsFromText(output);
}
