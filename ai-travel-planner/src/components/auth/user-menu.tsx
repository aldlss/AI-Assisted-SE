"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/auth/sign-out-button";
import Button from "@mui/material/Button";

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // 读取当前用户
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    // 监听登出或切换
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!email) {
    return (
        <Button
            component={Link}
            href="/auth/sign-in"
            variant="contained"
            size="small">
            登录
        </Button>
    );
  }
  return (
      <div className="flex items-center gap-3">
          <span className="text-(--neutral-700) font-medium">{email}</span>
          <SignOutButton />
      </div>
  );
}
