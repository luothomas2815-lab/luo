/**
 * 规则常量与固定文案（非页面组件）。
 */

export const SLEEP_PLAN_RULE_VERSION = "cbti-sleep-plan@1.0.0";

export const PRODUCT_DEFAULT_WAKE_HHMM = "07:00";

export const WAKE_ROUND_MINUTES = 15;

export const NAP_LIMIT_MINUTES_FIXED = 20;

export const SLEEP_EFFICIENCY_NAP_THRESHOLD = 85;

export const TARGET_TIB_BUFFER_MINUTES = 30;

export const TARGET_TIB_MIN_MINUTES = 6 * 60;

export const TARGET_TIB_MAX_MINUTES = 8 * 60;

export const MIN_WAKE_SAMPLE_DAYS = 3;

/** 无 TST 样本时参与 clamp 的回退均值（分钟） */
export const FALLBACK_AVG_TST_MINUTES = 420;

export const PLAN_COPY = {
  sleepIfNotSleepy:
    "未困时先不要上床，等有睡意再上床",
  awakeTooLong:
    "若长时间未入睡或醒后久未再睡，先离床做安静活动，困了再回床",
} as const;

/** 有效日记少于 3 天时追加到 notes（保守计划说明） */
export const LIMITED_DATA_NOTE =
  "当前基于有限数据生成，建议继续填写睡眠日记以便后续优化计划。";
