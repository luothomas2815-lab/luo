/**
 * Edge Middleware 用：刷新 Supabase 会话 Cookie，并做最简路由保护。
 * 不写业务库查询（如筛查状态）；复杂逻辑放在页面 / layout / Server Action。
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { shouldBypassAuthForCoachE2E } from "@/lib/e2e/coach-fixture-guard";
import { getSupabasePublicEnv } from "@/lib/supabase/env-public";

const PROTECTED_PREFIXES = ["/app", "/onboarding"] as const;

function needsAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) =>
    pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // 刷新会话：会按需写回 Cookie
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  if (
    shouldBypassAuthForCoachE2E({
      pathname,
      host: request.headers.get("host"),
    })
  ) {
    return supabaseResponse;
  }

  if (!user && needsAuth(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (
    user &&
    (pathname === "/login" || pathname === "/register")
  ) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return supabaseResponse;
}
