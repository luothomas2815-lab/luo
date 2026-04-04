"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(1, "密码不能为空"),
});

type LoginFormData = z.infer<typeof loginSchema>;

function safeInternalPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/app";
  }
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setGlobalError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (err) {
      setGlobalError(err.message);
      return;
    }
    const next = safeInternalPath(searchParams.get("next"));
    router.push(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700">邮箱</span>
        <input
          type="email"
          autoComplete="email"
          {...register("email")}
          className="rounded border border-zinc-300 px-3 py-2"
        />
        {errors.email && (
          <span className="text-xs text-red-500">{errors.email.message}</span>
        )}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700">密码</span>
        <input
          type="password"
          autoComplete="current-password"
          {...register("password")}
          className="rounded border border-zinc-300 px-3 py-2"
        />
        {errors.password && (
          <span className="text-xs text-red-500">{errors.password.message}</span>
        )}
      </label>
      {globalError ? (
        <p className="text-sm text-red-600" role="alert">
          {globalError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "登录中…" : "登录"}
      </button>
      <p className="text-center text-sm text-zinc-600">
        没有账号？{" "}
        <Link href="/register" className="underline">
          注册
        </Link>
      </p>
    </form>
  );
}
