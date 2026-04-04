import { z } from "zod";

/** 失眠持续时长 */
export const insomniaDurationValues = [
  "under_1_month",
  "one_to_three_months",
  "three_to_six_months",
  "over_six_months",
] as const;

/** 主要症状（可多选） */
export const mainSymptomValues = [
  "fall_asleep_hard",
  "wake_often",
  "wake_early",
  "unrefreshed",
] as const;

/** 白天影响程度 */
export const daytimeImpactValues = ["mild", "moderate", "severe"] as const;

/** 打鼾 / 憋醒 */
export const snoringChokingValues = ["yes", "no", "unsure"] as const;

/** 焦虑 / 情绪低落 */
export const anxietyMoodValues = ["no", "some", "marked"] as const;

/** 助眠药或酒精 */
export const sleepAidsAlcoholValues = ["none", "occasional", "regular"] as const;

export const screeningAnswersSchema = z.object({
  insomnia_duration: z.enum(insomniaDurationValues),
  main_symptoms: z
    .array(z.enum(mainSymptomValues))
    .min(1, "请至少选择一项")
    .max(4),
  daytime_impact: z.enum(daytimeImpactValues),
  snoring_choking: z.enum(snoringChokingValues),
  anxiety_mood: z.enum(anxietyMoodValues),
  sleep_aids_alcohol: z.enum(sleepAidsAlcoholValues),
});

export type ScreeningAnswers = z.infer<typeof screeningAnswersSchema>;

/** 分步校验：第 1–5 步各对应字段 */
export const screeningStepSchemas = [
  screeningAnswersSchema.pick({ insomnia_duration: true }),
  screeningAnswersSchema.pick({ main_symptoms: true }),
  screeningAnswersSchema.pick({ daytime_impact: true }),
  screeningAnswersSchema.pick({ snoring_choking: true }),
  screeningAnswersSchema.pick({
    anxiety_mood: true,
    sleep_aids_alcohol: true,
  }),
] as const;

export type ScreeningStepIndex = 0 | 1 | 2 | 3 | 4;

export function validateScreeningStep(
  step: ScreeningStepIndex,
  partial: unknown,
) {
  return screeningStepSchemas[step].safeParse(partial);
}
