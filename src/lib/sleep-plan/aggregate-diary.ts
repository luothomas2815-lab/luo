/**
 * 从最近窗口内的睡眠日记聚合统计（不决策）。
 */

import { computeNightSleepMetrics } from "@/lib/diary/sleep-metrics";
import { sleepDiaryPayloadSchema } from "@/lib/diary/schema";
import type { DiaryAggregate, DiaryEntryForPlan } from "@/lib/sleep-plan/types";
import { parseTimeToMinutes } from "@/lib/sleep-plan/time";

export function average(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * 聚合日记条目（调用方负责传入「最近 7 天」等已截断的列表）。
 */
export function aggregateDiaryEntries(
  entries: DiaryEntryForPlan[],
): DiaryAggregate {
  const validEntries: DiaryAggregate["validEntries"] = [];

  for (const e of entries) {
    const parsed = sleepDiaryPayloadSchema.safeParse(e.payload);
    if (!parsed.success) continue;

    const p = parsed.data;
    const metrics = computeNightSleepMetrics({
      lightsOutTime: p.lights_out_time,
      outOfBedTime: p.out_of_bed_time,
      sleepOnsetLatencyMin: p.sleep_latency_min,
      nightWakeDurationMin: p.night_wake_duration_min,
      daytimeNapMin: p.daytime_nap_min,
    });
    if (!metrics) continue;

    const ob = parseTimeToMinutes(p.out_of_bed_time);
    if (ob === null) continue;

    validEntries.push({
      id: e.id,
      entry_date: e.entry_date,
      outOfBedMinutes: ob,
      tstMinutes: metrics.estimatedNightSleepMinutes,
      sleepEfficiencyPercent: metrics.sleepEfficiencyPercent,
    });
  }

  return {
    validEntries,
    wakeSamples: validEntries.map((r) => ({
      entry_date: r.entry_date,
      outOfBedMinutes: r.outOfBedMinutes,
    })),
    metricsSampleCount: validEntries.length,
  };
}
