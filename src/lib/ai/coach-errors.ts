import OpenAI from "openai";

function stripSensitiveFragments(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9_-]{8,}/gi, "[已隐藏]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]{12,}/gi, "Bearer [已隐藏]");
}

/**
 * 将底层 provider / 网络错误整理为可展示给前端的简短说明（不含密钥）。
 */
export function toCoachProviderClientMessage(error: unknown): string {
  if (error instanceof OpenAI.APIConnectionError) {
    return "无法连接模型服务：请检查网络、MINIMAX_BASE_URL 是否可达，或稍后重试。";
  }

  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    if (status === 401) {
      return "模型接口鉴权失败（401）：请检查 MINIMAX_API_KEY 是否填对、是否已过期，或是否与环境（国内/国际）匹配。";
    }
    if (status === 404) {
      return "模型接口地址不存在（404）：请检查 MINIMAX_BASE_URL 是否只写到 /v1，且不要拼接 /chat/completions。";
    }
    const msg = stripSensitiveFragments(
      (error.message || "").trim() || "上游接口错误",
    );
    if (status != null) {
      return `模型接口返回错误（${status}）：${msg}`;
    }
    return `模型接口错误：${msg}`;
  }

  if (error instanceof TypeError) {
    const m = (error.message || "").toLowerCase();
    if (
      m.includes("fetch") ||
      m.includes("network") ||
      m.includes("failed to fetch")
    ) {
      return "无法连接模型服务：请检查网络、MINIMAX_BASE_URL 是否可达，或稍后重试。";
    }
  }

  if (error instanceof Error) {
    const raw = stripSensitiveFragments(error.message.trim());
    const alreadyFriendly =
      raw.startsWith("缺少 ") ||
      raw.startsWith("MINIMAX_") ||
      raw.includes("MINIMAX_BASE_URL");
    if (alreadyFriendly) {
      return raw;
    }
    return raw || "未知错误";
  }

  return "AI 教练服务暂时不可用";
}
