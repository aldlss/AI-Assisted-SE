"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-5xl px-4 py-10">
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>描述你的旅行需求</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Input
                                label="目的地"
                                placeholder="例如：日本东京"
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="天数"
                                    type="number"
                                    min={1}
                                    value={days}
                                    onChange={(e) =>
                                        setDays(Number(e.target.value))
                                    }
                                />
                                <Input
                                    label="预算（元）"
                                    type="number"
                                    min={0}
                                    value={budget}
                                    onChange={(e) =>
                                        setBudget(
                                            e.target.value === ""
                                                ? ""
                                                : Number(e.target.value)
                                        )
                                    }
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="同行人数"
                                    type="number"
                                    min={1}
                                    value={partySize}
                                    onChange={(e) =>
                                        setPartySize(
                                            e.target.value === ""
                                                ? ""
                                                : Number(e.target.value)
                                        )
                                    }
                                />
                                <Input
                                    label="偏好"
                                    placeholder="例如：美食、动漫、亲子"
                                    value={preferences}
                                    onChange={(e) =>
                                        setPreferences(e.target.value)
                                    }
                                />
                            </div>
                            <div className="pt-2">
                                <Button
                                    onClick={generatePlan}
                                    disabled={loading || !destination}>
                                    {loading ? "生成中..." : "生成行程"}
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                                可在设置页配置阿里云百炼与高德
                                Key。当前为占位实现，稍后接入真实服务。
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>生成结果</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {error && (
                                <p className="text-sm text-red-600">{error}</p>
                            )}
                            {!error && !result && (
                                <p className="text-sm text-gray-600">
                                    填写左侧表单并点击“生成行程”。
                                </p>
                            )}
                            {result && (
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="font-medium">
                                            {result.destination} · {result.days}{" "}
                                            天行程
                                        </h3>
                                    </div>
                                    {/* 简易地图演示：如果行程项包含经纬度，则渲染 markers */}
                                    <MapView
                                        className="h-64 w-full rounded-md border"
                                        markers={result.itinerary
                                            .flatMap((d) => d.items)
                                            .filter(
                                                (it) =>
                                                    typeof it.lat ===
                                                        "number" &&
                                                    typeof it.lng === "number"
                                            )
                                            .map((it) => ({
                                                lng: it.lng as number,
                                                lat: it.lat as number,
                                                title: it.name,
                                            }))}
                                    />
                                    <ol className="space-y-2">
                                        {result.itinerary.map((day) => (
                                            <li
                                                key={day.day_index}
                                                className="rounded-md border p-2">
                                                <div className="mb-1 text-sm font-semibold">
                                                    第 {day.day_index} 天
                                                </div>
                                                <ul className="list-inside list-disc text-sm text-gray-700">
                                                    {day.items.map(
                                                        (it, idx) => (
                                                            <li key={idx}>
                                                                <span className="font-medium">
                                                                    [{it.type}]
                                                                </span>{" "}
                                                                {it.name}
                                                                {it.estimated_cost
                                                                    ? ` · 约 ¥${it.estimated_cost}`
                                                                    : ""}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
