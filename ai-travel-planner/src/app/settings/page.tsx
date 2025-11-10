"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// 简易设置页：将 Key 存在浏览器 localStorage（仅用于本机开发调试）。
// 生产中建议仅输入服务端使用的 Key（例如 DASHSCOPE_API_KEY），不要持久化在本地。

const LS_AMAP = "amap_key";
const LS_DASH = "dashscope_key";

export default function SettingsPage() {
  const [amapKey, setAmapKey] = useState<string>(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(LS_AMAP) || ""
  );
  const [dashKey, setDashKey] = useState<string>(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(LS_DASH) || ""
  );
  const [saved, setSaved] = useState<string | null>(null);

  function save() {
    localStorage.setItem(LS_AMAP, amapKey);
    localStorage.setItem(LS_DASH, dashKey);
    setSaved("已保存（仅保存在当前浏览器）");
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-semibold">设置</h1>
        <Card>
          <CardHeader>
            <CardTitle>第三方服务 Key</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              label="高德地图 Key（浏览器用）"
              placeholder="NEXT_PUBLIC_AMAP_KEY（可从环境变量注入）"
              value={amapKey}
              onChange={(e) => setAmapKey(e.target.value)}
            />
            <Input
              label="阿里云百炼 DashScope API Key（建议服务端使用）"
              placeholder="DASHSCOPE_API_KEY（不建议存本地）"
              value={dashKey}
              onChange={(e) => setDashKey(e.target.value)}
            />
            <div>
              <Button onClick={save}>保存</Button>
              {saved && <span className="ml-3 text-sm text-green-700">{saved}</span>}
            </div>
            <p className="text-xs text-gray-500">
              开发提示：也可以通过 `.env.local` 注入上述变量，生产环境请勿在前端保存私密 Key。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
