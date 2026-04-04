import { signOut } from "@/app/actions/auth";
import {
  COACH_E2E_FIXTURE_HEADER,
  shouldUseCoachFixtureByHeader,
} from "@/lib/e2e/coach-fixture-guard";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppSectionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 仅 E2E：由 proxy 在 /app/coach* 请求上注入内部 header 后才会放行。
  if (
    shouldUseCoachFixtureByHeader({
      headerValue: (await headers()).get(COACH_E2E_FIXTURE_HEADER),
    })
  ) {
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 bg-zinc-50 p-6">{children}</main>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/app");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-end gap-4 border-b border-zinc-200 bg-white px-4 py-3">
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-700 underline underline-offset-2"
          >
            登出
          </button>
        </form>
      </header>
      <main className="flex-1 bg-zinc-50 p-6">{children}</main>
    </div>
  );
}
