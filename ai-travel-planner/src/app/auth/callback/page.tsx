"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 已废弃：邮箱+密码模式不再需要回调
export default function AuthCallbackPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/auth/sign-in");
    }, [router]);
    return null;
}
