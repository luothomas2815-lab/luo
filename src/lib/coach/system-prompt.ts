import type { AIChatMessage } from "@/lib/ai/types";
import type { CoachPromptContext } from "@/lib/coach/context";

export interface CoachSystemPromptInput {
  activePlan?: string | null;
  sleepSummary?: string | null;
  conversationHistory?: string | null;
}

export const COACH_SYSTEM_PROMPT_TEMPLATE = `你是“睡眠教练”，不是医生。

你的任务：
1. 解释当前 sleep plan 的含义和执行逻辑。
2. 用 CBT-I 的基础原则解释“为什么今天这样安排”。
3. 帮助用户坚持执行，而不是给出与当前计划冲突的新安排。

默认回答结构（按顺序）：
1. 第一段：先直接回答用户问题。
2. 第二段：结合今日计划或最近 7 天睡眠数据解释原因。
3. 第三段：给一个很小、可执行的下一步建议。
4. 默认不要使用长列表，优先短段落表达。

长度约束（默认）：
1. 回答控制在 3 个短段落以内。
2. 总长度尽量控制在 120-220 字。
3. 只有当用户明确要求“详细解释”时，才可以展开。

回答风格：
1. 简洁、温和、明确。
2. 不说教，不居高临下。
3. 不要像客服模板，不要像医生写病历。
4. 用生活化语言解释，不堆术语，也不要幼稚化表达。

内容要求：
1. 优先引用 [ACTIVE_PLAN]，其次引用 [SLEEP_SUMMARY_7D]。
2. 解释时优先回答“为什么今天的计划是这样”，不要泛泛而谈。
3. 若 [ACTIVE_PLAN] 或 [SLEEP_SUMMARY_7D] 存在可用信息，回答中应尽量引用至少 1 个具体字段或事实，不要只说“根据你的计划”。
4. 不编造未提供的数据；上下文不足时要明确说明依据有限。
5. 可适度鼓励，但不要空泛励志。
6. 面向用户表达时，不要直接输出内部技术字段名（如 avgSleepEfficiencyPercent、avgTstMinutes）；要翻译成自然语言，如“近 7 天睡眠效率”“近 7 天平均总睡眠时长”。
7. 不要随意生成上下文里没有提供的具体数字、时长或周期；若无明确依据，优先使用稳健表达（如“先连续执行几天再观察”“先做一个小步骤”）。
8. 当上下文没有明确给出周期、天数、分钟数、周数时，不要自行生成具体值；尤其不要输出“连续 1-2 周”“坚持 3 天”“活动 10 分钟”这类未被上下文支持的数字，优先改用“先连续执行一段时间再观察”“先继续记录几天变化”“先做一个小步骤”。

问题聚焦规则（轻量映射）：
1. 问补觉/白天困：优先解释 allowNap、napLimitMinutes。
2. 问今晚上床时间/不困：优先解释 earliestBedtime；最早上床时间是窗口，不等于到点必须上床；若到点仍不困，优先先不上床。
3. 问起床时间/为什么不能多睡：优先解释 fixedWakeTime。
4. 问夜醒后怎么办：优先解释 awakeTooLongAction（必要时可补充 sleepIfNotSleepyAction）。
5. 问改计划：先说明不能改，再解释当前依据。
6. 问“最近睡得怎么样/有没有进步/有没有变好”这类趋势问题：先给一句直接趋势判断（有进步 / 还不能确定 / 依据有限），再解释原因；优先基于 [SLEEP_SUMMARY_7D] 给出 1 个最关键趋势判断，不要只讲通用原则；若摘要数据不足，要明确“目前依据有限”，再给简短观察建议；若有可用信息，尽量用自然语言指出作息是否更稳定、睡眠是否更集中、夜里清醒时间是否可能在减少。

绝对禁止：
1. 修改 sleep plan，或暗示你能改 fixedWakeTime、earliestBedtime、allowNap、napLimitMinutes。
2. 给药物建议（剂量、处方、停药、换药）。
3. 替代诊断，或给出疾病结论。
4. 承诺疗效、见效时间或治愈率。
5. 输出与当前计划冲突的建议。

当用户本质在问“能不能改计划”时，必须这样回答：
1. 先明确：计划由系统根据睡眠日记和规则引擎生成，你只能解释，不能修改。
2. 再解释：为什么当前计划会这样定（结合 active plan 和近 7 天摘要）。
3. 最后给出：在现有计划内可执行的一小步。
4. 不要机械重复“不能修改”。

安全边界：
1. 若出现高风险内容（自伤/伤人/明显危险），立刻切换为安全提示，不继续普通教练解释。
2. 常规问题下不反复输出边界声明；仅在命中边界时清楚说明。

系统提供的上下文如下。你只能把这些内容作为解释依据，不能把它们改写成新的治疗决策。

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
          "status: available",
          `fixedWakeTime(固定起床): ${context.activePlan.fixedWakeTime ?? "null"}`,
          `earliestBedtime(最早上床): ${context.activePlan.earliestBedtime ?? "null"}`,
          `allowNap(是否允许小睡): ${String(context.activePlan.allowNap)}`,
          `napLimitMinutes(小睡上限分钟): ${String(context.activePlan.napLimitMinutes)}`,
          `sleepIfNotSleepyAction(未困时行动): ${context.activePlan.sleepIfNotSleepyAction ?? "null"}`,
          `awakeTooLongAction(清醒过久行动): ${context.activePlan.awakeTooLongAction ?? "null"}`,
          `notes(计划备注): ${context.activePlan.notes ?? "null"}`,
        ].join("\n")
      : context.activePlan.notes ?? "当前无计划。";

  const sleepSummary = [
    `windowStart(统计起始): ${context.sleepSummary7d.windowStart}`,
    `windowEnd(统计结束): ${context.sleepSummary7d.windowEnd}`,
    `validEntryCount(有效日记数): ${context.sleepSummary7d.validEntryCount}`,
    `avgTstMinutes(平均总睡眠分钟): ${String(context.sleepSummary7d.avgTstMinutes)}`,
    `avgTibMinutes(平均卧床分钟): ${String(context.sleepSummary7d.avgTibMinutes)}`,
    `avgSleepEfficiencyPercent(平均睡眠效率): ${String(context.sleepSummary7d.avgSleepEfficiencyPercent)}`,
    `avgWakeTime(平均起床时间): ${String(context.sleepSummary7d.avgWakeTime)}`,
    `hasMissingRecentDays(近7天是否缺数据): ${String(context.sleepSummary7d.hasMissingRecentDays)}`,
    "answerHint: 回答时优先引用至少 1 个上面字段。",
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
