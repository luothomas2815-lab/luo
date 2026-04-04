import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "筛查完成",
};

export default async function OnboardingDonePage() {
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
  if (row.risk_level === "high") {
    redirect("/onboarding/care");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">筛查已完成</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        感谢填写。接下来你可以在应用内记录睡眠、查看计划（后续版本将逐步开放）。
      </p>
      <Link
        href="/app"
        className="mt-8 inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl bg-zinc-900 px-6 text-base font-medium text-white"
      >
        进入应用
      </Link>
    </div>
  );
}
