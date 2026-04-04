/**
 * 纯规则决策（不依赖 React / 不读数据库）。
 */

import { average, aggregateDiaryEntries } from "@/lib/sleep-plan/aggregate-diary";
import {
  FALLBACK_AVG_TST_MINUTES,
  LIMITED_DATA_NOTE,
  MIN_WAKE_SAMPLE_DAYS,
  NAP_LIMIT_MINUTES_FIXED,
  PLAN_COPY,
  PRODUCT_DEFAULT_WAKE_HHMM,
  SLEEP_EFFICIENCY_NAP_THRESHOLD,
  SLEEP_PLAN_RULE_VERSION,
  TARGET_TIB_BUFFER_MINUTES,
  TARGET_TIB_MAX_MINUTES,
  TARGET_TIB_MIN_MINUTES,
  WAKE_ROUND_MINUTES,
} from "@/lib/sleep-plan/constants";
import type {
  DiaryAggregate,
  SleepPlanGenerationInput,
  SleepPlanGenerationResult,
} from "@/lib/sleep-plan/types";
import {
  clamp,
  formatMinutesAsHHMM,
  roundMinutesToNearestStep,
  subtractMinutesFromClockHHMM,
} from "@/lib/sleep-plan/time";

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidWakeHHMM(s: string | null | undefined): s is string {
  return Boolean(s && HHMM_RE.test(s.trim()));
}

function resolveFixedWakeTime(
  agg: DiaryAggregate,
  onboardingDefaultWakeTime: string | null,
): {
  fixedWakeHHMM: string;
  source: "diary_average" | "onboarding_default" | "product_default";
  avgWakeMinutesRaw: number | null;
} {
  const n = agg.validEntries.length;
  if (n >= MIN_WAKE_SAMPLE_DAYS) {
    const wakes = agg.validEntries.map((e) => e.outOfBedMinutes);
    const avgWake = average(wakes);
    if (avgWake === null) {
      return {
        fixedWakeHHMM: PRODUCT_DEFAULT_WAKE_HHMM,
        source: "product_default",
        avgWakeMinutesRaw: null,
      };
    }
    const rounded = roundMinutesToNearestStep(avgWake, WAKE_ROUND_MINUTES);
    return {
      fixedWakeHHMM: formatMinutesAsHHMM(rounded),
      source: "diary_average",
      avgWakeMinutesRaw: avgWake,
    };
  }

  if (isValidWakeHHMM(onboardingDefaultWakeTime)) {
    return {
      fixedWakeHHMM: onboardingDefaultWakeTime!.trim(),
      source: "onboarding_default",
      avgWakeMinutesRaw: null,
    };
  }

  return {
    fixedWakeHHMM: PRODUCT_DEFAULT_WAKE_HHMM,
    source: "product_default",
    avgWakeMinutesRaw: null,
  };
}

function resolveAvgTstMinutes(agg: DiaryAggregate): {
  value: number;
  source: "diary_average" | "fallback_no_tst";
} {
  const tsts = agg.validEntries.map((e) => e.tstMinutes);
  const avg = average(tsts);
  if (avg === null) {
    return { value: FALLBACK_AVG_TST_MINUTES, source: "fallback_no_tst" };
  }
  return { value: avg, source: "diary_average" };
}

function resolveAvgSleepEfficiency(agg: DiaryAggregate): number | null {
  return average(agg.validEntries.map((e) => e.sleepEfficiencyPercent));
}

function resolveAllowNap(avgSe: number | null): {
  allow: boolean;
  reason: "below_threshold" | "at_or_above_threshold" | "no_sample_treat_as_above";
} {
  if (avgSe === null) {
    return { allow: true, reason: "no_sample_treat_as_above" };
  }
  if (avgSe < SLEEP_EFFICIENCY_NAP_THRESHOLD) {
    return { allow: false, reason: "below_threshold" };
  }
  return { allow: true, reason: "at_or_above_threshold" };
}

/**
 * 仅规则决策：输入为聚合结果 + 生成上下文。
 */
export function applySleepPlanRules(
  agg: DiaryAggregate,
  input: SleepPlanGenerationInput,
): SleepPlanGenerationResult {
  const wake = resolveFixedWakeTime(agg, input.onboardingDefaultWakeTime);
  const tst = resolveAvgTstMinutes(agg);
  const targetTibMinutes = clamp(
    tst.value + TARGET_TIB_BUFFER_MINUTES,
    TARGET_TIB_MIN_MINUTES,
    TARGET_TIB_MAX_MINUTES,
  );

  const earliest = subtractMinutesFromClockHHMM(
    wake.fixedWakeHHMM,
    targetTibMinutes,
  );
  const earliestBedtime = earliest ?? "23:00";

  const avgSe = resolveAvgSleepEfficiency(agg);
  const nap = resolveAllowNap(avgSe);

  const notesParts: string[] = [];
  notesParts.push(
    `固定起床：${wake.source === "diary_average" ? `最近有效日记≥${MIN_WAKE_SAMPLE_DAYS}天，按平均离床时刻向${WAKE_ROUND_MINUTES}分钟取整` : wake.source === "onboarding_default" ? "日记有效天不足，采用 onboarding 默认起床时间" : "日记有效天不足且无 onboarding 默认，采用产品默认 07:00"}。`,
  );
  notesParts.push(
    `在床目标：${tst.source === "diary_average" ? "基于平均夜间睡眠时长" : "无有效 TST 样本，使用回退均值"} + ${TARGET_TIB_BUFFER_MINUTES} 分钟，限制在 6～8 小时。`,
  );
  notesParts.push(
    `小睡：平均睡眠效率${avgSe === null ? "无样本" : `${avgSe.toFixed(1)}%`}，${nap.allow ? "允许" : "不允许"}小睡（阈值 ${SLEEP_EFFICIENCY_NAP_THRESHOLD}%）。`,
  );

  const limitedData = agg.validEntries.length < MIN_WAKE_SAMPLE_DAYS;
  if (limitedData) {
    notesParts.push(LIMITED_DATA_NOTE);
  }

  const ruleInputs: Record<string, unknown> = {
    planDate: input.planDate,
    diaryEntryIds: input.diaryEntries.map((e) => e.id),
    diaryEntryDates: input.diaryEntries.map((e) => e.entry_date),
    onboardingDefaultWakeTime: input.onboardingDefaultWakeTime,
  };

  const ruleOutputs: Record<string, unknown> = {
    validEntryCount: agg.validEntries.length,
    limitedData,
    limitedDataThresholdDays: MIN_WAKE_SAMPLE_DAYS,
    wakeDecision: wake.source,
    avgWakeMinutesRaw: wake.avgWakeMinutesRaw,
    fixedWakeTime: wake.fixedWakeHHMM,
    avgTstSource: tst.source,
    avgTstMinutes: tst.value,
    targetTimeInBedMinutes: targetTibMinutes,
    avgSleepEfficiencyPercent: avgSe,
    napAllowReason: nap.reason,
    napThreshold: SLEEP_EFFICIENCY_NAP_THRESHOLD,
  };

  return {
    fixedWakeTime: wake.fixedWakeHHMM,
    earliestBedtime,
    allowNap: nap.allow,
    napLimitMinutes: NAP_LIMIT_MINUTES_FIXED,
    sleepIfNotSleepyAction: PLAN_COPY.sleepIfNotSleepy,
    awakeTooLongAction: PLAN_COPY.awakeTooLong,
    notes: notesParts.join(" "),
    ruleVersion: SLEEP_PLAN_RULE_VERSION,
    ruleInputs,
    ruleOutputs,
  };
}

/**
 * 便捷：聚合 + 规则一步（仍无 I/O）。
 */
export function runSleepPlanRulesFromDiaries(
  input: SleepPlanGenerationInput,
): SleepPlanGenerationResult {
  const agg = aggregateDiaryEntries(input.diaryEntries);
  return applySleepPlanRules(agg, input);
}
