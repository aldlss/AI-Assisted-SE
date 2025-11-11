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
// 语音现在直接通过服务端 LLM 提示词生成，不再本地规则解析
import { VoiceInput } from "@/components/asr/VoiceInput";
import { useAuth } from "@/lib/useAuth";
import Link from "next/link";
const MapView = dynamic(
    () => import("@/components/map/MapView").then((m) => m.MapView),
    { ssr: false }
);

export default function Home() {
    const { user, loading: authLoading } = useAuth();
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
            if (!user) {
                setError("请先登录后再生成行程");
                return;
            }
            const dateRange = startDate
                ? {
                      start: startDate,
                      end: (() => {
                          try {
                              const d = new Date(startDate);
                              d.setDate(d.getDate() + Math.max(0, days - 1));
                              return d.toISOString().slice(0, 10);
                          } catch {
                              return startDate;
                          }
                      })(),
                  }
                : undefined;

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
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });
            if (res.status === 401) throw new Error("未登录，无法保存行程");
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
            if (/Failed to fetch/i.test(msg)) {
                setError(
                    "网络错误：请确认手机与服务器同一网络，使用 HTTPS 访问，并确保服务在运行"
                );
            } else {
                setError(msg || "发生未知错误");
            }
        } finally {
            setLoading(false);
        }
    }

    async function onSpeech(text: string) {
        // 手动点击语音卡片的“提交”后，直接走语音专用生成接口
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            if (!user) {
                setError("请先登录后再生成行程");
                return;
            }
            const res = await fetch("/api/voice/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ text }),
            });
            if (res.status === 401) throw new Error("未登录，无法保存行程");
            if (!res.ok) throw new Error("语音生成行程失败，请稍后重试");
            const data = (await res.json()) as PlanResponse;
            setResult(data);
            if (isUuidV4(data.tripId)) {
                router.push(`/trips/${data.tripId}`);
                return;
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (/Failed to fetch/i.test(msg)) {
                setError(
                    "网络错误：请确认手机与服务器同一网络，使用 HTTPS 访问，并确保服务在运行"
                );
            } else {
                setError(msg || "发生未知错误");
            }
        } finally {
            setLoading(false);
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
                                    disabled={
                                        loading ||
                                        !destination ||
                                        authLoading ||
                                        !user
                                    }
                                    sx={{ borderRadius: 999, px: 3 }}>
                                    {loading ? "生成中..." : "生成行程"}
                                </Button>
                            </Box>
                            {!authLoading && !user && (
                                <Alert severity="info" sx={{ mt: 1 }}>
                                    需登录后才能生成行程，
                                    <Button
                                        component={Link}
                                        href="/auth/sign-in"
                                        size="small">
                                        去登录
                                    </Button>
                                </Alert>
                            )}
                            <Typography
                                variant="caption"
                                color="text.secondary">
                                可在设置页配置阿里云百炼与高德 Key。
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                                <VoiceInput onText={onSpeech} isGenerating={loading} />
                                <Typography
                                    variant="caption"
                                    color="text.secondary">
                                    说：&quot;帮我规划{destination || "上海"}
                                    {days}天（{startDate || "选择出发日期"}
                                    {startDate
                                        ? ` 起，至 ${(() => {
                                              try {
                                                  const d = new Date(startDate as string);
                                                  d.setDate(d.getDate() + Math.max(0, days - 1));
                                                  return d.toISOString().slice(0, 10);
                                              } catch {
                                                  return startDate;
                                              }
                                          })()}`
                                        : ""}
                                    ），预算{Number(budget) || 5000}元，
                                    {Number(partySize) || 2}人，偏好
                                    {preferences || "美食风景"}
                                    &quot;，提交后将直接按语音生成行程（服务端会附加提示词确保信息被完整读取）。
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
                                        markers={
                                            result.itinerary
                                                .flatMap((d) => d.items)
                                                .map((it) => ({
                                                    lng:
                                                        typeof it.lng ===
                                                        "string"
                                                            ? Number(it.lng)
                                                            : (it.lng as
                                                                  | number
                                                                  | null),
                                                    lat:
                                                        typeof it.lat ===
                                                        "string"
                                                            ? Number(it.lat)
                                                            : (it.lat as
                                                                  | number
                                                                  | null),
                                                    title: it.name,
                                                }))
                                                .filter(
                                                    (m) =>
                                                        Number.isFinite(
                                                            m.lat as number
                                                        ) &&
                                                        Number.isFinite(
                                                            m.lng as number
                                                        )
                                                ) as {
                                                lng: number;
                                                lat: number;
                                                title?: string;
                                            }[]
                                        }
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
