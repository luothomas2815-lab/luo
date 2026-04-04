import { RegisterForm } from "@/components/auth/register-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "注册",
};

export default async function RegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-xl font-semibold text-zinc-900">注册</h1>
      <RegisterForm />
    </div>
  );
}
