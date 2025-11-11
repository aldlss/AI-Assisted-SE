"use client";
import { useEffect, useRef, useState } from "react";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import { useAuth } from "@/lib/useAuth";

type Props = {
    onText?: (text: string) => void;
    // 页面在生成中时禁用“提交”等操作
    isGenerating?: boolean;
};

export function VoiceInput({ onText, isGenerating = false }: Props) {
    const { user, loading: authLoading } = useAuth();
    const [recording, setRecording] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [text, setText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
        const [submittedOnce, setSubmittedOnce] = useState(false);

    // 录音相关
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const floatChunksRef = useRef<Float32Array[]>([]);
    const inputRateRef = useRef<number>(44100);

    useEffect(() => {
        const id = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(id);
    }, []);

    const micSupported =
        mounted && typeof navigator !== "undefined" && !!navigator.mediaDevices && window.isSecureContext;

    function mergeFloat32(chunks: Float32Array[]): Float32Array {
        const length = chunks.reduce((s, a) => s + a.length, 0);
        const res = new Float32Array(length);
        let offset = 0;
        for (const c of chunks) {
            res.set(c, offset);
            offset += c.length;
        }
        return res;
    }

    function resampleTo16k(input: Float32Array, fromRate: number): Float32Array {
        if (fromRate === 16000) return input;
        const ratio = fromRate / 16000;
        const newLen = Math.max(1, Math.round(input.length / ratio));
        const out = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
            const idx = Math.min(input.length - 1, Math.round(i * ratio));
            out[i] = input[idx];
        }
        return out;
    }

    function floatToPcm16(f32: Float32Array): Int16Array {
        const out = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
            const s = Math.max(-1, Math.min(1, f32[i]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return out;
    }

    function makeWavFromPcm16(pcm16: Int16Array, sampleRate = 16000): ArrayBuffer {
        const buffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(buffer);
        const writeString = (v: string, o: number) => {
            for (let i = 0; i < v.length; i++) view.setUint8(o + i, v.charCodeAt(i));
        };
        writeString("RIFF", 0);
        view.setUint32(4, 36 + pcm16.length * 2, true);
        writeString("WAVE", 8);
        writeString("fmt ", 12);
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString("data", 36);
        view.setUint32(40, pcm16.length * 2, true);
        new Uint8Array(buffer, 44).set(new Uint8Array(pcm16.buffer));
        return buffer;
    }

    const start = async () => {
        setError(null);
        setText("");
        // no-op after removal of auto submit
        if (!micSupported) {
            setError("当前环境不支持麦克风或非 HTTPS");
            return;
        }
        if (!user) {
            setError("请先登录后再使用语音识别");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            const AnyWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
            const AC = AnyWindow.AudioContext || AnyWindow.webkitAudioContext;
            if (!AC) throw new Error("浏览器不支持 AudioContext");
            const ctx = new AC();
            audioCtxRef.current = ctx;
            inputRateRef.current = ctx.sampleRate || 44100;
            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            floatChunksRef.current = [];
            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                floatChunksRef.current.push(new Float32Array(input));
            };
            source.connect(processor);
            processor.connect(ctx.destination);
            setRecording(true);
        } catch (e) {
            setError(String(e));
        }
    };

    const stop = async () => {
        try {
            processorRef.current?.disconnect();
            audioCtxRef.current?.close().catch(() => {});
            mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
            processorRef.current = null;
            audioCtxRef.current = null;
            mediaStreamRef.current = null;
            setRecording(false);

            const merged = mergeFloat32(floatChunksRef.current);
            floatChunksRef.current = [];
            const resampled = resampleTo16k(merged, inputRateRef.current || 44100);
            const pcm16 = floatToPcm16(resampled);
            const wav = makeWavFromPcm16(pcm16, 16000);
            setUploading(true);
            const resp = await fetch("/api/asr/iflytek", {
                method: "POST",
                headers: { "Content-Type": "audio/wav" },
                credentials: "same-origin",
                body: wav,
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.status === 401) throw new Error("未登录，无法使用语音识别");
            if (!resp.ok) throw new Error(data?.error || "识别失败");
                    const recognized = typeof data.text === "string" ? data.text : "";
                    setText(recognized);
                    setSubmittedOnce(false);
        } catch (e) {
            const msg = String(e);
            if (/Failed to fetch/i.test(msg)) {
                setError("网络错误：请确认手机与服务器同一网络，使用 HTTPS 访问，并确保服务在运行");
            } else {
                setError(msg);
            }
        } finally {
            setUploading(false);
        }
    };

    const submit = () => {
        const full = text.trim();
        if (onText && full) onText(full);
        setSubmittedOnce(true);
    };

    return (
        <Card variant="outlined">
            <CardHeader title="语音输入（科大讯飞云端识别）" subheader="开始录音 → 结束自动识别 → 提交" />
            <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                    <Button variant="contained" onClick={start} disabled={!mounted || recording || uploading || authLoading || !user}>
                        开始
                    </Button>
                                <Button
                        variant="contained"
                        color="secondary"
                        onClick={submit}
                                    disabled={!mounted || uploading || !text.trim() || isGenerating}
                    >
                        提交
                    </Button>
                    <Button variant="outlined" onClick={stop} disabled={!mounted || !recording}>
                        结束
                    </Button>
                </Stack>
                {!authLoading && !user && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                        需登录后才能使用语音识别。
                    </Alert>
                )}
                <TextField
                    label={uploading ? "识别中…" : "识别结果"}
                    value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    setSubmittedOnce(false);
                                }}
                    fullWidth
                    multiline
                    minRows={3}
                    sx={{ mt: 2 }}
                />
                {error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                        {error}
                    </Alert>
                )}
                {mounted && !micSupported && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                        当前环境不支持麦克风或非 HTTPS。请在 HTTPS 下，并允许麦克风权限后再试。
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
