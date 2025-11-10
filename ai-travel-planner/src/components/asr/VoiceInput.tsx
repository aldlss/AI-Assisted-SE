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
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SRInstance | null>(null);

  useEffect(() => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev: unknown) => {
      const e = ev as { resultIndex: number; results: ArrayLike<{ 0?: { transcript?: string } }> };
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0]?.transcript || "";
      }
      setResult(text);
    };
    rec.onerror = (ev: unknown) => {
      const err = (ev as { error?: string })?.error;
      setError(err || "语音识别错误");
      setRecording(false);
    };
    rec.onend = () => {
      setRecording(false);
      if (onText && result.trim()) onText(result.trim());
    };
    recognitionRef.current = rec;
    // 清理
    return () => {
      try { rec.stop(); } catch {}
    };
  }, [onText, result, SR]);

  const start = () => {
    setError(null);
    setResult("");
    try {
      recognitionRef.current?.start();
      setRecording(true);
    } catch (e) {
      setError(String(e));
    }
  };
  const stop = () => {
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Card variant="outlined">
      <CardHeader title="语音输入（浏览器识别）" subheader={supported ? "点击开始讲话，点击结束识别" : "当前浏览器不支持 Web Speech API，请更换浏览器或改用文字输入"} />
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
          <Button variant="contained" onClick={start} disabled={!supported || recording}>开始</Button>
          <Button variant="outlined" onClick={stop} disabled={!supported || !recording}>结束</Button>
        </Stack>
        <TextField label="识别结果" value={result} onChange={(e) => setResult(e.target.value)} fullWidth multiline minRows={2} sx={{ mt: 2 }} />
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
      </CardContent>
    </Card>
  );
}
