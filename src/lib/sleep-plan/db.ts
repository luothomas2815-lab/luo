/**
 * sleep_plans 表读取与行映射（无业务规则）。
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SleepPlanRecord } from "@/lib/sleep-plan/types";

/** Postgres time 可能为 HH:mm:ss，统一为 HH:mm 展示 */
export function normalizePgTime(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function mapSleepPlanRow(row: Record<string, unknown>): SleepPlanRecord {
  const ruleInputs = row.rule_inputs;
  const ruleOutputs = row.rule_outputs;
  const ids = row.based_on_entry_ids;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    plan_date: String(row.plan_date),
    source_window_start: String(row.source_window_start),
    source_window_end: String(row.source_window_end),
    based_on_entry_count: Number(row.based_on_entry_count ?? 0),
    based_on_entry_ids: Array.isArray(ids)
      ? (ids as unknown[]).map((x) => String(x))
      : [],
    status: row.status === "superseded" ? "superseded" : "active",
    fixed_wake_time: normalizePgTime(row.fixed_wake_time),
    earliest_bedtime: normalizePgTime(row.earliest_bedtime),
    allow_nap: Boolean(row.allow_nap),
    nap_limit_minutes:
      row.nap_limit_minutes === null || row.nap_limit_minutes === undefined
        ? null
        : Number(row.nap_limit_minutes),
    sleep_if_not_sleepy_action:
      row.sleep_if_not_sleepy_action === null ||
      row.sleep_if_not_sleepy_action === undefined
        ? null
        : String(row.sleep_if_not_sleepy_action),
    awake_too_long_action:
      row.awake_too_long_action === null ||
      row.awake_too_long_action === undefined
        ? null
        : String(row.awake_too_long_action),
    notes:
      row.notes === null || row.notes === undefined ? null : String(row.notes),
    rule_version: String(row.rule_version),
    rule_inputs:
      ruleInputs && typeof ruleInputs === "object" && !Array.isArray(ruleInputs)
        ? (ruleInputs as Record<string, unknown>)
        : {},
    rule_outputs:
      ruleOutputs && typeof ruleOutputs === "object" && !Array.isArray(ruleOutputs)
        ? (ruleOutputs as Record<string, unknown>)
        : {},
    created_by: row.created_by === "manual" ? "manual" : "rules_engine",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function fetchActiveSleepPlan(
  supabase: SupabaseClient,
  userId: string,
  planDate: string,
): Promise<{ data: SleepPlanRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from("sleep_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_date", planDate)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }
  if (!data || typeof data !== "object") {
    return { data: null, error: null };
  }
  return {
    data: mapSleepPlanRow(data as Record<string, unknown>),
    error: null,
  };
}

export async function fetchSleepPlanById(
  supabase: SupabaseClient,
  planId: string,
): Promise<{ data: SleepPlanRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from("sleep_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }
  if (!data || typeof data !== "object") {
    return { data: null, error: null };
  }
  return {
    data: mapSleepPlanRow(data as Record<string, unknown>),
    error: null,
  };
}
