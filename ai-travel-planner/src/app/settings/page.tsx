"use client";
import { useState } from "react";
import Container from "@mui/material/Container";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

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
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 3 }}>设置</Typography>
      <Card variant="outlined">
        <CardHeader title="第三方服务 Key" subheader="仅用于本地开发调试，生产环境请放服务端" />
        <CardContent sx={{ display: "grid", gap: 2 }}>
          <TextField
            label="高德地图 Key（浏览器用）"
            placeholder="NEXT_PUBLIC_AMAP_KEY（可从环境变量注入）"
            value={amapKey}
            onChange={(e) => setAmapKey(e.target.value)}
            fullWidth
          />
          <TextField
            label="阿里云百炼 DashScope API Key（建议服务端使用）"
            placeholder="DASHSCOPE_API_KEY（不建议存本地）"
            value={dashKey}
            onChange={(e) => setDashKey(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={save}>保存</Button>
          {saved && <Alert severity="success" variant="outlined">{saved}</Alert>}
          <Typography variant="caption" color="text.secondary">
            开发提示：也可以通过 `.env.local` 注入上述变量，生产环境请勿在前端保存私密 Key。
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
