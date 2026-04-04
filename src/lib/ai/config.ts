export interface MiniMaxConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

function normalizeBaseURL(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("MINIMAX_BASE_URL 不能为空");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      "MINIMAX_BASE_URL 不是合法地址，例如 https://api.minimax.io/v1 或 https://api.minimaxi.com/v1",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("MINIMAX_BASE_URL 需为 http(s) 地址");
  }
  const pathLower = url.pathname.toLowerCase();
  if (pathLower.includes("chat/completions")) {
    throw new Error(
      "MINIMAX_BASE_URL 只需基地址（通常到 /v1），不要包含 /chat/completions",
    );
  }
  return trimmed;
}

function resolveModel(): string {
  const hasEnv = Object.prototype.hasOwnProperty.call(
    process.env,
    "MINIMAX_MODEL",
  );
  if (!hasEnv) {
    return "M2-her";
  }
  const model = process.env.MINIMAX_MODEL?.trim() ?? "";
  if (!model) {
    throw new Error(
      "MINIMAX_MODEL 已设置但为空：请填写模型名，或从环境中删除该变量以使用默认模型",
    );
  }
  return model;
}

export function getMiniMaxConfig(): MiniMaxConfig {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  const baseEnv = process.env.MINIMAX_BASE_URL?.trim();
  const baseURL = baseEnv
    ? normalizeBaseURL(baseEnv)
    : normalizeBaseURL("https://api.minimax.io/v1");
  const model = resolveModel();

  if (!apiKey) {
    throw new Error(
      "缺少 MINIMAX_API_KEY：请在环境变量中配置后重试（勿提交到仓库）",
    );
  }

  return {
    apiKey,
    baseURL,
    model,
  };
}
