"use client";

import { submitScreening } from "@/app/actions/screening";
import type { ScreeningAnswers } from "@/lib/screening/schema";
import {
  anxietyMoodValues,
  daytimeImpactValues,
  insomniaDurationValues,
  mainSymptomValues,
  sleepAidsAlcoholValues,
  snoringChokingValues,
  validateScreeningStep,
  type ScreeningStepIndex,
} from "@/lib/screening/schema";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STEP_COUNT = 5;

const insomniaLabels: Record<(typeof insomniaDurationValues)[number], string> =
  {
    under_1_month: "少于 1 个月",
    one_to_three_months: "1～3 个月",
    three_to_six_months: "3～6 个月",
    over_six_months: "6 个月以上",
  };

const symptomLabels: Record<(typeof mainSymptomValues)[number], string> = {
  fall_asleep_hard: "难以入睡",
  wake_often: "夜间易醒、难再睡",
  wake_early: "比期望时间早醒",
  unrefreshed: "睡够仍觉疲惫",
};

const daytimeLabels: Record<(typeof daytimeImpactValues)[number], string> = {
  mild: "较轻：偶尔犯困，影响不大",
  moderate: "中等：注意力、情绪受一定影响",
  severe: "严重：明显影响工作/学习/驾驶等",
};

const snoringLabels: Record<(typeof snoringChokingValues)[number], string> = {
  yes: "有",
  no: "没有",
  unsure: "不确定",
};

const moodLabels: Record<(typeof anxietyMoodValues)[number], string> = {
  no: "没有或很轻",
  some: "有时明显",
  marked: "经常明显 / 影响生活",
};

const aidsLabels: Record<(typeof sleepAidsAlcoholValues)[number], string> = {
  none: "没有",
  occasional: "偶尔（如每周少于 2 次）",
  regular: "经常或长期依赖",
};

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<ScreeningStepIndex>(0);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [insomnia_duration, setInsomniaDuration] =
    useState<ScreeningAnswers["insomnia_duration"] | null>(null);
  const [main_symptoms, setMainSymptoms] = useState<
    ScreeningAnswers["main_symptoms"]
  >([]);
  const [daytime_impact, setDaytimeImpact] = useState<
    ScreeningAnswers["daytime_impact"] | null
  >(null);
  const [snoring_choking, setSnoringChoking] = useState<
    ScreeningAnswers["snoring_choking"] | null
  >(null);
  const [anxiety_mood, setAnxietyMood] = useState<
    ScreeningAnswers["anxiety_mood"] | null
  >(null);
  const [sleep_aids_alcohol, setSleepAidsAlcohol] = useState<
    ScreeningAnswers["sleep_aids_alcohol"] | null
  >(null);

  function toggleSymptom(v: ScreeningAnswers["main_symptoms"][number]) {
    setMainSymptoms((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }

  function buildPartial(s: ScreeningStepIndex): unknown {
    switch (s) {
      case 0:
        return insomnia_duration ? { insomnia_duration } : {};
      case 1:
        return { main_symptoms };
      case 2:
        return daytime_impact ? { daytime_impact } : {};
      case 3:
        return snoring_choking ? { snoring_choking } : {};
      case 4:
        return anxiety_mood && sleep_aids_alcohol
          ? { anxiety_mood, sleep_aids_alcohol }
          : {};
      default:
        return {};
    }
  }

  function goNext() {
    setFormError(null);
    const partial = buildPartial(step);
    const result = validateScreeningStep(step, partial);
    if (!result.success) {
      const msg = result.error.issues[0]?.message ?? "请完成本步";
      setFormError(msg);
      return;
    }
    if (step < 4) {
      setStep((s) => (s + 1) as ScreeningStepIndex);
    }
  }

  function goBack() {
    setFormError(null);
    if (step > 0) {
      setStep((s) => (s - 1) as ScreeningStepIndex);
    }
  }

  async function handleSubmit() {
    setFormError(null);
    const partial = buildPartial(4);
    const last = validateScreeningStep(4, partial);
    if (!last.success) {
      setFormError(last.error.issues[0]?.message ?? "请完成本步");
      return;
    }
    if (
      !insomnia_duration ||
      !daytime_impact ||
      !snoring_choking ||
      !anxiety_mood ||
      !sleep_aids_alcohol
    ) {
      setFormError("信息不完整");
      return;
    }
    const answers: ScreeningAnswers = {
      insomnia_duration,
      main_symptoms,
      daytime_impact,
      snoring_choking,
      anxiety_mood,
      sleep_aids_alcohol,
    };

    setPending(true);
    const res = await submitScreening(answers);
    setPending(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    router.push(res.destination);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col px-4 pb-10 pt-6">
      <p className="text-center text-xs font-medium text-zinc-500">
        第 {step + 1} / {STEP_COUNT} 步
      </p>
      <div className="mt-2 flex justify-center gap-1.5">
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 max-w-10 rounded-full ${
              i <= step ? "bg-zinc-900" : "bg-zinc-200"
            }`}
          />
        ))}
      </div>

      <h1 className="mt-8 text-lg font-semibold leading-snug text-zinc-900">
        {step === 0 && "你受失眠困扰大概多久了？"}
        {step === 1 && "目前最困扰你的主要是？（可多选）"}
        {step === 2 && "白天困倦、精力差等问题，对你影响有多大？"}
        {step === 3 && "是否有打鼾较响、或睡眠中憋醒的情况？"}
        {step === 4 && "情绪与物质使用（如实选择即可）"}
      </h1>

      <div className="mt-6 flex flex-1 flex-col gap-3">
        {step === 0 && (
          <div className="flex flex-col gap-2">
            {insomniaDurationValues.map((v) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center rounded-xl border px-4 py-3 text-base active:bg-zinc-50 ${
                  insomnia_duration === v
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="insomnia_duration"
                  className="sr-only"
                  checked={insomnia_duration === v}
                  onChange={() => setInsomniaDuration(v)}
                />
                {insomniaLabels[v]}
              </label>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-2">
            {mainSymptomValues.map((v) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center rounded-xl border px-4 py-3 text-base active:bg-zinc-50 ${
                  main_symptoms.includes(v)
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={main_symptoms.includes(v)}
                  onChange={() => toggleSymptom(v)}
                />
                {symptomLabels[v]}
              </label>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            {daytimeImpactValues.map((v) => (
              <label
                key={v}
                className={`flex cursor-pointer rounded-xl border px-4 py-3 text-base leading-snug active:bg-zinc-50 ${
                  daytime_impact === v
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="daytime"
                  className="sr-only"
                  checked={daytime_impact === v}
                  onChange={() => setDaytimeImpact(v)}
                />
                {daytimeLabels[v]}
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-2">
            {snoringChokingValues.map((v) => (
              <label
                key={v}
                className={`flex cursor-pointer items-center rounded-xl border px-4 py-3 text-base active:bg-zinc-50 ${
                  snoring_choking === v
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200"
                }`}
              >
                <input
                  type="radio"
                  name="snoring"
                  className="sr-only"
                  checked={snoring_choking === v}
                  onChange={() => setSnoringChoking(v)}
                />
                {snoringLabels[v]}
              </label>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-800">
                最近是否常感到明显焦虑或情绪低落？
              </p>
              <div className="flex flex-col gap-2">
                {anxietyMoodValues.map((v) => (
                  <label
                    key={v}
                    className={`flex cursor-pointer rounded-xl border px-4 py-3 text-base active:bg-zinc-50 ${
                      anxiety_mood === v
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="mood"
                      className="sr-only"
                      checked={anxiety_mood === v}
                      onChange={() => setAnxietyMood(v)}
                    />
                    {moodLabels[v]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-800">
                是否使用处方助眠药、非处方安眠药或靠饮酒助眠？
              </p>
              <div className="flex flex-col gap-2">
                {sleepAidsAlcoholValues.map((v) => (
                  <label
                    key={v}
                    className={`flex cursor-pointer rounded-xl border px-4 py-3 text-base leading-snug active:bg-zinc-50 ${
                      sleep_aids_alcohol === v
                        ? "border-zinc-900 bg-zinc-50"
                        : "border-zinc-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="aids"
                      className="sr-only"
                      checked={sleep_aids_alcohol === v}
                      onChange={() => setSleepAidsAlcohol(v)}
                    />
                    {aidsLabels[v]}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {formError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="mt-8 flex gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="flex-1 rounded-xl border border-zinc-300 py-3.5 text-base font-medium text-zinc-800"
          >
            上一步
          </button>
        ) : (
          <div className="flex-1" />
        )}
        {step < 4 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex-1 rounded-xl bg-zinc-900 py-3.5 text-base font-medium text-white"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-xl bg-zinc-900 py-3.5 text-base font-medium text-white disabled:opacity-60"
          >
            {pending ? "提交中…" : "提交"}
          </button>
        )}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">
        本问卷仅用于自我管理场景，不能替代诊疗。请勿在此填写具体药物剂量或自行调药。
      </p>
    </div>
  );
}
