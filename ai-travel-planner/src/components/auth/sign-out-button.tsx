"use client";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  async function onClick() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.reload();
  }
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      退出登录
    </Button>
  );
}
