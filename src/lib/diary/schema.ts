import { z } from "zod";

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式为 HH:mm");

export const caffeineLevels = ["none", "light", "moderate", "high"] as const;
export const alcoholLevels = ["none", "light", "moderate", "high"] as const;

/** 单日主记录 payload（存入 sleep_diary_entries.payload） */
export const sleepDiaryPayloadSchema = z.object({
  bed_time: hhmm,
  lights_out_time: hhmm,
  sleep_latency_min: z.coerce
    .number({ message: "请填写入睡耗时" })
    .int()
    .min(0, "不能为负")
    .max(240, "请确认入睡耗时（≤240 分钟）"),
  night_wake_count: z.coerce
    .number({ message: "请填写夜醒次数" })
    .int()
    .min(0)
    .max(50),
  night_wake_duration_min: z.coerce
    .number({ message: "请填写夜醒总时长" })
    .int()
    .min(0)
    .max(24 * 60),
  final_awakening_time: hhmm,
  out_of_bed_time: hhmm,
  daytime_nap_min: z.coerce
    .number({ message: "请填写小睡时长" })
    .int()
    .min(0)
    .max(24 * 60),
  caffeine: z.enum(caffeineLevels),
  alcohol: z.enum(alcoholLevels),
  daytime_energy: z.coerce
    .number({ message: "请评分" })
    .int()
    .min(1)
    .max(5),
});

export type SleepDiaryPayload = z.output<typeof sleepDiaryPayloadSchema>;

export const sleepDiaryFormSchema = sleepDiaryPayloadSchema.extend({
  entry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式为 YYYY-MM-DD"),
});

export type SleepDiaryFormValues = z.output<typeof sleepDiaryFormSchema>;
