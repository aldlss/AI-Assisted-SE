"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";

type Props = {
  onText?: (text: string) => void;
};

export function VoiceInput({ onText }: Props) {
  // 是否支持 Web Speech API（仅浏览器侧）
  type SRInstance = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((ev: unknown) => void) | null;
    onerror: ((ev: unknown) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
  type SRConstructor = new () => SRInstance;
  const SR = useMemo<SRConstructor | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const w = window as unknown as {
      SpeechRecognition?: SRConstructor;
      webkitSpeechRecognition?: SRConstructor;
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition;
  }, []);
  const supported = !!SR;
  const [recording, setRecording] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState("");
  const [finalResults, setFinalResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SRInstance | null>(null);
  const userStopRef = useRef(false);
  // 仅在客户端挂载后再启用完整交互，避免 SSR 与水合不一致
  useEffect(() => { setMounted(true); }, []);


  useEffect(() => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN";
  rec.interimResults = true;
  rec.continuous = true; // 连续模式
    rec.onresult = (ev: unknown) => {
      const e = ev as { resultIndex: number; results: ArrayLike<{ 0?: { transcript?: string }, isFinal?: boolean }> };
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const seg = e.results[i];
        const txt = seg[0]?.transcript || "";
        if ((seg as unknown as { isFinal?: boolean }).isFinal) {
          setFinalResults(prev => [...prev, txt]);
        } else {
          interim += txt;
        }
      }
      setResult(interim);
    };
    rec.onerror = (ev: unknown) => {
      const err = (ev as { error?: string })?.error;
      setError(err || "语音识别错误");
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
      if (userStopRef.current) {
        const full = [...finalResults, result].map(s => s.trim()).filter(Boolean).join(" ");
        if (onText && full) onText(full);
        userStopRef.current = false;
        setFinalResults([]);
      } else {
        // 自动结束（浏览器静音超时）时尝试重启，保持长语音不被过早截断
        if (!userStopRef.current && recording) {
          try { rec.start(); } catch {}
        }
      }
    };
    recognitionRef.current = rec;
    // 清理
    return () => {
      try { rec.stop(); } catch {}
    };
  }, [onText, result, SR, finalResults, recording]);

  const start = async () => {
    setError(null);
  setResult("");
  setFinalResults([]);
    try {
      userStopRef.current = false;
      recognitionRef.current?.start();
      setRecording(true);
    } catch (e) {
      setError(String(e));
    }
  };
  const stop = () => {
    try {
      userStopRef.current = true;
      recognitionRef.current?.stop();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Card variant="outlined">
      <CardHeader title="语音输入" subheader="浏览器识别，手动开始/结束" />
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          <Button variant="contained" onClick={start} disabled={!mounted || !supported || recording}>开始</Button>
          <Button variant="outlined" onClick={stop} disabled={!mounted || !recording}>结束</Button>
        </Stack>
        <TextField label="实时片段" value={result} onChange={(e) => setResult(e.target.value)} fullWidth multiline minRows={2} sx={{ mt: 2 }} />
        <TextField label="累计结果" value={[...finalResults, result].join(" ")} fullWidth multiline minRows={2} sx={{ mt: 2 }} />
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        {!mounted && (
          <Alert severity="info" sx={{ mt: 1 }}>控件初始化中…</Alert>
        )}
        {mounted && !supported && (
          <Alert severity="warning" sx={{ mt: 1 }}>当前浏览器不支持语音识别（Web Speech API）。</Alert>
        )}
      </CardContent>
    </Card>
  );
}
