import { describe, expect, it } from "vitest";
import {
  FALLBACK_AVG_TST_MINUTES,
  LIMITED_DATA_NOTE,
  SLEEP_EFFICIENCY_NAP_THRESHOLD,
  TARGET_TIB_BUFFER_MINUTES,
  TARGET_TIB_MAX_MINUTES,
  TARGET_TIB_MIN_MINUTES,
} from "@/lib/sleep-plan/constants";
import { applySleepPlanRules } from "@/lib/sleep-plan/rules";
import type { DiaryAggregate } from "@/lib/sleep-plan/types";

function makeAgg(
  entries: DiaryAggregate["validEntries"],
): DiaryAggregate {
  return {
    validEntries: entries,
    wakeSamples: entries.map((e) => ({
      entry_date: e.entry_date,
      outOfBedMinutes: e.outOfBedMinutes,
    })),
    metricsSampleCount: entries.length,
  };
}

const inputBase = {
  planDate: "2026-04-10",
  diaryEntries: [],
  onboardingDefaultWakeTime: null as string | null,
};

describe("applySleepPlanRules — ≥3 天时平均离床向 15 分钟取整", () => {
  it("三条均为 7:07 离床时，平均取整为 07:00", () => {
    const sevenOhSeven = 7 * 60 + 7;
    const agg = makeAgg([
      entry("a1", sevenOhSeven, 400, 90),
      entry("a2", sevenOhSeven, 400, 90),
      entry("a3", sevenOhSeven, 400, 90),
    ]);
    const r = applySleepPlanRules(agg, inputBase);
    expect(r.fixedWakeTime).toBe("07:00");
    expect(r.ruleOutputs.wakeDecision).toBe("diary_average");
  });

  it("三条均为 7:08 离床时，平均取整为 07:15", () => {
    const sevenOhEight = 7 * 60 + 8;
    const agg = makeAgg([
      entry("b1", sevenOhEight, 400, 90),
      entry("b2", sevenOhEight, 400, 90),
      entry("b3", sevenOhEight, 400, 90),
    ]);
    const r = applySleepPlanRules(agg, inputBase);
    expect(r.fixedWakeTime).toBe("07:15");
  });
});

describe("applySleepPlanRules — avgTST + 30 后的 clamp（目标在床时间）", () => {
  it("avgTST 过低时，+30 后夹到下限 6 小时", () => {
    const agg = makeAgg([
      entry("c1", 420, 200, 90),
      entry("c2", 420, 200, 90),
      entry("c3", 420, 200, 90),
    ]);
    const r = applySleepPlanRules(agg, inputBase);
    const target = r.ruleOutputs.targetTimeInBedMinutes as number;
    expect(200 + TARGET_TIB_BUFFER_MINUTES).toBeLessThan(TARGET_TIB_MIN_MINUTES);
    expect(target).toBe(TARGET_TIB_MIN_MINUTES);
  });

  it("avgTST 过高时，+30 后夹到上限 8 小时", () => {
    const agg = makeAgg([
      entry("d1", 420, 500, 90),
      entry("d2", 420, 500, 90),
      entry("d3", 420, 500, 90),
    ]);
    const r = applySleepPlanRules(agg, inputBase);
    const target = r.ruleOutputs.targetTimeInBedMinutes as number;
    expect(500 + TARGET_TIB_BUFFER_MINUTES).toBeGreaterThan(TARGET_TIB_MAX_MINUTES);
    expect(target).toBe(TARGET_TIB_MAX_MINUTES);
  });

  it("中间值不触发上下限夹断", () => {
    const avgTst = 420;
    const agg = makeAgg([
      entry("e1", 420, avgTst, 90),
      entry("e2", 420, avgTst, 90),
      entry("e3", 420, avgTst, 90),
    ]);
    const r = applySleepPlanRules(agg, inputBase);
    expect(r.ruleOutputs.targetTimeInBedMinutes).toBe(
      avgTst + TARGET_TIB_BUFFER_MINUTES,
    );
  });
});

describe("applySleepPlanRules — 睡眠效率阈值与 allowNap", () => {
  it(`平均效率严格低于 ${SLEEP_EFFICIENCY_NAP_THRESHOLD}% 则不允许小睡`, () => {
    const se = SLEEP_EFFICIENCY_NAP_THRESHOLD - 0.1;
    const agg = makeAgg([
      entry("f1", 420, 400, se),
      entry("f2", 420, 400, se),
      entry("f3", 420, 400, se),
    ]);
    const r = applySleepPlanRules(agg, inputBase);
    expect(r.allowNap).toBe(false);
    expect(r.ruleOutputs.napAllowReason).toBe("below_threshold");
  });

  it(`平均效率等于或高于 ${SLEEP_EFFICIENCY_NAP_THRESHOLD}% 则允许小睡`, () => {
    const se = SLEEP_EFFICIENCY_NAP_THRESHOLD;
    const agg = makeAgg([
      entry("g1", 420, 400, se),
      entry("g2", 420, 400, se),
      entry("g3", 420, 400, se),
    ]);
    const r = applySleepPlanRules(agg, inputBase);
    expect(r.allowNap).toBe(true);
    expect(r.ruleOutputs.napAllowReason).toBe("at_or_above_threshold");
  });
});

describe("applySleepPlanRules — 有效数据不足 3 天的回退", () => {
  it("无 onboarding 时使用产品默认起床 07:00", () => {
    const agg = makeAgg([
      entry("h1", 420, 400, 90),
      entry("h2", 420, 400, 90),
    ]);
    const r = applySleepPlanRules(agg, {
      ...inputBase,
      onboardingDefaultWakeTime: null,
    });
    expect(r.fixedWakeTime).toBe("07:00");
    expect(r.ruleOutputs.wakeDecision).toBe("product_default");
  });

  it("有合法 onboarding 起床时间时优先采用", () => {
    const agg = makeAgg([
      entry("i1", 420, 400, 90),
      entry("i2", 420, 400, 90),
    ]);
    const r = applySleepPlanRules(agg, {
      ...inputBase,
      onboardingDefaultWakeTime: "06:15",
    });
    expect(r.fixedWakeTime).toBe("06:15");
    expect(r.ruleOutputs.wakeDecision).toBe("onboarding_default");
  });

  it("有效天不足 3 时 notes 含 LIMITED_DATA_NOTE 且 limitedData 为 true", () => {
    const agg = makeAgg([entry("j1", 420, 400, 90)]);
    const r = applySleepPlanRules(agg, inputBase);
    expect(r.notes).toContain(LIMITED_DATA_NOTE);
    expect(r.ruleOutputs.limitedData).toBe(true);
  });

  it("无有效 TST 样本时 avgTST 使用回退常量", () => {
    const agg = makeAgg([]);
    const r = applySleepPlanRules(agg, inputBase);
    expect(r.ruleOutputs.avgTstMinutes).toBe(FALLBACK_AVG_TST_MINUTES);
  });
});

function entry(
  id: string,
  outOfBedMinutes: number,
  tstMinutes: number,
  sleepEfficiencyPercent: number,
): DiaryAggregate["validEntries"][number] {
  return {
    id,
    entry_date: "2026-04-01",
    outOfBedMinutes,
    tstMinutes,
    sleepEfficiencyPercent,
  };
}
