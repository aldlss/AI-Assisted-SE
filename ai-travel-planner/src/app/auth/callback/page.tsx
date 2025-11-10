"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token") || url.searchParams.get("access_token");
    const refreshToken = hash.get("refresh_token") || url.searchParams.get("refresh_token");

    const fail = (msg: string) => router.replace(`/auth/sign-in?error=${encodeURIComponent(msg)}`);

    (async () => {
      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) return fail(error.message);
          return router.replace("/");
        }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) return fail(error.message);
          return router.replace("/");
        }
        return fail("回调参数不完整");
      } catch (e) {
        return fail(String(e));
      }
    })();
  }, [router, code]);

  return <p className="text-sm text-gray-700">正在完成登录...</p>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-700">正在完成登录...</p>}>
      <Inner />
    </Suspense>
  );
}
