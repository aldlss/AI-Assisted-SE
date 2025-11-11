"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import type { PlanRequest, PlanResponse } from "@/types/plan";
import { isUuidV4 } from "@/lib/uuid";
import { parseSpeechToForm } from "../lib/speechParser";
import { VoiceInput } from "@/components/asr/VoiceInput";
const MapView = dynamic(
    () => import("@/components/map/MapView").then((m) => m.MapView),
    { ssr: false }
);

export default function Home() {
    // 表单状态
    const [destination, setDestination] = useState("");
    const [days, setDays] = useState(3);
    const [budget, setBudget] = useState<number | "">("");
    const [partySize, setPartySize] = useState<number | "">("");
    const [preferences, setPreferences] = useState("");
    const [startDate, setStartDate] = useState<string | "">("");

    // 结果状态
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PlanResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    // speechFilling 仅用于未来可能的节流，此处暂不显示
    const [speechFilling, setSpeechFilling] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

    async function generatePlan() {
        setLoading(true);
        setError(null);
        setResult(null);
            try {
            const dateRange = startDate ? {
                start: startDate,
                end: (() => {
                    try {
                        const d = new Date(startDate);
                        d.setDate(d.getDate() + Math.max(0, days - 1));
                        return d.toISOString().slice(0,10);
                    } catch { return startDate; }
                })(),
            } : undefined;

            const payload: PlanRequest = {
                destination,
                days,
                dateRange,
                budget: budget === "" ? undefined : Number(budget),
                partySize: partySize === "" ? undefined : Number(partySize),
                preferences,
            };
            const res = await fetch("/api/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("生成行程失败，请稍后重试");
            const data = (await res.json()) as PlanResponse;
            setResult(data);
            // 若已保存并返回 tripId，则跳转到详情页以获得更完整的展示
            if (isUuidV4(data.tripId)) {
                router.push(`/trips/${data.tripId}`);
                return;
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg || "发生未知错误");
        } finally {
            setLoading(false);
        }
    }

    function onSpeech(text: string) {
        // 解析中文口述，智能填充表单；若关键信息齐全则自动生成
        setSpeechFilling(true);
        try {
            const parsed = parseSpeechToForm(text);
            if (parsed.destination) setDestination(parsed.destination);
            if (typeof parsed.days === "number") setDays(parsed.days);
            if (typeof parsed.budget === "number" || parsed.budget === "") setBudget(parsed.budget as number | "");
            if (typeof parsed.partySize === "number" || parsed.partySize === "") setPartySize(parsed.partySize as number | "");
            if (parsed.preferences) setPreferences(parsed.preferences);
            // 自动触发：当 destination 和 days 存在时
            const dest = parsed.destination || destination;
            const d = typeof parsed.days === "number" ? parsed.days : days;
            if (dest && d && !loading) {
                // 微小延迟以确保状态已入队
                setTimeout(() => {
                    generatePlan();
                }, 100);
            }
        } finally {
            setSpeechFilling(false);
        }
    }

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            {/* Hero 区域 */}
            <Box sx={{ textAlign: "center", mb: 5 }} className="fade-in-up">
                <Typography
                    variant="h3"
                    fontWeight={800}
                    className="hero-gradient-text"
                    gutterBottom>
                    用 AI 一键生成你的专属旅行
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    语音或文字描述即可获得含交通/住宿/景点/餐饮的完整行程，支持预算与地图预览。
                </Typography>
            </Box>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 3,
                }}>
                <Card variant="outlined" className="glass-card">
                    <CardHeader title="描述你的旅行需求" />
                    <CardContent>
                        <Box sx={{ display: "grid", gap: 2 }}>
                            <TextField
                                label="目的地"
                                placeholder="例如：日本东京"
                                fullWidth
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                            />
                            <TextField
                                label="出发日期"
                                type="date"
                                InputLabelProps={{ shrink: true }}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 2,
                                }}>
                                <TextField
                                    label="天数"
                                    type="number"
                                    inputProps={{ min: 1 }}
                                    value={days}
                                    onChange={(e) =>
                                        setDays(Number(e.target.value))
                                    }
                                />
                                <TextField
                                    label="预算（元）"
                                    type="number"
                                    inputProps={{ min: 0 }}
                                    value={budget}
                                    onChange={(e) =>
                                        setBudget(
                                            e.target.value === ""
                                                ? ""
                                                : Number(e.target.value)
                                        )
                                    }
                                />
                            </Box>
                            <Box
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: 2,
                                }}>
                                <TextField
                                    label="同行人数"
                                    type="number"
                                    inputProps={{ min: 1 }}
                                    value={partySize}
                                    onChange={(e) =>
                                        setPartySize(
                                            e.target.value === ""
                                                ? ""
                                                : Number(e.target.value)
                                        )
                                    }
                                />
                                <TextField
                                    label="偏好"
                                    placeholder="例如：美食、动漫、亲子"
                                    value={preferences}
                                    onChange={(e) =>
                                        setPreferences(e.target.value)
                                    }
                                />
                            </Box>
                            <Box>
                                <Button
                                    variant="contained"
                                    onClick={generatePlan}
                                    disabled={loading || !destination}
                                    sx={{ borderRadius: 999, px: 3 }}>
                                    {loading ? "生成中..." : "生成行程"}
                                </Button>
                            </Box>
                            <Typography
                                variant="caption"
                                color="text.secondary">
                                可在设置页配置阿里云百炼与高德 Key。
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                                <VoiceInput onText={onSpeech} />
                                <Typography
                                    variant="caption"
                                    color="text.secondary">
                                    说：&quot;帮我规划{destination || "上海"}
                                    {days}天，预算{Number(budget) || 5000}元，
                                    {Number(partySize) || 2}人，偏好
                                    {preferences || "美食风景"}
                                    &quot;，会自动填充并生成行程。
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>

                <Card variant="outlined" className="glass-card">
                    <CardHeader title="生成结果" />
                    <CardContent>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        {!error && !result && (
                            <Typography variant="body2" color="text.secondary">
                                填写左侧表单并点击“生成行程”。
                            </Typography>
                        )}
                        {result && (
                            <Box sx={{ display: "grid", gap: 2 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}>
                                    {result.destination} · {result.days} 天行程
                                </Typography>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}>
                                    <MapView
                                      className="h-64 w-full rounded-md border"
                                      markers={result.itinerary
                                        .flatMap((d) => d.items)
                                        .map((it) => ({
                                          lng: typeof it.lng === 'string' ? Number(it.lng) : (it.lng as number | null),
                                          lat: typeof it.lat === 'string' ? Number(it.lat) : (it.lat as number | null),
                                          title: it.name,
                                        }))
                                        .filter((m) => Number.isFinite(m.lat as number) && Number.isFinite(m.lng as number)) as {lng:number;lat:number;title?:string}[]}
                                    />
                                </motion.div>
                                <Box
                                    component="ol"
                                    sx={{
                                        m: 0,
                                        p: 0,
                                        listStyle: "none",
                                        display: "grid",
                                        gap: 1,
                                    }}>
                                    {result.itinerary.map((day) => (
                                        <motion.li
                                            key={day.day_index}
                                            style={{ listStyle: "none" }}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.25 }}>
                                            <Box
                                                sx={{
                                                    border: 1,
                                                    borderColor: "divider",
                                                    borderRadius: 1,
                                                    p: 1,
                                                    background:
                                                        "var(--primary-100)",
                                                }}>
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={600}
                                                    sx={{ mb: 0.5 }}>
                                                    第 {day.day_index} 天
                                                </Typography>
                                                <Box
                                                    component="ul"
                                                    sx={{ m: 0, pl: 2 }}>
                                                    {day.items.map(
                                                        (it, idx) => (
                                                            <li key={idx}>
                                                                <Typography variant="body2">
                                                                    <strong>
                                                                        [
                                                                        {
                                                                            it.type
                                                                        }
                                                                        ]
                                                                    </strong>{" "}
                                                                    {it.name}
                                                                    {it.estimated_cost
                                                                        ? ` · 约 ¥${it.estimated_cost}`
                                                                        : ""}
                                                                </Typography>
                                                            </li>
                                                        )
                                                    )}
                                                </Box>
                                            </Box>
                                        </motion.li>
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
}
