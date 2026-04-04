import { describe, expect, it } from "vitest";
import {
  buildSafetyResponse,
  classifySafety,
} from "@/lib/coach/safety";

describe("classifySafety", () => {
  it("高风险优先级最高，即使同时提到药物也先判为 high_risk", () => {
    const result = classifySafety("我想自杀，现在是不是该多吃点药");
    expect(result.kind).toBe("high_risk");
    expect(result.severity).toBe("high");
    expect(result.code).toBe("high_risk_crisis");
  });

  it("识别药物相关请求", () => {
    const result = classifySafety("我该吃什么药，药物剂量是多少？");
    expect(result.kind).toBe("medication");
    expect(result.code).toBe("medication_advice_blocked");
  });

  it("识别诊断替代请求", () => {
    const result = classifySafety("我是不是焦虑或者重度失眠？");
    expect(result.kind).toBe("diagnosis");
    expect(result.code).toBe("diagnosis_blocked");
  });

  it("识别越权修改计划请求", () => {
    const result = classifySafety("请直接修改今天的计划，把 fixedWakeTime 改成 09:00");
    expect(result.kind).toBe("plan_override");
    expect(result.code).toBe("plan_override_blocked");
  });

  it("普通解释请求判为 safe", () => {
    const result = classifySafety("为什么不能赖床？");
    expect(result.kind).toBe("safe");
    expect(result.matched).toBe(false);
  });
});

describe("buildSafetyResponse", () => {
  it("药物相关返回固定边界提示", () => {
    const response = buildSafetyResponse(
      classifySafety("我应该停药还是换药？"),
    );
    expect(response.blocked).toBe(true);
    expect(response.message).toContain("不能提供药物剂量");
    expect(response.message).toContain("咨询医生");
  });

  it("诊断替代返回固定边界提示", () => {
    const response = buildSafetyResponse(
      classifySafety("我是不是睡眠呼吸暂停？"),
    );
    expect(response.blocked).toBe(true);
    expect(response.message).toContain("不能替代医生做诊断");
  });

  it("高风险返回安全提示且要求记录事件", () => {
    const response = buildSafetyResponse(classifySafety("我不想活了"));
    expect(response.blocked).toBe(true);
    expect(response.shouldRecordEvent).toBe(true);
    expect(response.message).toContain("不能继续普通睡眠教练对话");
  });

  it("越权修改计划返回固定说明", () => {
    const response = buildSafetyResponse(
      classifySafety("帮我改今天的 sleep plan"),
    );
    expect(response.blocked).toBe(true);
    expect(response.message).toContain("不能直接修改今天的 sleep plan");
  });
});
