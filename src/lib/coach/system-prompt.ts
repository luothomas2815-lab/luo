import type { AIChatMessage } from "@/lib/ai/types";
import type { CoachPromptContext } from "@/lib/coach/context";

export interface CoachSystemPromptInput {
  activePlan?: string | null;
  sleepSummary?: string | null;
  conversationHistory?: string | null;
}

export const COACH_SYSTEM_PROMPT_TEMPLATE = `你是“睡眠教练”，不是医生，也不是诊断系统。

你的职责：
1. 解释已有 sleep plan 的含义与执行原因。
2. 用通俗、简洁、温和但坚定的方式解释 CBT-I 的基础原则。
3. 帮助用户理解以下常见问题：
   - 为什么不能赖床
   - 为什么未困不要上床
   - 为什么长时间睡不着要先离床
   - 为什么白天补觉可能打乱夜间睡眠
4. 在回答时，可以引用系统提供的“今日 active sleep plan”和“最近 7 天睡眠摘要”。
5. 你可以做鼓励、答疑、解释和总结，但不要夸大效果。

你的硬性边界：
1. 你不能修改 sleep plan，也不能暗示自己有权改变以下字段：
   - fixedWakeTime
   - earliestBedtime
   - allowNap
   - napLimitMinutes
2. 这些字段只能由规则引擎生成；如果用户要求你改计划，你只能解释原因，并建议用户查看系统计划或后续由规则引擎重新计算。
3. 你不能提供药物剂量、处方建议、停药换药建议。
4. 你不能替代诊断，不能说“你得了什么病”之类的诊断性结论。
5. 你不能承诺疗效、治愈率、见效时间，不能做保证性表述。

高风险安全要求：
1. 如果用户表达自伤、自杀、伤害他人、严重危险行为，或明显需要紧急专业支持的内容，你必须立刻停止普通教练对话。
2. 遇到高风险内容时，你只能输出安全提示风格的回复：简洁、明确、支持性，不继续解释 sleep plan，不继续普通闲聊。
3. 高风险时不要分析、不要延展 CBT-I 解释，不要给出普通睡眠建议。

回答风格：
1. 简洁。
2. 温和。
3. 坚定。
4. 不啰嗦。
5. 不要写得像医生诊断结论。
6. 优先用短段落，少用长列表。
7. 如果系统上下文不足，要明确说“我只能基于当前已有计划和近 7 天摘要来解释”。

回答规则：
1. 若用户询问“为什么这样安排”，优先结合 activePlan 解释。
2. 若用户询问“最近睡得怎么样”，优先结合 sleepSummary 回答。
3. 若用户要求改计划，明确说明你不能改，只能解释。
4. 若用户要求药物、处方、诊断、疗效承诺，明确拒绝，并回到教育性说明。
5. 若用户没有提供足够信息，不要编造；可基于已有上下文做保守解释。

系统提供的上下文如下。你只能把这些内容当作解释依据，不能把它们改写成新的治疗决策。

[ACTIVE_PLAN]
{{activePlan}}

[SLEEP_SUMMARY_7D]
{{sleepSummary}}

[CONVERSATION_HISTORY]
{{conversationHistory}}
`;

export function buildCoachSystemPrompt(
  input: CoachSystemPromptInput = {},
): string {
  return COACH_SYSTEM_PROMPT_TEMPLATE.replace(
    "{{activePlan}}",
    input.activePlan?.trim() || "暂无 active sleep plan。",
  )
    .replace(
      "{{sleepSummary}}",
      input.sleepSummary?.trim() || "暂无最近 7 天睡眠摘要。",
    )
    .replace(
      "{{conversationHistory}}",
      input.conversationHistory?.trim() || "暂无历史对话。",
    );
}

export function serializeCoachPromptContext(
  context: CoachPromptContext,
): CoachSystemPromptInput {
  const activePlan =
    context.activePlan.status === "available"
      ? [
          `fixedWakeTime: ${context.activePlan.fixedWakeTime ?? "null"}`,
          `earliestBedtime: ${context.activePlan.earliestBedtime ?? "null"}`,
          `allowNap: ${String(context.activePlan.allowNap)}`,
          `napLimitMinutes: ${String(context.activePlan.napLimitMinutes)}`,
          `sleepIfNotSleepyAction: ${context.activePlan.sleepIfNotSleepyAction ?? "null"}`,
          `awakeTooLongAction: ${context.activePlan.awakeTooLongAction ?? "null"}`,
          `notes: ${context.activePlan.notes ?? "null"}`,
        ].join("\n")
      : context.activePlan.notes ?? "当前无计划。";

  const sleepSummary = [
    `windowStart: ${context.sleepSummary7d.windowStart}`,
    `windowEnd: ${context.sleepSummary7d.windowEnd}`,
    `validEntryCount: ${context.sleepSummary7d.validEntryCount}`,
    `avgTstMinutes: ${String(context.sleepSummary7d.avgTstMinutes)}`,
    `avgTibMinutes: ${String(context.sleepSummary7d.avgTibMinutes)}`,
    `avgSleepEfficiencyPercent: ${String(context.sleepSummary7d.avgSleepEfficiencyPercent)}`,
    `avgWakeTime: ${String(context.sleepSummary7d.avgWakeTime)}`,
    `hasMissingRecentDays: ${String(context.sleepSummary7d.hasMissingRecentDays)}`,
  ].join("\n");

  const conversationHistory =
    context.conversationHistory.length > 0
      ? context.conversationHistory
          .map((turn) => `${turn.role}: ${turn.content}`)
          .join("\n")
      : "暂无历史对话。";

  return {
    activePlan,
    sleepSummary,
    conversationHistory,
  };
}

export function buildCoachModelMessages(
  context: CoachPromptContext,
): AIChatMessage[] {
  return context.conversationHistory.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));
}

export function buildCoachSystemPromptFromContext(
  context: CoachPromptContext,
): string {
  return buildCoachSystemPrompt(serializeCoachPromptContext(context));
}
