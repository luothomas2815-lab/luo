import type { ScreeningAnswers } from "@/lib/screening/schema";

export type RiskLevel = "low" | "medium" | "high";

export type RiskFlag =
  | "marked_anxiety_or_low_mood"
  | "regular_sleep_aids_or_alcohol"
  | "possible_sleep_disordered_breathing"
  | "chronic_severe_insomnia_pattern";

export interface ScreeningRiskResult {
  level: RiskLevel;
  flags: RiskFlag[];
}

/**
 * 规则引擎：筛查风险分级（非 LLM）。
 * 用于提示「是否建议进一步医学评估」，不做诊断。
 */
export function classifyScreeningRisk(
  answers: ScreeningAnswers,
): ScreeningRiskResult {
  const flags: RiskFlag[] = [];

  if (answers.anxiety_mood === "marked") {
    flags.push("marked_anxiety_or_low_mood");
  }

  if (answers.sleep_aids_alcohol === "regular") {
    flags.push("regular_sleep_aids_or_alcohol");
  }

  if (
    answers.snoring_choking === "yes" &&
    (answers.daytime_impact === "severe" || answers.daytime_impact === "moderate")
  ) {
    flags.push("possible_sleep_disordered_breathing");
  }

  if (
    answers.daytime_impact === "severe" &&
    (answers.insomnia_duration === "three_to_six_months" ||
      answers.insomnia_duration === "over_six_months")
  ) {
    flags.push("chronic_severe_insomnia_pattern");
  }

  const high =
    flags.includes("marked_anxiety_or_low_mood") ||
    flags.includes("regular_sleep_aids_or_alcohol") ||
    flags.includes("possible_sleep_disordered_breathing") ||
    flags.includes("chronic_severe_insomnia_pattern");

  if (high) {
    return { level: "high", flags: uniqueFlags(flags) };
  }

  const medium =
    answers.daytime_impact === "severe" ||
    answers.anxiety_mood === "some" ||
    answers.sleep_aids_alcohol === "occasional" ||
    (answers.snoring_choking === "yes" && answers.daytime_impact === "mild") ||
    answers.main_symptoms.length >= 3;

  if (medium) {
    return { level: "medium", flags: uniqueFlags(flags) };
  }

  return { level: "low", flags: uniqueFlags(flags) };
}

function uniqueFlags(f: RiskFlag[]): RiskFlag[] {
  return Array.from(new Set(f));
}
