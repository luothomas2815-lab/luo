import { describe, expect, it } from "vitest";
import { aggregateDiaryEntries, average } from "@/lib/sleep-plan/aggregate-diary";

describe("average", () => {
  it("空数组返回 null", () => {
    expect(average([])).toBeNull();
  });

  it("计算算术平均", () => {
    expect(average([10, 20, 30])).toBe(20);
  });
});

describe("aggregateDiaryEntries — 日记聚合统计", () => {
  const validBase = {
    bed_time: "23:00",
    lights_out_time: "23:10",
    sleep_latency_min: 20,
    night_wake_count: 1,
    night_wake_duration_min: 30,
    final_awakening_time: "06:45",
    out_of_bed_time: "07:00",
    daytime_nap_min: 0,
    caffeine: "none" as const,
    alcohol: "none" as const,
    daytime_energy: 3,
  };

  it("有效条目数与 metricsSampleCount 一致", () => {
    const agg = aggregateDiaryEntries([
      {
        id: "e1",
        entry_date: "2026-04-01",
        payload: validBase,
      },
      {
        id: "e2",
        entry_date: "2026-04-02",
        payload: validBase,
      },
    ]);
    expect(agg.metricsSampleCount).toBe(2);
    expect(agg.validEntries).toHaveLength(2);
    expect(agg.wakeSamples).toHaveLength(2);
  });

  it("每条 validEntry 含离床分钟、TST、睡眠效率（与 sleep-metrics 一致）", () => {
    const agg = aggregateDiaryEntries([
      {
        id: "e1",
        entry_date: "2026-04-01",
        payload: validBase,
      },
    ]);
    expect(agg.validEntries[0].outOfBedMinutes).toBe(7 * 60);
    expect(agg.validEntries[0].tstMinutes).toBeGreaterThan(0);
    expect(agg.validEntries[0].sleepEfficiencyPercent).toBeGreaterThan(0);
    expect(agg.validEntries[0].sleepEfficiencyPercent).toBeLessThanOrEqual(100);
  });

  it("无效 payload 不计入 validEntries", () => {
    const agg = aggregateDiaryEntries([
      {
        id: "bad",
        entry_date: "2026-04-01",
        payload: { invalid: true },
      },
    ]);
    expect(agg.validEntries).toHaveLength(0);
  });
});
