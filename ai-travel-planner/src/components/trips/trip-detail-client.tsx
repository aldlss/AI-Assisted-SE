"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isUuidV4 } from "@/lib/uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MapView = dynamic(() => import("@/components/map/MapView").then((m) => m.MapView), { ssr: false });

// Lightweight row types matching our Supabase tables
type TripRow = {
  id: string;
  title: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type ItineraryRow = {
  id: string;
  trip_id: string;
  day_index: number;
  note: string | null;
};

type ItemRow = {
  id: string;
  itinerary_id: string;
  type: string | null;
  name: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  start_time: string | null;
  end_time: string | null;
  estimated_cost: number | null;
  transport_mode: string | null;
};

export default function TripDetailClient({ id }: { id: string }) {
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [days, setDays] = useState<ItineraryRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 服务器已经校验过 UUID；这里的校验只作为双保险（理论上不会触发 notFound 之后的渲染）
    if (!isUuidV4(id)) {
      setError("无效的行程 ID");
      setLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    (async () => {
      try {
        setLoading(true);
        // Trip
        const { data: tripData, error: e1 } = await supabase
          .from("trips")
          .select("id,title,destination,start_date,end_date,created_at")
          .eq("id", id)
          .single();
        if (e1) throw e1;
        setTrip(tripData as TripRow);

        // Itineraries
        const { data: its, error: e2 } = await supabase
          .from("itineraries")
          .select("id,trip_id,day_index,note")
          .eq("trip_id", id)
          .order("day_index", { ascending: true });
        if (e2) throw e2;
        const itsList = (its ?? []) as ItineraryRow[];
        setDays(itsList);

        // Items
        if (itsList.length > 0) {
          const ids = itsList.map((i) => i.id);
          const { data: itemsData, error: e3 } = await supabase
            .from("itinerary_items")
            .select(
              "id,itinerary_id,type,name,description,lat,lng,start_time,end_time,estimated_cost,transport_mode"
            )
            .in("itinerary_id", ids);
          if (e3) throw e3;
          setItems((itemsData ?? []) as ItemRow[]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const markers = useMemo(() => {
    return items
      .filter((it) => typeof it.lat === "number" && typeof it.lng === "number")
      .map((it) => ({ lat: it.lat as number, lng: it.lng as number, title: it.name ?? undefined }));
  }, [items]);

  const itemsByItinerary = useMemo(() => {
    const map = new Map<string, ItemRow[]>();
    for (const it of items) {
      const arr = map.get(it.itinerary_id) || [];
      arr.push(it);
      map.set(it.itinerary_id, arr);
    }
    return map;
  }, [items]);

  const transportLabel = (mode: string | null | undefined): string | null => {
    if (!mode) return null;
    const m = mode.toLowerCase();
    if (m === "drive") return "驾车";
    if (m === "walk") return "步行";
    if (m === "transit") return "公共交通";
    return mode; // 兜底显示原值
  };

  const typeLabel = (type: string | null | undefined): string => {
    switch (type) {
      case "sight":
        return "景点";
      case "food":
        return "美食";
      case "hotel":
        return "酒店";
      case "transport":
        return "交通";
      default:
        return type ?? "条目";
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{trip?.title ?? "行程详情"}</h1>
        <p className="text-sm text-gray-600">
          目的地：{trip?.destination ?? "-"} ｜ 日期：{trip?.start_date ?? "?"} ~ {trip?.end_date ?? "?"}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>地图总览（自动聚合标注）</CardTitle>
        </CardHeader>
        <CardContent>
          {markers.length === 0 ? (
            <p className="text-sm text-gray-600">暂无可定位的地点，部分地点可能缺少精确地址。</p>
          ) : (
            <MapView className="h-80 w-full rounded-md border" markers={markers} />
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading && <p className="text-sm text-gray-600">加载中...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error &&
          days.map((d) => {
            const list = (itemsByItinerary.get(d.id) ?? []).slice();
            // 让景点优先，其余保持原有顺序稳定（稳定排序的简易实现）
            list.sort((a, b) => {
              const aSight = a.type === "sight";
              const bSight = b.type === "sight";
              if (aSight === bSight) return 0;
              return aSight ? -1 : 1;
            });
            const dayMarkers = list
              .filter((it) => typeof it.lat === "number" && typeof it.lng === "number")
              .map((it) => ({ lat: it.lat as number, lng: it.lng as number, title: it.name ?? undefined }));
            return (
              <Card key={d.id}>
                <CardHeader>
                  <CardTitle>第 {d.day_index} 天 {d.note ? `· ${d.note}` : ""}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dayMarkers.length > 0 && (
                    <MapView className="h-64 w-full rounded-md border" markers={dayMarkers} />
                  )}
                  <ul className="space-y-2">
                    {list.map((it) => (
                      <li key={it.id} className="rounded border p-3">
                        <div className="mb-1 text-sm font-semibold">[{typeLabel(it.type)}] {it.name ?? "-"}</div>
                        {it.description && <p className="text-sm text-gray-700">{it.description}</p>}
                        <div className="mt-1 text-xs text-gray-500">
                          {it.start_time || it.end_time ? (
                            <span>时间：{it.start_time ?? "?"} ~ {it.end_time ?? "?"} ｜ </span>
                          ) : null}
                          {typeof it.estimated_cost === "number" ? (
                            <span>预算：¥{it.estimated_cost}</span>
                          ) : (
                            <span className="text-gray-400">预算：—</span>
                          )}
                          {transportLabel(it.transport_mode) ? (
                            <span> ｜ 交通：{transportLabel(it.transport_mode)}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
