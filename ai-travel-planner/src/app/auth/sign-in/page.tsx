"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 若已登录或登录状态变化，自动跳转到首页，避免停留在登录页
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.replace("/");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.replace("/");
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const initialError = params.get("error");
    if (initialError && !error) {
      // 使用微任务推迟 setState，避免在 render 期间触发
      queueMicrotask(() => setError(initialError));
    }
  }

  async function sendMagicLink() {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // 首次输入邮箱不存在时，允许创建用户并发送注册链接
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent("登录链接已发送到邮箱，请查收并点击链接完成登录。");
    }
  }

  return (
    <div className="min-h-[60vh]">
      <Card>
        <CardHeader>
          <CardTitle>邮箱登录</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            label="邮箱"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div>
            <Button onClick={sendMagicLink} disabled={!email}>
              发送登录链接
            </Button>
          </div>
          {sent && <p className="text-sm text-green-700">{sent}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
