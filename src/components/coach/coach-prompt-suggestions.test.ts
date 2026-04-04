import { describe, expect, it } from "vitest";
import { getCoachPromptSuggestions } from "./coach-prompt-suggestions";

describe("getCoachPromptSuggestions", () => {
  it("allowNap=false 时优先包含不建议补觉问题", () => {
    const prompts = getCoachPromptSuggestions({
      fixedWakeTime: null,
      earliestBedtime: null,
      allowNap: false,
      napLimitMinutes: null,
      notes: null,
    });

    expect(prompts).toContain("为什么今天不建议补觉？");
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
  });

  it("allowNap=true 且 napLimitMinutes 有值时包含小睡上限问题", () => {
    const prompts = getCoachPromptSuggestions({
      fixedWakeTime: null,
      earliestBedtime: null,
      allowNap: true,
      napLimitMinutes: 20,
      notes: null,
    });

    expect(prompts).toContain("今天可以小睡多久？为什么只能这么久？");
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
  });

  it("earliestBedtime 与 fixedWakeTime 存在时包含对应问题", () => {
    const prompts = getCoachPromptSuggestions({
      fixedWakeTime: "07:00",
      earliestBedtime: "23:30",
      allowNap: null,
      napLimitMinutes: null,
      notes: null,
    });

    expect(prompts).toContain("为什么今晚最早上床时间是这个？");
    expect(prompts).toContain("为什么今天要固定这个起床时间？");
  });

  it("notes 提示有限数据时包含有限数据问题", () => {
    const prompts = getCoachPromptSuggestions({
      fixedWakeTime: null,
      earliestBedtime: null,
      allowNap: null,
      napLimitMinutes: null,
      notes: "本计划基于有限数据生成，后续会继续校准。",
    });

    expect(prompts).toContain("为什么今天的计划是基于有限数据生成的？");
  });

  it("无 plan 时返回降级通用问题", () => {
    const prompts = getCoachPromptSuggestions(null);

    expect(prompts).toEqual([
      "我现在先做什么，才能尽快生成今日计划？",
      "今天没有计划时，我该怎么安排作息？",
    ]);
  });
});
