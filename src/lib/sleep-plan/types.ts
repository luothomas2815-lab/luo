/**
 * 睡眠计划领域类型（规则层 / 持久化层，不依赖 React）。
 */

/** 单条日记供聚合（通常来自 sleep_diary_entries） */
export interface DiaryEntryForPlan {
  id: string;
  entry_date: string;
  payload: unknown;
}

/** 窗口内聚合统计（aggregate-diary 产出） */
export interface DiaryAggregate {
  validEntries: {
    id: string;
    entry_date: string;
    outOfBedMinutes: number;
    tstMinutes: number;
    sleepEfficiencyPercent: number;
  }[];
  wakeSamples: { entry_date: string; outOfBedMinutes: number }[];
  metricsSampleCount: number;
}

/** generate-plan 输入 */
export interface SleepPlanGenerationInput {
  planDate: string;
  diaryEntries: DiaryEntryForPlan[];
  onboardingDefaultWakeTime: string | null;
}

/** 规则引擎输出（可写入 sleep_plans 与 API） */
export interface SleepPlanGenerationResult {
  fixedWakeTime: string;
  earliestBedtime: string;
  allowNap: boolean;
  napLimitMinutes: number;
  sleepIfNotSleepyAction: string;
  awakeTooLongAction: string;
  notes: string;
  ruleVersion: string;
  ruleInputs: Record<string, unknown>;
  ruleOutputs: Record<string, unknown>;
}

/** persist-plan：写入库所需行数据 */
export interface PersistSleepPlanPayload {
  userId: string;
  planDate: string;
  sourceWindowStart: string;
  sourceWindowEnd: string;
  basedOnEntryIds: string[];
  generated: SleepPlanGenerationResult;
}

export type PersistSleepPlanResult =
  | { ok: true; planId: string }
  | { ok: false; error: string };

/** sleep_plans 表行（展示/接口用；时间与 DB 一致，可为 HH:mm 或 HH:mm:ss） */
export interface SleepPlanRecord {
  id: string;
  user_id: string;
  plan_date: string;
  source_window_start: string;
  source_window_end: string;
  based_on_entry_count: number;
  based_on_entry_ids: string[];
  status: "active" | "superseded";
  fixed_wake_time: string;
  earliest_bedtime: string;
  allow_nap: boolean;
  nap_limit_minutes: number | null;
  sleep_if_not_sleepy_action: string | null;
  awake_too_long_action: string | null;
  notes: string | null;
  rule_version: string;
  rule_inputs: Record<string, unknown>;
  rule_outputs: Record<string, unknown>;
  created_by: "rules_engine" | "manual";
  created_at: string;
  updated_at: string;
}

/** getOrCreateActiveSleepPlanForDate 的返回 */
export type GetOrCreateSleepPlanResult =
  | {
      ok: true;
      source: "existing" | "created";
      plan: SleepPlanRecord;
    }
  | {
      ok: false;
      error: string;
      stage: "auth" | "fetch_plan" | "fetch_diary" | "persist" | "fetch_created";
    };
