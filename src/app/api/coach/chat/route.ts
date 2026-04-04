import { getMiniMaxConfig } from "@/lib/ai/config";
import { CoachChatError } from "@/lib/coach/coach-chat-error";
import {
  coachChatErrorFromUnknown,
  coachChatErrorResponse,
} from "@/lib/coach/coach-chat-error-map";
import { startCoachChat } from "@/lib/coach/service";
import { createClient } from "@/lib/supabase/server";

function notPostResponse() {
  const logId = crypto.randomUUID();
  return coachChatErrorResponse(
    new CoachChatError({
      code: "validation",
      userMessage: "此接口仅支持 POST，请使用 POST /api/coach/chat。",
      logId,
      retryable: false,
    }),
    405,
    { Allow: "POST" },
  );
}

export function GET() {
  return notPostResponse();
}

export function PUT() {
  return notPostResponse();
}

export function PATCH() {
  return notPostResponse();
}

export function DELETE() {
  return notPostResponse();
}

type ParsedBody =
  | { ok: true; conversationId: string | null; message: string }
  | { ok: false; error: string };

function parseChatRequestBody(raw: unknown): ParsedBody {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "请求体必须是 JSON 对象" };
  }
  const o = raw as Record<string, unknown>;

  if ("message" in o && typeof o.message !== "string") {
    return { ok: false, error: "message 必须是字符串" };
  }
  if (
    "conversationId" in o &&
    o.conversationId != null &&
    typeof o.conversationId !== "string"
  ) {
    return { ok: false, error: "conversationId 必须是字符串或 null" };
  }

  const message = typeof o.message === "string" ? o.message.trim() : "";
  if (!message) {
    return { ok: false, error: "message 不能为空" };
  }

  const cidRaw = o.conversationId;
  const conversationId =
    cidRaw === undefined || cidRaw === null
      ? null
      : String(cidRaw).trim() || null;

  return { ok: true, conversationId, message };
}

/**
 * 错误响应使用 JSON（application/json），便于前端稳定解析 code / userMessage / logId / retryable，
 * 且与 text/plain 的 stream、blocked 正文区分清楚。
 */
export async function POST(request: Request) {
  const logId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return coachChatErrorResponse(
        new CoachChatError({
          code: "auth",
          userMessage: "请先登录后再使用 AI 教练。",
          logId,
          retryable: false,
        }),
        401,
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return coachChatErrorResponse(
        new CoachChatError({
          code: "validation",
          userMessage: "请求体不是合法 JSON。",
          logId,
          retryable: false,
        }),
        400,
      );
    }

    const parsed = parseChatRequestBody(json);
    if (!parsed.ok) {
      return coachChatErrorResponse(
        new CoachChatError({
          code: "validation",
          userMessage: parsed.error,
          logId,
          retryable: false,
        }),
        400,
      );
    }

    try {
      getMiniMaxConfig();
    } catch (envErr) {
      const mapped = coachChatErrorFromUnknown(logId, envErr);
      const err =
        mapped.code === "config"
          ? mapped
          : new CoachChatError({
              code: "config",
              userMessage: mapped.userMessage,
              logId,
              retryable: false,
              cause: envErr,
            });
      console.error("[api.coach.chat.config]", {
        logId,
        code: err.code,
        cause: err.causeDetail,
      });
      return coachChatErrorResponse(err, 503);
    }

    const result = await startCoachChat({
      userId: user.id,
      conversationId: parsed.conversationId,
      message: parsed.message,
      logId,
    });

    if (result.kind === "blocked") {
      return new Response(result.text, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Conversation-Id": result.conversationId,
          "X-Coach-Response-Mode": "blocked",
          "X-Coach-Log-Id": logId,
        },
      });
    }

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Conversation-Id": result.conversationId,
        "X-Coach-Response-Mode": "stream",
        "X-Coach-Log-Id": logId,
      },
    });
  } catch (error) {
    const err = coachChatErrorFromUnknown(logId, error);
    console.error("[api.coach.chat]", {
      logId: err.logId,
      code: err.code,
      retryable: err.retryable,
      cause: err.causeDetail,
    });
    return coachChatErrorResponse(err, 500);
  }
}
