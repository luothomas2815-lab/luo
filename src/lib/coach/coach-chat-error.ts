export type CoachChatErrorCode =
  | "auth"
  | "validation"
  | "config"
  | "provider_auth"
  | "provider_not_found"
  | "provider_network"
  | "upstream"
  | "stream_interrupted"
  | "unknown";

export type CoachChatErrorJson = {
  code: CoachChatErrorCode;
  userMessage: string;
  logId: string;
  retryable: boolean;
};

export class CoachChatError extends Error {
  readonly code: CoachChatErrorCode;
  readonly userMessage: string;
  readonly logId: string;
  readonly retryable: boolean;
  readonly causeDetail?: unknown;

  constructor(params: {
    code: CoachChatErrorCode;
    userMessage: string;
    logId: string;
    retryable: boolean;
    cause?: unknown;
  }) {
    super(params.userMessage);
    this.name = "CoachChatError";
    this.code = params.code;
    this.userMessage = params.userMessage;
    this.logId = params.logId;
    this.retryable = params.retryable;
    this.causeDetail = params.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): CoachChatErrorJson {
    return {
      code: this.code,
      userMessage: this.userMessage,
      logId: this.logId,
      retryable: this.retryable,
    };
  }
}

export function isCoachChatError(e: unknown): e is CoachChatError {
  return e instanceof CoachChatError;
}

/** 流式输出中途失败时，客户端可展示的固定文案（配合响应头 X-Coach-Log-Id） */
export const STREAM_INTERRUPTED_USER_MESSAGE =
  "生成回复时中断，请稍后重试。若多次出现，可把错误编号提供给支持侧协助排查。";

export function parseCoachChatErrorJson(
  raw: string,
): CoachChatErrorJson | null {
  try {
    const o = JSON.parse(raw) as CoachChatErrorJson;
    if (
      o &&
      typeof o.code === "string" &&
      typeof o.userMessage === "string" &&
      typeof o.logId === "string" &&
      typeof o.retryable === "boolean"
    ) {
      return o;
    }
  } catch {
    /* ignore */
  }
  return null;
}
