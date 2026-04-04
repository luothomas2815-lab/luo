import {
  sleepDiaryPayloadSchema,
  type SleepDiaryPayload,
} from "@/lib/diary/schema";

/** 从数据库 payload（可能含 metrics）解析为表单字段 */
export function parseStoredDiaryPayload(
  payload: unknown,
): SleepDiaryPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = { ...(payload as Record<string, unknown>) };
  delete raw.metrics;
  delete raw.metrics_version;
  const r = sleepDiaryPayloadSchema.safeParse(raw);
  return r.success ? r.data : null;
}
