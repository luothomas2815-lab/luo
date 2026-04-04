"use server";

import { createClient } from "@/lib/supabase/server";
import { classifyScreeningRisk } from "@/lib/screening/risk";
import {
  type ScreeningAnswers,
  screeningAnswersSchema,
} from "@/lib/screening/schema";
import { redirect } from "next/navigation";

export type SubmitScreeningResult =
  | {
      ok: true;
      destination: "/onboarding/care" | "/onboarding/done" | "/app";
    }
  | { ok: false; error: string };

export async function submitScreening(
  answers: ScreeningAnswers,
): Promise<SubmitScreeningResult> {
  const parsed = screeningAnswersSchema.safeParse(answers);
  if (!parsed.success) {
    return { ok: false, error: "请检查各步填写是否完整" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const risk = classifyScreeningRisk(parsed.data);

  const { error } = await supabase.from("sleep_screenings").insert({
    user_id: user.id,
    responses: parsed.data,
    risk_level: risk.level,
    risk_flags: risk.flags,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, destination: "/app" };
    }
    return { ok: false, error: error.message };
  }

  if (risk.level === "high") {
    return { ok: true, destination: "/onboarding/care" };
  }
  return { ok: true, destination: "/onboarding/done" };
}
