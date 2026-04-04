import { describe, expect, it } from "vitest";
import {
  computeNightSleepMetrics,
  minutesBetweenCrossNight,
  parseTimeToMinutes,
} from "./sleep-metrics";

describe("parseTimeToMinutes", () => {
  it("解析合法 HH:mm", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(23 * 60 + 59);
    expect(parseTimeToMinutes("07:30")).toBe(7 * 60 + 30);
  });

  it("非法格式返回 null", () => {
    expect(parseTimeToMinutes("7:30")).toBeNull();
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("abc")).toBeNull();
  });
});

describe("minutesBetweenCrossNight", () => {
  it("同日 end 晚于 start", () => {
    expect(minutesBetweenCrossNight("22:00", "23:00")).toBe(60);
  });

  it("跨午夜：起床在次日清晨", () => {
    expect(minutesBetweenCrossNight("23:00", "07:00")).toBe(8 * 60);
    expect(minutesBetweenCrossNight("22:30", "06:00")).toBe(7 * 60 + 30);
  });

  it("起止相同为 0（视为无效过短）", () => {
    expect(minutesBetweenCrossNight("08:00", "08:00")).toBe(0);
  });
});

describe("computeNightSleepMetrics", () => {
  it("典型一夜：8h 在床，潜伏期 20min，夜醒 40min → 约 7h 睡眠，效率约 87.5%", () => {
    const m = computeNightSleepMetrics({
      lightsOutTime: "23:00",
      outOfBedTime: "07:00",
      sleepOnsetLatencyMin: 20,
      nightWakeDurationMin: 40,
      daytimeNapMin: 0,
    });
    expect(m).not.toBeNull();
    expect(m!.timeInBedMinutes).toBe(8 * 60);
    expect(m!.estimatedNightSleepMinutes).toBe(8 * 60 - 20 - 40);
    expect(m!.sleepEfficiencyPercent).toBeCloseTo((420 / 480) * 100, 1);
    expect(m!.totalSleepMinutesIncludingNap).toBe(8 * 60 - 20 - 40);
  });

  it("TST 下限为 0", () => {
    const m = computeNightSleepMetrics({
      lightsOutTime: "23:00",
      outOfBedTime: "23:40",
      sleepOnsetLatencyMin: 30,
      nightWakeDurationMin: 30,
      daytimeNapMin: 0,
    });
    expect(m).not.toBeNull();
    expect(m!.estimatedNightSleepMinutes).toBe(0);
    expect(m!.sleepEfficiencyPercent).toBe(0);
  });

  it("含小睡的总睡眠", () => {
    const m = computeNightSleepMetrics({
      lightsOutTime: "23:00",
      outOfBedTime: "07:00",
      sleepOnsetLatencyMin: 0,
      nightWakeDurationMin: 0,
      daytimeNapMin: 30,
    });
    expect(m!.totalSleepMinutesIncludingNap).toBe(8 * 60 + 30);
  });

  it("无效在床时间返回 null", () => {
    expect(
      computeNightSleepMetrics({
        lightsOutTime: "bad",
        outOfBedTime: "07:00",
        sleepOnsetLatencyMin: 0,
        nightWakeDurationMin: 0,
        daytimeNapMin: 0,
      }),
    ).toBeNull();
  });
});
