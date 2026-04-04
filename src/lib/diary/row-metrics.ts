import { computeNightSleepMetrics, type NightSleepMetrics } from "@/lib/diary/sleep-metrics";
import { parseStoredDiaryPayload } from "@/lib/diary/stored";

type StoredMetrics = NightSleepMetrics & { metrics_version?: number };

export function getMetricsFromPayload(payload: unknown): NightSleepMetrics | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const stored = raw.metrics as StoredMetrics | undefined;
  if (
    stored &&
    typeof stored.timeInBedMinutes === "number" &&
    typeof stored.estimatedNightSleepMinutes === "number" &&
    typeof stored.sleepEfficiencyPercent === "number"
  ) {
    return {
      timeInBedMinutes: stored.timeInBedMinutes,
      estimatedNightSleepMinutes: stored.estimatedNightSleepMinutes,
      sleepEfficiencyPercent: stored.sleepEfficiencyPercent,
      totalSleepMinutesIncludingNap: stored.totalSleepMinutesIncludingNap,
    };
  }

  const p = parseStoredDiaryPayload(payload);
  if (!p) return null;
  return computeNightSleepMetrics({
    lightsOutTime: p.lights_out_time,
    outOfBedTime: p.out_of_bed_time,
    sleepOnsetLatencyMin: p.sleep_latency_min,
    nightWakeDurationMin: p.night_wake_duration_min,
    daytimeNapMin: p.daytime_nap_min,
  });
}
