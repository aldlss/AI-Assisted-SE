"use client";
import { useState } from "react";
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

    // 结果状态
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PlanResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    async function generatePlan() {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const payload: PlanRequest = {
                destination,
                days,
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

    return (
        <Container maxWidth="lg" sx={{ py: 6 }}>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                }}
            >
                <Card variant="outlined">
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
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                                <TextField
                                    label="天数"
                                    type="number"
                                    inputProps={{ min: 1 }}
                                    value={days}
                                    onChange={(e) => setDays(Number(e.target.value))}
                                />
                                <TextField
                                    label="预算（元）"
                                    type="number"
                                    inputProps={{ min: 0 }}
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value === "" ? "" : Number(e.target.value))}
                                />
                            </Box>
                            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                                <TextField
                                    label="同行人数"
                                    type="number"
                                    inputProps={{ min: 1 }}
                                    value={partySize}
                                    onChange={(e) => setPartySize(e.target.value === "" ? "" : Number(e.target.value))}
                                />
                                <TextField
                                    label="偏好"
                                    placeholder="例如：美食、动漫、亲子"
                                    value={preferences}
                                    onChange={(e) => setPreferences(e.target.value)}
                                />
                            </Box>
                            <Box>
                                <Button variant="contained" onClick={generatePlan} disabled={loading || !destination}>
                                    {loading ? "生成中..." : "生成行程"}
                                </Button>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                                可在设置页配置阿里云百炼与高德 Key。
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>

                <Card variant="outlined">
                    <CardHeader title="生成结果" />
                    <CardContent>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                        {!error && !result && (
                            <Typography variant="body2" color="text.secondary">填写左侧表单并点击“生成行程”。</Typography>
                        )}
                        {result && (
                            <Box sx={{ display: "grid", gap: 2 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                    {result.destination} · {result.days} 天行程
                                </Typography>
                                <MapView
                                    className="h-64 w-full rounded-md border"
                                    markers={result.itinerary
                                        .flatMap((d) => d.items)
                                        .filter(
                                            (it) => typeof it.lat === "number" && typeof it.lng === "number"
                                        )
                                        .map((it) => ({ lng: it.lng as number, lat: it.lat as number, title: it.name }))}
                                />
                                <Box component="ol" sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gap: 1 }}>
                                    {result.itinerary.map((day) => (
                                        <Box
                                            component="li"
                                            key={day.day_index}
                                            sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}
                                        >
                                            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                                                第 {day.day_index} 天
                                            </Typography>
                                            <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                                {day.items.map((it, idx) => (
                                                    <li key={idx}>
                                                        <Typography variant="body2">
                                                            <strong>[{it.type}]</strong> {it.name}
                                                            {it.estimated_cost ? ` · 约 ¥${it.estimated_cost}` : ""}
                                                        </Typography>
                                                    </li>
                                                ))}
                                            </Box>
                                        </Box>
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
