/**
 * 组装「生成睡眠计划」流程：仅聚合 + 规则，不写库。
 */

import { runSleepPlanRulesFromDiaries } from "@/lib/sleep-plan/rules";
import type {
  SleepPlanGenerationInput,
  SleepPlanGenerationResult,
} from "@/lib/sleep-plan/types";

export function generateSleepPlan(
  input: SleepPlanGenerationInput,
): SleepPlanGenerationResult {
  return runSleepPlanRulesFromDiaries(input);
}
