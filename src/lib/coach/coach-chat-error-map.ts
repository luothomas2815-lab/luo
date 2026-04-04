import OpenAI from "openai";
import {
  CoachChatError,
  isCoachChatError,
} from "@/lib/coach/coach-chat-error";

function stripSensitiveFragments(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9_-]{8,}/gi, "[已隐藏]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]{12,}/gi, "Bearer [已隐藏]");
}

const CONFIG_HINT =
  "AI 教练所需模型配置异常，请检查环境变量后重试（密钥勿提交仓库）。";

const PROVIDER_AUTH_USER =
  "模型接口鉴权失败：请检查 MINIMAX_API_KEY 是否正确、是否过期，并与所用区域（国内/国际）一致。";

const PROVIDER_NOT_FOUND_USER =
  "模型接口地址不存在：请确认 MINIMAX_BASE_URL 只写到 /v1，且不要拼接 /chat/completions。";

const PROVIDER_NETWORK_USER =
  "无法连接模型服务：请检查网络与 MINIMAX_BASE_URL 是否可达，或稍后重试。";

const UPSTREAM_USER =
  "模型服务暂时异常，请稍后重试。若持续失败，可提供错误编号协助排查。";

const UNKNOWN_USER =
  "AI 教练暂时不可用，请稍后重试。若持续失败，可提供错误编号协助排查。";

function looksLikeConfigError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    message.includes("MINIMAX_") ||
    message.includes("缺少 MINIMAX") ||
    m.includes("minimax_base_url") ||
    m.includes("minimax_model")
  );
}

export function coachChatErrorFromUnknown(
  logId: string,
  error: unknown,
): CoachChatError {
  if (isCoachChatError(error)) {
    return error;
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return new CoachChatError({
      code: "provider_network",
      userMessage: PROVIDER_NETWORK_USER,
      logId,
      retryable: true,
      cause: error,
    });
  }

  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    if (status === 401) {
      return new CoachChatError({
        code: "provider_auth",
        userMessage: PROVIDER_AUTH_USER,
        logId,
        retryable: false,
        cause: error,
      });
    }
    if (status === 404) {
      return new CoachChatError({
        code: "provider_not_found",
        userMessage: PROVIDER_NOT_FOUND_USER,
        logId,
        retryable: false,
        cause: error,
      });
    }
    const msg = stripSensitiveFragments(
      (error.message || "").trim() || "上游接口错误",
    );
    return new CoachChatError({
      code: "upstream",
      userMessage:
        status != null
          ? `模型服务返回错误（${status}）：${msg}`
          : `${UPSTREAM_USER}（${msg}）`,
      logId,
      retryable: status == null || status >= 500,
      cause: error,
    });
  }

  if (error instanceof TypeError) {
    const m = (error.message || "").toLowerCase();
    if (
      m.includes("fetch") ||
      m.includes("network") ||
      m.includes("failed to fetch")
    ) {
      return new CoachChatError({
        code: "provider_network",
        userMessage: PROVIDER_NETWORK_USER,
        logId,
        retryable: true,
        cause: error,
      });
    }
  }

  if (error instanceof Error) {
    const raw = stripSensitiveFragments(error.message.trim());
    if (looksLikeConfigError(raw)) {
      return new CoachChatError({
        code: "config",
        userMessage: CONFIG_HINT,
        logId,
        retryable: false,
        cause: error,
      });
    }
    if (raw) {
      return new CoachChatError({
        code: "unknown",
        userMessage: UNKNOWN_USER,
        logId,
        retryable: true,
        cause: error,
      });
    }
  }

  return new CoachChatError({
    code: "unknown",
    userMessage: UNKNOWN_USER,
    logId,
    retryable: true,
    cause: error,
  });
}

export function coachChatErrorResponse(
  err: CoachChatError,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(err.toJSON()), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Coach-Log-Id": err.logId,
      ...extraHeaders,
    },
  });
}
