export type CoachMessageRole = "user" | "assistant" | "system";

export type CoachMessageMetadata = Record<string, unknown> | null;

export interface CoachConversationRecord {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachMessageRecord {
  id: string;
  conversation_id: string;
  user_id: string;
  role: CoachMessageRole;
  content: string;
  safety_flag: boolean;
  metadata: CoachMessageMetadata;
  created_at: string;
  updated_at: string;
}

export interface CoachConversationWithMessages extends CoachConversationRecord {
  messages: CoachMessageRecord[];
}
