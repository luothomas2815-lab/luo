import { describe, expect, it } from "vitest";
import {
  clamp,
  formatMinutesAsHHMM,
  roundMinutesToNearestStep,
} from "@/lib/sleep-plan/time";

describe("roundMinutesToNearestStep — 起床时间向最近 15 分钟取整", () => {
  it("整分已对齐 15 则不变", () => {
    expect(roundMinutesToNearestStep(7 * 60, 15)).toBe(7 * 60);
  });

  it("平均 7:07:30 等价分钟向最近 15 分取整（与规则中 round 一致）", () => {
    const avgMinutes = 7 * 60 + 7.5;
    expect(roundMinutesToNearestStep(avgMinutes, 15)).toBe(7 * 60 + 15);
  });

  it("接近下一档时进位", () => {
    expect(roundMinutesToNearestStep(7 * 60 + 8, 15)).toBe(7 * 60 + 15);
  });
});

describe("clamp + formatMinutesAsHHMM", () => {
  it("clamp 边界", () => {
    expect(clamp(100, 360, 480)).toBe(360);
    expect(clamp(500, 360, 480)).toBe(480);
    expect(clamp(400, 360, 480)).toBe(400);
  });

  it("formatMinutesAsHHMM 输出 HH:mm", () => {
    expect(formatMinutesAsHHMM(420)).toBe("07:00");
    expect(formatMinutesAsHHMM(0)).toBe("00:00");
  });
});
