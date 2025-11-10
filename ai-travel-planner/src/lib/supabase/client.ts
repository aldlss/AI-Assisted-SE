"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.warn("Supabase 环境变量未配置，某些功能将不可用");
  }
  return createBrowserClient(url || "", anon || "", {
    auth: {
      // 使用 PKCE 流程以支持 magic link / OAuth 回调 code 交换
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
