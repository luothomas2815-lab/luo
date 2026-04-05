import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function safeInternalPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/app";
  }
  return next;
}

function buildLoginRedirectUrl(request: Request, next: string, error?: string): URL {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", next);
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeInternalPath(String(form.get("next") ?? "/app"));

  if (!email || !password) {
    return NextResponse.redirect(
      buildLoginRedirectUrl(request, next, "请输入邮箱和密码"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.redirect(
      buildLoginRedirectUrl(request, next, error.message),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
