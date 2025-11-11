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
          // 简化：邮箱+密码，不再使用 PKCE / 回调码交换
          flowType: "implicit",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
      },
  });
}
