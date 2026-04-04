import { describe, expect, it } from "vitest";
import { aggregateDiaryEntries } from "@/lib/sleep-plan/aggregate-diary";
import { LIMITED_DATA_NOTE } from "@/lib/sleep-plan/constants";
import { generateSleepPlan } from "@/lib/sleep-plan/generate-plan";
import { applySleepPlanRules } from "@/lib/sleep-plan/rules";
import { addCalendarDays, sevenDayWindowInclusive } from "@/lib/sleep-plan/time";
import type { DiaryEntryForPlan, SleepPlanGenerationInput } from "@/lib/sleep-plan/types";

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    bed_time: "23:00",
    lights_out_time: "23:10",
    sleep_latency_min: 20,
    night_wake_count: 1,
    night_wake_duration_min: 30,
    final_awakening_time: "06:45",
    out_of_bed_time: "07:00",
    daytime_nap_min: 0,
    caffeine: "none",
    alcohol: "none",
    daytime_energy: 3,
    ...overrides,
  };
}

function entriesFromDays(
  days: { date: string; payload: Record<string, unknown> }[],
): DiaryEntryForPlan[] {
  return days.map((d, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    entry_date: d.date,
    payload: basePayload(d.payload),
  }));
}

describe("time.addCalendarDays / sevenDayWindowInclusive", () => {
  it("7 日含端点窗口", () => {
    expect(sevenDayWindowInclusive("2026-04-10")).toEqual({
      start: "2026-04-04",
      end: "2026-04-10",
    });
    expect(addCalendarDays("2026-01-01", 1)).toBe("2026-01-02");
  });
});

describe("aggregateDiaryEntries", () => {
  it("跳过无效 payload", () => {
    const agg = aggregateDiaryEntries([
      {
        id: "a",
        entry_date: "2026-04-01",
        payload: { bad: true },
      },
    ]);
    expect(agg.validEntries.length).toBe(0);
  });
});

describe("generateSleepPlan", () => {
  it("样例：≥3 天日记，允许小睡", () => {
    const input: SleepPlanGenerationInput = {
      planDate: "2026-04-10",
      diaryEntries: entriesFromDays([
        { date: "2026-04-03", payload: { out_of_bed_time: "07:00" } },
        { date: "2026-04-04", payload: { out_of_bed_time: "07:15" } },
        { date: "2026-04-05", payload: { out_of_bed_time: "07:00" } },
        { date: "2026-04-06", payload: { out_of_bed_time: "07:00" } },
      ]),
      onboardingDefaultWakeTime: "06:30",
    };
    const r = generateSleepPlan(input);
    expect(r.fixedWakeTime).toBe("07:00");
    expect(r.allowNap).toBe(true);
    expect(r.napLimitMinutes).toBe(20);
  });

  it("样例：日记不足 3 天用 onboarding", () => {
    const r = generateSleepPlan({
      planDate: "2026-04-10",
      diaryEntries: entriesFromDays([
        { date: "2026-04-08", payload: {} },
        { date: "2026-04-09", payload: {} },
      ]),
      onboardingDefaultWakeTime: "06:30",
    });
    expect(r.fixedWakeTime).toBe("06:30");
  });

  it("有效日记少于 3 天：notes 含有限数据说明", () => {
    const r = generateSleepPlan({
      planDate: "2026-04-10",
      diaryEntries: entriesFromDays([
        { date: "2026-04-09", payload: {} },
        { date: "2026-04-08", payload: {} },
      ]),
      onboardingDefaultWakeTime: "07:00",
    });
    expect(r.notes).toContain(LIMITED_DATA_NOTE);
    expect(r.ruleOutputs.limitedData).toBe(true);
  });

  it("样例：低效率禁小睡", () => {
    const low = {
      lights_out_time: "23:10",
      out_of_bed_time: "07:00",
      sleep_latency_min: 20,
      night_wake_duration_min: 150,
    };
    const r = generateSleepPlan({
      planDate: "2026-04-10",
      diaryEntries: entriesFromDays([
        { date: "2026-04-03", payload: low },
        { date: "2026-04-04", payload: low },
        { date: "2026-04-05", payload: low },
      ]),
      onboardingDefaultWakeTime: null,
    });
    expect(r.allowNap).toBe(false);
  });
});

describe("applySleepPlanRules + 一致 diaryEntries", () => {
  it("决策层可单独测", () => {
    const diaryEntries = entriesFromDays([
      { date: "2026-04-01", payload: {} },
      { date: "2026-04-02", payload: {} },
      { date: "2026-04-03", payload: {} },
    ]);
    const agg = aggregateDiaryEntries(diaryEntries);
    const r = applySleepPlanRules(agg, {
      planDate: "2026-04-10",
      diaryEntries,
      onboardingDefaultWakeTime: null,
    });
    expect(r.fixedWakeTime).toBe("07:00");
  });
});
