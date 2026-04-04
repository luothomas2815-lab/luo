/**
 * 服务端 Supabase 客户端（Server Components / Server Actions / Route Handlers）。
 * 使用 Cookie 中的会话；与 middleware 中的刷新配合，维持登录态。
 * 本封装仍只使用 anon key（RLS 生效）；勿将 service_role 暴露给浏览器。
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase/env-public";

export async function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component 中无法 set cookie 时静默；依赖 middleware 刷新会话
        }
      },
    },
  });
}
