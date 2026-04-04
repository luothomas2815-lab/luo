import type { CoachPlanSummary } from "./coach-plan-summary-card";

const MAX_PROMPT_COUNT = 3;
const MIN_PROMPT_COUNT = 2;

const LIMITED_DATA_PATTERN = /有限数据|数据不足|样本不足|信息不足/i;

type PromptRule = {
  id: string;
  prompt: string;
  priority: number;
  when: (plan: CoachPlanSummary) => boolean;
};

const DYNAMIC_PROMPT_RULES: PromptRule[] = [
  {
    id: "no-nap",
    prompt: "为什么今天不建议补觉？",
    priority: 100,
    when: (plan) => plan.allowNap === false,
  },
  {
    id: "nap-limit",
    prompt: "今天可以小睡多久？为什么只能这么久？",
    priority: 100,
    when: (plan) => plan.allowNap === true && plan.napLimitMinutes !== null,
  },
  {
    id: "limited-data",
    prompt: "为什么今天的计划是基于有限数据生成的？",
    priority: 90,
    when: (plan) => Boolean(plan.notes && LIMITED_DATA_PATTERN.test(plan.notes)),
  },
  {
    id: "earliest-bedtime",
    prompt: "为什么今晚最早上床时间是这个？",
    priority: 80,
    when: (plan) => Boolean(plan.earliestBedtime),
  },
  {
    id: "fixed-wake-time",
    prompt: "为什么今天要固定这个起床时间？",
    priority: 75,
    when: (plan) => Boolean(plan.fixedWakeTime),
  },
];

const PLAN_FALLBACK_PROMPTS = [
  "今天这份计划里，最该优先执行的是哪两条？",
  "如果今晚执行困难，我可以先从哪一步开始？",
] as const;

export const EMPTY_PLAN_PROMPTS = [
  "我现在先做什么，才能尽快生成今日计划？",
  "今天没有计划时，我该怎么安排作息？",
] as const;

export function getCoachPromptSuggestions(
  plan: CoachPlanSummary | null,
): string[] {
  if (!plan) {
    return [...EMPTY_PLAN_PROMPTS];
  }

  const ordered = DYNAMIC_PROMPT_RULES.filter((rule) => rule.when(plan))
    .sort((a, b) => b.priority - a.priority)
    .map((item) => item.prompt);
  const uniqueOrdered = Array.from(new Set(ordered));

  const fallbackPrompts = PLAN_FALLBACK_PROMPTS.filter(
    (prompt) => !uniqueOrdered.includes(prompt),
  );

  const withFallback = [...uniqueOrdered, ...fallbackPrompts];
  const base = withFallback.slice(0, MAX_PROMPT_COUNT);
  if (base.length >= MIN_PROMPT_COUNT) {
    return base;
  }
  return withFallback.slice(0, MIN_PROMPT_COUNT);
}
