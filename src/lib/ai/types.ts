export type AIChatRole = "system" | "user" | "assistant";

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface AIChatRequest {
  systemPrompt?: string | null;
  messages: AIChatMessage[];
  temperature?: number;
}

export type AITextStream = AsyncIterable<string>;

export interface AIProvider {
  streamChatResponse(input: AIChatRequest): Promise<AITextStream>;
  generateChatResponse(input: AIChatRequest): Promise<string>;
}
