/**
 * 浏览器端 Supabase 客户端（Client Components / 浏览器脚本）。
 * 仅使用 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY。
 */

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env-public";

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
