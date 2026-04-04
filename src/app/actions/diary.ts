"use server";

import { createClient } from "@/lib/supabase/server";
import { computeNightSleepMetrics } from "@/lib/diary/sleep-metrics";
import {
  sleepDiaryFormSchema,
  sleepDiaryPayloadSchema,
} from "@/lib/diary/schema";
import { validateDiaryBusinessRules } from "@/lib/diary/validate-payload";
import { revalidatePath } from "next/cache";

export type UpsertDiaryResult =
  | { ok: true }
  | {
      ok: false;
      kind: "validation" | "business" | "auth" | "database";
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export async function upsertSleepDiary(
  input: unknown,
): Promise<UpsertDiaryResult> {
  const parsed = sleepDiaryFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<
      string,
      string[] | undefined
    >;
    const flat: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      if (v?.length) flat[k] = v;
    }
    return {
      ok: false,
      kind: "validation",
      message: "请检查表单字段",
      fieldErrors: flat,
    };
  }

  const { entry_date, ...rest } = parsed.data;
  const payloadOnly = sleepDiaryPayloadSchema.parse(rest);
  const biz = validateDiaryBusinessRules(payloadOnly);
  if (!biz.ok) {
    return { ok: false, kind: "business", message: biz.message };
  }

  const metrics = computeNightSleepMetrics({
    lightsOutTime: payloadOnly.lights_out_time,
    outOfBedTime: payloadOnly.out_of_bed_time,
    sleepOnsetLatencyMin: payloadOnly.sleep_latency_min,
    nightWakeDurationMin: payloadOnly.night_wake_duration_min,
    daytimeNapMin: payloadOnly.daytime_nap_min,
  });

  const payload = {
    ...payloadOnly,
    metrics: metrics ?? undefined,
    metrics_version: 1 as const,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, kind: "auth", message: "未登录，请重新登录" };
  }

  const { error } = await supabase.from("sleep_diary_entries").upsert(
    {
      user_id: user.id,
      entry_date,
      payload,
      metadata: {},
    },
    { onConflict: "user_id,entry_date" },
  );

  if (error) {
    return {
      ok: false,
      kind: "database",
      message: error.message || "保存失败，请稍后重试",
    };
  }

  revalidatePath("/app/diary");
  revalidatePath("/app");
  return { ok: true };
}

export type DiaryRow = {
  id: string;
  entry_date: string;
  payload: unknown;
};

export async function listSleepDiaryEntries(
  limit = 90,
): Promise<DiaryRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("sleep_diary_entries")
    .select("id, entry_date, payload")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as DiaryRow[];
}

export async function getSleepDiaryByDate(
  entryDate: string,
): Promise<DiaryRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("sleep_diary_entries")
    .select("id, entry_date, payload")
    .eq("user_id", user.id)
    .eq("entry_date", entryDate)
    .maybeSingle();

  if (error || !data) return null;
  return data as DiaryRow;
}
