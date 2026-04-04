import { afterEach, describe, expect, it, vi } from "vitest";
import { getMiniMaxConfig } from "./config";

describe("getMiniMaxConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("缺少 API Key 时抛出可读错误", () => {
    vi.stubEnv("MINIMAX_API_KEY", "");
    expect(() => getMiniMaxConfig()).toThrow(/MINIMAX_API_KEY/);
  });

  it("MINIMAX_BASE_URL 包含 chat/completions 时拒绝", () => {
    vi.stubEnv("MINIMAX_API_KEY", "test-key");
    vi.stubEnv(
      "MINIMAX_BASE_URL",
      "https://example.com/v1/chat/completions",
    );
    expect(() => getMiniMaxConfig()).toThrow(/不要包含/);
  });

  it("MINIMAX_MODEL 显式为空字符串时拒绝", () => {
    vi.stubEnv("MINIMAX_API_KEY", "test-key");
    vi.stubEnv("MINIMAX_MODEL", "");
    expect(() => getMiniMaxConfig()).toThrow(/MINIMAX_MODEL/);
  });

  it("未设置 MINIMAX_MODEL 时使用默认模型", () => {
    vi.stubEnv("MINIMAX_API_KEY", "test-key");
    Reflect.deleteProperty(process.env, "MINIMAX_MODEL");
    const c = getMiniMaxConfig();
    expect(c.model).toBe("M2-her");
  });
});
