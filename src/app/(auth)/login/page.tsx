import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = {
  title: "登录",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-xl font-semibold text-zinc-900">登录</h1>
      <Suspense fallback={<p className="text-center text-sm text-zinc-500">加载中…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
