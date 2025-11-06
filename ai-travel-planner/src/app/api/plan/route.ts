import { NextRequest, NextResponse } from "next/server";
import type { PlanRequest, PlanResponse, DayPlan, ItineraryItem } from "@/types/plan";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

// 占位实现：返回一个简化的行程 JSON，后续接入阿里云百炼 LLM
export async function POST(req: NextRequest) {
  const body = (await req.json()) as PlanRequest;

  // 1) 生成占位行程（后续接入 DashScope LLM）
  const days = body.days || 3;
  const plan: PlanResponse = {
    destination: body.destination || "未知目的地",
    days,
    itinerary: Array.from({ length: days }).map((_, i) => ({
      day_index: i + 1,
      note: "自动生成占位行程，后续将由 LLM 生成具体内容",
      items: [
        { type: "sight", name: `示例景点 D${i + 1}`, description: "体验当地文化与美食" },
        { type: "food", name: `本地餐馆 D${i + 1}`, description: "尝试特色菜", estimated_cost: 100 },
      ],
    })),
  };

  // 2) 持久化到 Supabase（需要已登录）
  const supabase = await createSupabaseRouteHandlerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: "未登录，无法保存行程" }, { status: 401 });
  }

  // trips 插入
  const tripInsert = {
    user_id: user.id,
    title: `${plan.destination} 行程`,
    destination: plan.destination,
    start_date: body.dateRange?.start ?? null,
    end_date: body.dateRange?.end ?? null,
    party_size: body.partySize ?? null,
    budget_total: body.budget ?? null,
    preferences: body.preferences ? { raw: body.preferences } : null,
  } as const;

  const { data: tripRow, error: tripErr } = await supabase
    .from("trips")
    .insert(tripInsert)
    .select("id")
    .single();
  if (tripErr || !tripRow) {
    return NextResponse.json({ error: tripErr?.message || "保存行程失败" }, { status: 500 });
  }

  const tripId: string = tripRow.id;

  // itineraries 批量插入
  const itineraryRows = plan.itinerary.map((d: DayPlan) => ({
    trip_id: tripId,
    day_index: d.day_index,
    note: d.note ?? null,
  }));

  const { data: insertedItineraries, error: itiErr } = await supabase
    .from("itineraries")
    .insert(itineraryRows)
    .select("id, day_index");
  if (itiErr || !insertedItineraries) {
    return NextResponse.json({ error: itiErr?.message || "保存行程天信息失败" }, { status: 500 });
  }

  // 建立 day_index -> itinerary_id 映射
  const dayToItineraryId = new Map<number, string>();
  insertedItineraries.forEach((r) => dayToItineraryId.set(r.day_index as number, r.id as string));

  // itinerary_items 批量插入
  const itemRows: Array<{
    itinerary_id: string;
    type?: string;
    name?: string;
    description?: string | null;
    lat?: number | null;
    lng?: number | null;
    start_time?: string | null;
    end_time?: string | null;
    estimated_cost?: number | null;
    transport_mode?: string | null;
  }> = [];
  plan.itinerary.forEach((d: DayPlan) => {
    const itinerary_id = dayToItineraryId.get(d.day_index);
    if (!itinerary_id) return;
    d.items?.forEach((it: ItineraryItem) => {
      itemRows.push({
        itinerary_id,
        type: it.type,
        name: it.name,
        description: it.description ?? null,
        lat: it.lat ?? null,
        lng: it.lng ?? null,
        start_time: it.start_time ?? null,
        end_time: it.end_time ?? null,
        estimated_cost: it.estimated_cost ?? null,
        transport_mode: it.transport_mode ?? null,
      });
    });
  });

  if (itemRows.length > 0) {
    const { error: itemsErr } = await supabase.from("itinerary_items").insert(itemRows);
    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message || "保存行程项失败" }, { status: 500 });
    }
  }

  // 返回 tripId 给前端用于跳转
  plan.tripId = tripId;
  plan.title = `${plan.destination} 行程`;
  return NextResponse.json(plan);
}
