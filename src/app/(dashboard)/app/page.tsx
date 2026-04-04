import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "应用",
};

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">应用首页</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        你已登录。这里是最小认证闭环的占位页面，后续再接入业务模块。
      </p>
      <p className="mt-2 text-xs text-zinc-500">{user.email}</p>
      <div className="mt-6">
        <Link
          href="/app/coach"
          className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          问 AI 教练
        </Link>
      </div>
    </div>
  );
}
