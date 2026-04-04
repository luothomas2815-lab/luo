/** 对外 API：页面请使用 `./service` 中的 getOrCreateActiveSleepPlanForDate */

export type {
  DiaryEntryForPlan,
  DiaryAggregate,
  SleepPlanGenerationInput,
  SleepPlanGenerationResult,
  PersistSleepPlanPayload,
  PersistSleepPlanResult,
  SleepPlanRecord,
  GetOrCreateSleepPlanResult,
} from "@/lib/sleep-plan/types";

export { getOrCreateActiveSleepPlanForDate } from "@/lib/sleep-plan/service";
export { getTodayActiveSleepPlan } from "@/lib/sleep-plan/today-active";

export { generateSleepPlan } from "@/lib/sleep-plan/generate-plan";
export { persistSleepPlan } from "@/lib/sleep-plan/persist-plan";
export {
  fetchActiveSleepPlan,
  fetchSleepPlanById,
  mapSleepPlanRow,
  normalizePgTime,
} from "@/lib/sleep-plan/db";
export { aggregateDiaryEntries, average } from "@/lib/sleep-plan/aggregate-diary";
export { applySleepPlanRules, runSleepPlanRulesFromDiaries } from "@/lib/sleep-plan/rules";
export * from "@/lib/sleep-plan/constants";
export * from "@/lib/sleep-plan/time";
