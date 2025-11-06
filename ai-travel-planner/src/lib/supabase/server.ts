import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// 注意：在 Server Component 中不允许修改 cookies，仅读取即可。
// 若需要设置/移除 cookies，请在 Route Handler 或 Server Action 中使用专用 client。
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // 在 Server Component 中禁止修改 cookies，避免 Next.js 报错
      set(name: string, value: string, options: CookieOptions) {
        void name; void value; void options; // no-op
      },
      remove(name: string, options: CookieOptions) {
        void name; void options; // no-op
      },
    },
    auth: {
      // 服务端仅读取，不要在 RSC 中持久化或自动刷新，以避免写 cookie
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// 专用于 Route Handler / Server Action：允许读写 cookies
export async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set(name, value, options);
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set(name, "", { ...options, maxAge: 0 });
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
