import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { toCoachProviderClientMessage } from "./coach-errors";

describe("toCoachProviderClientMessage", () => {
  it("401 给出鉴权相关说明", () => {
    const err = new OpenAI.AuthenticationError(
      401,
      undefined,
      "Invalid API key",
      new Headers(),
    );
    const text = toCoachProviderClientMessage(err);
    expect(text).toContain("401");
    expect(text).toContain("MINIMAX_API_KEY");
  });

  it("404 提示检查 BASE_URL", () => {
    const err = new OpenAI.NotFoundError(
      404,
      undefined,
      "Not found",
      new Headers(),
    );
    const text = toCoachProviderClientMessage(err);
    expect(text).toContain("404");
    expect(text).toContain("MINIMAX_BASE_URL");
  });

  it("屏蔽消息中的疑似密钥片段", () => {
    const err = new Error("failed sk-1234567890abcdef_suffix");
    const text = toCoachProviderClientMessage(err);
    expect(text).toContain("[已隐藏]");
    expect(text).not.toContain("sk-1234567890abcdef");
  });

  it("网络类 TypeError 使用可读说明", () => {
    const err = new TypeError("Failed to fetch");
    expect(toCoachProviderClientMessage(err)).toContain("无法连接模型服务");
  });

  it("APIConnectionError 使用连接类说明", () => {
    const err = new OpenAI.APIConnectionError({ message: "Connection refused" });
    expect(toCoachProviderClientMessage(err)).toContain("无法连接模型服务");
  });
});
