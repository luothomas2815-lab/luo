import { describe, expect, it } from "vitest";
import {
  buildCoachSystemPrompt,
  COACH_SYSTEM_PROMPT_TEMPLATE,
} from "@/lib/coach/system-prompt";

describe("COACH_SYSTEM_PROMPT_TEMPLATE", () => {
  it("包含睡眠教练角色与硬性边界", () => {
    expect(COACH_SYSTEM_PROMPT_TEMPLATE).toContain("你是“睡眠教练”");
    expect(COACH_SYSTEM_PROMPT_TEMPLATE).toContain("修改 sleep plan");
    expect(COACH_SYSTEM_PROMPT_TEMPLATE).toContain("给药物建议");
    expect(COACH_SYSTEM_PROMPT_TEMPLATE).toContain("长度约束");
    expect(COACH_SYSTEM_PROMPT_TEMPLATE).toContain("120-220 字");
    expect(COACH_SYSTEM_PROMPT_TEMPLATE).toContain("不要机械重复“不能修改”");
  });
});

describe("buildCoachSystemPrompt", () => {
  it("能注入 activePlan、sleepSummary 与 conversationHistory", () => {
    const prompt = buildCoachSystemPrompt({
      activePlan: "fixedWakeTime: 07:00",
      sleepSummary: "最近 7 天平均 TST 6.5 小时",
      conversationHistory: "用户：为什么不能赖床？",
    });

    expect(prompt).toContain("fixedWakeTime: 07:00");
    expect(prompt).toContain("最近 7 天平均 TST 6.5 小时");
    expect(prompt).toContain("用户：为什么不能赖床？");
  });

  it("缺省时使用保守占位文案", () => {
    const prompt = buildCoachSystemPrompt();
    expect(prompt).toContain("暂无 active sleep plan。");
    expect(prompt).toContain("暂无最近 7 天睡眠摘要。");
    expect(prompt).toContain("暂无历史对话。");
  });
});
