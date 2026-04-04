import { computeNightSleepMetrics, parseTimeToMinutes } from "@/lib/diary/sleep-metrics";
import { sleepDiaryPayloadSchema } from "@/lib/diary/schema";
import { getConversationWithMessages } from "@/lib/coach/storage";
import type { CoachMessageRecord } from "@/lib/coach/types";
import { createClient } from "@/lib/supabase/server";
import { getPlanCalendarDateForUser } from "@/lib/sleep-plan/calendar-today";
import { fetchActiveSleepPlan } from "@/lib/sleep-plan/db";
import { formatMinutesAsHHMM, sevenDayWindowInclusive } from "@/lib/sleep-plan/time";

export interface CoachActivePlanContext {
  status: "available" | "missing";
  fixedWakeTime: string | null;
  earliestBedtime: string | null;
  allowNap: boolean | null;
  napLimitMinutes: number | null;
  sleepIfNotSleepyAction: string | null;
  awakeTooLongAction: string | null;
  notes: string | null;
}

export interface CoachSleepSummary7DContext {
  windowStart: string;
  windowEnd: string;
  validEntryCount: number;
  avgTstMinutes: number | null;
  avgTibMinutes: number | null;
  avgSleepEfficiencyPercent: number | null;
  avgWakeTime: string | null;
  hasMissingRecentDays: boolean;
}

export interface CoachConversationTurnContext {
  role: CoachMessageRecord["role"];
  content: string;
  createdAt: string;
}

export interface CoachPromptContext {
  generatedAt: string;
  activePlan: CoachActivePlanContext;
  sleepSummary7d: CoachSleepSummary7DContext;
  conversationHistory: CoachConversationTurnContext[];
}

type DiaryRow = {
  entry_date: string;
  payload: unknown;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundNumber(value: number | null, digits = 1): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildActivePlanFallback(): CoachActivePlanContext {
  return {
    status: "missing",
    fixedWakeTime: null,
    earliestBedtime: null,
    allowNap: null,
    napLimitMinutes: null,
    sleepIfNotSleepyAction: null,
    awakeTooLongAction: null,
    notes: "当前无计划。AI 只能解释已有计划，不能自行生成新计划。",
  };
}

export function buildActivePlanSummary(
  plan:
    | {
        fixed_wake_time: string;
        earliest_bedtime: string;
        allow_nap: boolean;
        nap_limit_minutes: number | null;
        sleep_if_not_sleepy_action: string | null;
        awake_too_long_action: string | null;
        notes: string | null;
      }
    | null,
): CoachActivePlanContext {
  if (!plan) {
    return buildActivePlanFallback();
  }

  return {
    status: "available",
    fixedWakeTime: plan.fixed_wake_time,
    earliestBedtime: plan.earliest_bedtime,
    allowNap: plan.allow_nap,
    napLimitMinutes: plan.nap_limit_minutes,
    sleepIfNotSleepyAction: plan.sleep_if_not_sleepy_action,
    awakeTooLongAction: plan.awake_too_long_action,
    notes: plan.notes,
  };
}

export function buildConversationHistoryContext(
  messages: CoachMessageRecord[],
  maxTurns = 6,
): CoachConversationTurnContext[] {
  return messages.slice(-maxTurns).map((message) => ({
    role: message.role,
    content: message.content,
    createdAt: message.created_at,
  }));
}

export function summarizeSleepRows7D(
  rows: DiaryRow[],
  windowStart: string,
  windowEnd: string,
): CoachSleepSummary7DContext {
  const tibValues: number[] = [];
  const tstValues: number[] = [];
  const seValues: number[] = [];
  const wakeValues: number[] = [];

  for (const row of rows) {
    const parsed = sleepDiaryPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;

    const metrics = computeNightSleepMetrics({
      lightsOutTime: parsed.data.lights_out_time,
      outOfBedTime: parsed.data.out_of_bed_time,
      sleepOnsetLatencyMin: parsed.data.sleep_latency_min,
      nightWakeDurationMin: parsed.data.night_wake_duration_min,
      daytimeNapMin: parsed.data.daytime_nap_min,
    });
    if (!metrics) continue;

    const wakeMinutes = parseTimeToMinutes(parsed.data.out_of_bed_time);
    if (wakeMinutes === null) continue;

    tibValues.push(metrics.timeInBedMinutes);
    tstValues.push(metrics.estimatedNightSleepMinutes);
    seValues.push(metrics.sleepEfficiencyPercent);
    wakeValues.push(wakeMinutes);
  }

  return {
    windowStart,
    windowEnd,
    validEntryCount: tibValues.length,
    avgTstMinutes: roundNumber(average(tstValues)),
    avgTibMinutes: roundNumber(average(tibValues)),
    avgSleepEfficiencyPercent: roundNumber(average(seValues)),
    avgWakeTime:
      wakeValues.length > 0
        ? formatMinutesAsHHMM(Math.round(average(wakeValues) ?? 0))
        : null,
    hasMissingRecentDays: rows.length < 7 || tibValues.length < 7,
  };
}

export async function buildCoachPromptContext(
  userId: string,
  options: { conversationId?: string | null; maxHistoryTurns?: number } = {},
): Promise<CoachPromptContext> {
  const supabase = await createClient();
  const planDate = await getPlanCalendarDateForUser(supabase, userId);

  const activePlanResult = await fetchActiveSleepPlan(supabase, userId, planDate);
  if (activePlanResult.error) {
    throw new Error(activePlanResult.error);
  }

  const { start, end } = sevenDayWindowInclusive(planDate);
  const { data: rows, error: diaryError } = await supabase
    .from("sleep_diary_entries")
    .select("entry_date, payload")
    .eq("user_id", userId)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true });

  if (diaryError) {
    throw new Error(diaryError.message);
  }

  const conversation = options.conversationId
    ? await getConversationWithMessages(userId, options.conversationId)
    : null;

  return {
    generatedAt: new Date().toISOString(),
    activePlan: buildActivePlanSummary(activePlanResult.data),
    sleepSummary7d: summarizeSleepRows7D(
      (rows ?? []) as DiaryRow[],
      start,
      end,
    ),
    conversationHistory: buildConversationHistoryContext(
      conversation?.messages ?? [],
      options.maxHistoryTurns ?? 6,
    ),
  };
}
