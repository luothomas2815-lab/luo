/**
 * 仅 Supabase「公开」配置：URL + anon key。
 * 浏览器与 Edge/服务端会话刷新均应使用此二者，不得把 service_role 编入客户端或 NEXT_PUBLIC_*。
 */

export function getSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY，请复制 .env.example 为 .env.local 并填写。",
    );
  }

  return { url: url.trim(), anonKey: anonKey.trim() };
}
