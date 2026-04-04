/**
 * 睡眠日记衍生指标（纯函数，不依赖 LLM）。
 * 约定：lights_out / out_of_bed 为「主睡眠夜」的本地时钟时间（HH:mm），可跨午夜。
 */

export interface NightSleepInputs {
  /** 关灯时间 HH:mm */
  lightsOutTime: string;
  /** 离床时间 HH:mm（起床） */
  outOfBedTime: string;
  /** 关灯后估计入睡耗时（分钟），计作在床内清醒 */
  sleepOnsetLatencyMin: number;
  /** 夜间清醒总时长（分钟） */
  nightWakeDurationMin: number;
  /** 白天小睡（分钟），不计入主睡眠在床时间，可计入「总睡眠」展示 */
  daytimeNapMin: number;
}

export interface NightSleepMetrics {
  /** 在床时间（分钟）：关灯 → 离床 */
  timeInBedMinutes: number;
  /** 估计夜间睡眠时长（分钟）：TIB − 入睡潜伏期 − 夜间清醒 */
  estimatedNightSleepMinutes: number;
  /** 睡眠效率（0–100）：夜间睡眠 / 在床时间 */
  sleepEfficiencyPercent: number;
  /** 含小睡的总睡眠（分钟） */
  totalSleepMinutesIncludingNap: number;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** 将 HH:mm 转为当日从 0:00 起的分钟数 [0, 1440) */
export function parseTimeToMinutes(hhmm: string): number | null {
  if (!TIME_RE.test(hhmm.trim())) return null;
  const [h, m] = hhmm.trim().split(":").map(Number);
  return h * 60 + m;
}

/**
 * 计算从 start 到 end 的间隔分钟数；若 end 不晚于 start（同日比较），视为跨午夜到次日。
 */
export function minutesBetweenCrossNight(startHHMM: string, endHHMM: string): number {
  const start = parseTimeToMinutes(startHHMM);
  const end = parseTimeToMinutes(endHHMM);
  if (start === null || end === null) {
    return NaN;
  }
  let diff = end - start;
  if (diff === 0) {
    return 0;
  }
  if (diff < 0) {
    diff += 24 * 60;
  }
  return diff;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * 计算在床时间、估计夜间睡眠、睡眠效率、含小睡总睡眠。
 */
export function computeNightSleepMetrics(input: NightSleepInputs): NightSleepMetrics | null {
  const tib = minutesBetweenCrossNight(
    input.lightsOutTime,
    input.outOfBedTime,
  );
  if (!Number.isFinite(tib) || tib <= 0) {
    return null;
  }

  const latency = clamp(
    Number.isFinite(input.sleepOnsetLatencyMin) ? input.sleepOnsetLatencyMin : 0,
    0,
    tib,
  );
  const waso = clamp(
    Number.isFinite(input.nightWakeDurationMin) ? input.nightWakeDurationMin : 0,
    0,
    tib,
  );

  let tst = tib - latency - waso;
  if (!Number.isFinite(tst) || tst < 0) {
    tst = 0;
  }
  if (tst > tib) {
    tst = tib;
  }

  const se = tib > 0 ? (tst / tib) * 100 : 0;
  const nap = clamp(
    Number.isFinite(input.daytimeNapMin) ? input.daytimeNapMin : 0,
    0,
    24 * 60,
  );

  return {
    timeInBedMinutes: Math.round(tib),
    estimatedNightSleepMinutes: Math.round(tst),
    sleepEfficiencyPercent: Math.round(clamp(se, 0, 100) * 10) / 10,
    totalSleepMinutesIncludingNap: Math.round(tst + nap),
  };
}
