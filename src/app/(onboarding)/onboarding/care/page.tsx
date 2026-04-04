import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "进一步评估建议",
};

export default async function OnboardingCarePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: row } = await supabase
    .from("sleep_screenings")
    .select("risk_level")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    redirect("/onboarding");
  }
  if (row.risk_level !== "high") {
    redirect("/onboarding/done");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-lg font-semibold text-zinc-900">建议线下就医 / 进一步评估</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-700">
        根据你的回答，存在需要重视的因素（如明显情绪困扰、呼吸相关症状、物质使用或长期严重失眠等）。
        本应用不能替代面对面诊疗，建议你尽快咨询<strong>睡眠医学</strong>、<strong>精神心理</strong>或<strong>全科</strong>医生，做进一步评估与个体化方案。
      </p>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600">
        若你有伤害自己或他人的想法，请立即联系当地急救或危机热线。
      </p>
      <Link
        href="/app"
        className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-6 text-base font-medium text-white"
      >
        我已了解，进入应用
      </Link>
      <p className="mt-4 text-center text-xs text-zinc-400">
        进入应用后仍仅提供自我管理工具，不提供药物或诊断建议。
      </p>
    </div>
  );
}
