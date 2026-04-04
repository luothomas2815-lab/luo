import type { SleepDiaryPayload } from "@/lib/diary/schema";
import {
  minutesBetweenCrossNight,
  parseTimeToMinutes,
} from "@/lib/diary/sleep-metrics";

/**
 * Zod 通过后的业务校验（时间顺序、与在床时间一致性）。
 */
export function validateDiaryBusinessRules(
  data: SleepDiaryPayload,
):
  | { ok: true }
  | { ok: false; message: string } {
  const bed = parseTimeToMinutes(data.bed_time);
  const lights = parseTimeToMinutes(data.lights_out_time);
  if (bed === null || lights === null) {
    return { ok: false, message: "时间格式无效" };
  }
  if (bed > lights) {
    return { ok: false, message: "上床时间应不晚于关灯时间" };
  }

  const tib = minutesBetweenCrossNight(
    data.lights_out_time,
    data.out_of_bed_time,
  );
  if (!Number.isFinite(tib) || tib < 30) {
    return {
      ok: false,
      message: "在床时间过短或关灯/起床时间不合理，请检查",
    };
  }

  if (data.sleep_latency_min + data.night_wake_duration_min > tib) {
    return {
      ok: false,
      message: "入睡耗时与夜醒合计不应超过在床时间",
    };
  }

  return { ok: true };
}
