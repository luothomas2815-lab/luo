"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const registerSchema = z
  .object({
    email: z.string().email("请输入有效的邮箱地址"),
    password: z
      .string()
      .min(8, "密码至少 8 位")
      .regex(/[A-Z]/, "密码需包含至少一个大写字母")
      .regex(/[0-9]/, "密码需包含至少一个数字"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormData) {
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { data: result, error: err } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    if (err) {
      setError(err.message);
      return;
    }
    if (result.session) {
      setInfo("注册成功，正在进入应用…");
      window.location.assign("/app");
      return;
    }
    // 未开启邮箱验证时 session 会是 null，提示用户查收邮件
    setInfo(
      "注册成功！若项目开启了邮箱验证，请查收邮件完成验证后再登录。",
    );
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
        <span className="text-zinc-700">密码（至少 8 位，含大写字母和数字）</span>
        <input
          type="password"
          autoComplete="new-password"
          {...register("password")}
          className="rounded border border-zinc-300 px-3 py-2"
        />
        {errors.password && (
          <span className="text-xs text-red-500">{errors.password.message}</span>
        )}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-700">确认密码</span>
        <input
          type="password"
          autoComplete="new-password"
          {...register("confirmPassword")}
          className="rounded border border-zinc-300 px-3 py-2"
        />
        {errors.confirmPassword && (
          <span className="text-xs text-red-500">
            {errors.confirmPassword.message}
          </span>
        )}
      </label>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="text-sm text-zinc-700" role="status">
          {info}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "提交中…" : "注册"}
      </button>
      <p className="text-center text-sm text-zinc-600">
        已有账号？{" "}
        <Link href="/login" className="underline">
          登录
        </Link>
      </p>
    </form>
  );
}
