import { createClient } from "@/lib/supabase/server";
import type {
  CoachConversationRecord,
  CoachConversationWithMessages,
  CoachMessageMetadata,
  CoachMessageRecord,
} from "@/lib/coach/types";

function asObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function mapConversationRow(
  row: Record<string, unknown>,
): CoachConversationRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title:
      row.title === null || row.title === undefined ? null : String(row.title),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapMessageRow(row: Record<string, unknown>): CoachMessageRecord {
  const role = row.role;

  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    user_id: String(row.user_id),
    role:
      role === "assistant" || role === "system" ? role : "user",
    content: String(row.content ?? ""),
    safety_flag: Boolean(row.safety_flag),
    metadata: asObjectOrNull(row.metadata),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function buildConversationTitleFromFirstUserMessage(
  content: string,
): string | null {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, 24);
}

export async function createConversation(
  userId: string,
): Promise<CoachConversationRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: userId,
      title: null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "创建会话失败");
  }

  return mapConversationRow(data as Record<string, unknown>);
}

export async function listConversations(
  userId: string,
): Promise<CoachConversationRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    mapConversationRow(row as Record<string, unknown>),
  );
}

export async function getLatestConversation(
  userId: string,
): Promise<CoachConversationRecord | null> {
  const conversations = await listConversations(userId);
  return conversations[0] ?? null;
}

/**
 * 首屏加载「最近一次有活动的会话」：按最后一条消息的创建时间，而不是仅依赖
 * ai_conversations.updated_at（新消息写入后未必更新会话行的 updated_at）。
 */
export async function getLatestConversationWithMessages(
  userId: string,
): Promise<CoachConversationWithMessages | null> {
  const supabase = await createClient();

  const { data: lastMsg, error: msgErr } = await supabase
    .from("ai_messages")
    .select("conversation_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (msgErr) {
    throw new Error(msgErr.message);
  }

  const cid =
    lastMsg && typeof lastMsg === "object" && "conversation_id" in lastMsg
      ? String(lastMsg.conversation_id)
      : null;

  if (cid) {
    return getConversationWithMessages(userId, cid);
  }

  const latest = await getLatestConversation(userId);
  if (!latest) {
    return null;
  }
  return getConversationWithMessages(userId, latest.id);
}

export async function getConversationWithMessages(
  userId: string,
  conversationId: string,
): Promise<CoachConversationWithMessages | null> {
  const supabase = await createClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (conversationError) {
    throw new Error(conversationError.message);
  }
  if (!conversation || typeof conversation !== "object") {
    return null;
  }

  const { data: messages, error: messageError } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (messageError) {
    throw new Error(messageError.message);
  }

  return {
    ...mapConversationRow(conversation as Record<string, unknown>),
    messages: (messages ?? []).map((row) =>
      mapMessageRow(row as Record<string, unknown>),
    ),
  };
}

export async function appendUserMessage(
  conversationId: string,
  userId: string,
  content: string,
  metadata?: CoachMessageMetadata,
): Promise<CoachMessageRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "user",
      content,
      metadata: metadata ?? null,
      safety_flag: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "保存用户消息失败");
  }

  await maybeGenerateConversationTitle(conversationId);

  return mapMessageRow(data as Record<string, unknown>);
}

export async function appendAssistantMessage(
  conversationId: string,
  userId: string,
  content: string,
  safetyFlag = false,
  metadata?: CoachMessageMetadata,
): Promise<CoachMessageRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: "assistant",
      content,
      safety_flag: safetyFlag,
      metadata: metadata ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "保存助手消息失败");
  }

  return mapMessageRow(data as Record<string, unknown>);
}

export async function maybeGenerateConversationTitle(
  conversationId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("ai_conversations")
    .select("id, title")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    throw new Error(conversationError.message);
  }
  if (!conversation || typeof conversation !== "object") {
    return null;
  }
  if (typeof conversation.title === "string" && conversation.title.trim()) {
    return conversation.title.trim();
  }

  const { data: firstUserMessage, error: messageError } = await supabase
    .from("ai_messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (messageError) {
    throw new Error(messageError.message);
  }
  if (!firstUserMessage || typeof firstUserMessage !== "object") {
    return null;
  }

  const title = buildConversationTitleFromFirstUserMessage(
    String(firstUserMessage.content ?? ""),
  );
  if (!title) {
    return null;
  }

  const { error: updateError } = await supabase
    .from("ai_conversations")
    .update({ title })
    .eq("id", conversationId)
    .is("title", null);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return title;
}
