"use client";

import { upsertSleepDiary } from "@/app/actions/diary";
import { yesterdayLocalDateString } from "@/lib/diary/dates";
import { parseStoredDiaryPayload } from "@/lib/diary/stored";
import {
  alcoholLevels,
  caffeineLevels,
  sleepDiaryFormSchema,
  type SleepDiaryFormValues,
} from "@/lib/diary/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Resolver } from "react-hook-form";
import { useForm, useWatch } from "react-hook-form";

const defaults: SleepDiaryFormValues = {
  entry_date: yesterdayLocalDateString(),
  bed_time: "23:00",
  lights_out_time: "23:15",
  sleep_latency_min: 20,
  night_wake_count: 1,
  night_wake_duration_min: 20,
  final_awakening_time: "06:30",
  out_of_bed_time: "07:00",
  daytime_nap_min: 0,
  caffeine: "none",
  alcohol: "none",
  daytime_energy: 3,
};

const caffeineLabel: Record<(typeof caffeineLevels)[number], string> = {
  none: "无/几乎无",
  light: "少量",
  moderate: "中等",
  high: "较多",
};

const alcoholLabel: Record<(typeof alcoholLevels)[number], string> = {
  none: "无",
  light: "少量",
  moderate: "中等",
  high: "较多",
};

type DiaryFormProps = {
  defaultEntryDate: string;
  /** 编辑时传入数据库中的 payload */
  initialPayload?: unknown;
};

export function DiaryForm({ defaultEntryDate, initialPayload }: DiaryFormProps) {
  const router = useRouter();
  const [rootError, setRootError] = useState<string | null>(null);

  const mergedDefaults = useMemo(() => {
    const parsed = initialPayload
      ? parseStoredDiaryPayload(initialPayload)
      : null;
    return {
      ...defaults,
      entry_date: defaultEntryDate,
      ...parsed,
    };
  }, [defaultEntryDate, initialPayload]);

  const form = useForm<SleepDiaryFormValues>({
    resolver: zodResolver(
      sleepDiaryFormSchema,
    ) as Resolver<SleepDiaryFormValues>,
    defaultValues: mergedDefaults,
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const daytimeEnergy = useWatch({
    control,
    name: "daytime_energy",
    defaultValue: mergedDefaults.daytime_energy,
  });

  useEffect(() => {
    reset(mergedDefaults);
  }, [mergedDefaults, reset]);

  async function onSubmit(data: SleepDiaryFormValues) {
    setRootError(null);
    const res = await upsertSleepDiary(data);
    if (res.ok) {
      router.push("/app/diary");
      router.refresh();
      return;
    }
    if (res.kind === "validation" && res.fieldErrors) {
      for (const [key, msgs] of Object.entries(res.fieldErrors)) {
        if (msgs[0]) {
          setError(key as keyof SleepDiaryFormValues, { message: msgs[0] });
        }
      }
    }
    setRootError(res.message);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-12 pt-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">记录日期（主睡眠夜）</span>
          <input
            type="date"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-base"
            {...register("entry_date")}
          />
          {errors.entry_date ? (
            <span className="text-xs text-red-600">{errors.entry_date.message}</span>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => setValue("entry_date", yesterdayLocalDateString())}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700"
        >
          补填昨晚
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">夜间</h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">上床时间</span>
          <input
            type="time"
            className="rounded-lg border border-zinc-300 px-3 py-3 text-base"
            {...register("bed_time")}
          />
          {errors.bed_time ? (
            <span className="text-xs text-red-600">{errors.bed_time.message}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">关灯时间</span>
          <input type="time" className="rounded-lg border border-zinc-300 px-3 py-3 text-base" {...register("lights_out_time")} />
          {errors.lights_out_time ? (
            <span className="text-xs text-red-600">{errors.lights_out_time.message}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">估计入睡耗时（分钟）</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            className="rounded-lg border border-zinc-300 px-3 py-3 text-base"
            {...register("sleep_latency_min", { valueAsNumber: true })}
          />
          {errors.sleep_latency_min ? (
            <span className="text-xs text-red-600">{errors.sleep_latency_min.message}</span>
          ) : null}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-600">夜醒次数</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="rounded-lg border border-zinc-300 px-3 py-3 text-base"
              {...register("night_wake_count", { valueAsNumber: true })}
            />
            {errors.night_wake_count ? (
              <span className="text-xs text-red-600">{errors.night_wake_count.message}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-600">夜醒总时长（分）</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className="rounded-lg border border-zinc-300 px-3 py-3 text-base"
              {...register("night_wake_duration_min", { valueAsNumber: true })}
            />
            {errors.night_wake_duration_min ? (
              <span className="text-xs text-red-600">
                {errors.night_wake_duration_min.message}
              </span>
            ) : null}
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">最终醒来时间</span>
          <input type="time" className="rounded-lg border border-zinc-300 px-3 py-3 text-base" {...register("final_awakening_time")} />
          {errors.final_awakening_time ? (
            <span className="text-xs text-red-600">{errors.final_awakening_time.message}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">起床离床时间</span>
          <input type="time" className="rounded-lg border border-zinc-300 px-3 py-3 text-base" {...register("out_of_bed_time")} />
          {errors.out_of_bed_time ? (
            <span className="text-xs text-red-600">{errors.out_of_bed_time.message}</span>
          ) : null}
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">白天</h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">小睡（分钟）</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className="rounded-lg border border-zinc-300 px-3 py-3 text-base"
            {...register("daytime_nap_min", { valueAsNumber: true })}
          />
          {errors.daytime_nap_min ? (
            <span className="text-xs text-red-600">{errors.daytime_nap_min.message}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">咖啡因</span>
          <select className="rounded-lg border border-zinc-300 px-3 py-3 text-base" {...register("caffeine")}>
            {caffeineLevels.map((v) => (
              <option key={v} value={v}>
                {caffeineLabel[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">酒精</span>
          <select className="rounded-lg border border-zinc-300 px-3 py-3 text-base" {...register("alcohol")}>
            {alcoholLevels.map((v) => (
              <option key={v} value={v}>
                {alcoholLabel[v]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-600">白天精神（1～5，越高越好）</span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            className="w-full"
            {...register("daytime_energy", { valueAsNumber: true, min: 1, max: 5 })}
          />
          <span className="text-center text-sm text-zinc-700">
            {daytimeEnergy ?? "—"}
          </span>
          {errors.daytime_energy ? (
            <span className="text-xs text-red-600">{errors.daytime_energy.message}</span>
          ) : null}
        </label>
      </section>

      {rootError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {rootError}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        <Link
          href="/app/diary"
          className="flex flex-1 items-center justify-center rounded-xl border border-zinc-300 py-3.5 text-center text-sm font-medium text-zinc-800"
        >
          取消
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-zinc-900 py-3.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
