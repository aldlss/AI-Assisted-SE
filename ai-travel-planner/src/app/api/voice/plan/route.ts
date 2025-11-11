import { NextRequest, NextResponse } from "next/server";
import type { PlanResponse, DayPlan, ItineraryItem } from "@/types/plan";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "缺少语音文本" }, { status: 400 });
  }

  // 1) 直接用语音文本驱动 LLM 生成结构化行程
  let plan: PlanResponse | null = null;
  try {
    plan = await generatePlanFromVoiceText(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || "语音生成失败" }, { status: 502 });
  }

  // 2) 地理编码 + 时间补齐
  try { await geocodePlanItemsInPlace(plan); } catch {}
  try { addTimesToPlan(plan); } catch {}

  // 3) 需要登录后保存
  const supabase = await createSupabaseRouteHandlerClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
  if (!user) return NextResponse.json({ error: "未登录，无法保存行程" }, { status: 401 });

  const tripInsert = {
    user_id: user.id,
    title: `${plan.destination} 行程`,
    destination: plan.destination,
    start_date: null,
    end_date: null,
    party_size: null,
    budget_total: plan.budget_total ?? null,
    preferences: null,
  } as const;

  const { data: tripRow, error: tripErr } = await supabase
    .from("trips")
    .insert(tripInsert)
    .select("id")
    .single();
  if (tripErr || !tripRow) return NextResponse.json({ error: tripErr?.message || "保存行程失败" }, { status: 500 });

  const tripId: string = tripRow.id;

  const itineraryRows = plan.itinerary.map((d: DayPlan) => ({
    trip_id: tripId,
    day_index: d.day_index,
    note: d.note ?? null,
  }));

  const { data: insertedDays, error: itiErr } = await supabase
    .from("itineraries")
    .insert(itineraryRows)
    .select("id, day_index");
  if (itiErr || !insertedDays) return NextResponse.json({ error: itiErr?.message || "保存行程天失败" }, { status: 500 });

  const dayToId = new Map<number, string>();
  insertedDays.forEach((r) => dayToId.set(r.day_index as number, r.id as string));

  const itemRows: Array<{ itinerary_id: string; type?: string; name?: string; description?: string | null; lat?: number | null; lng?: number | null; start_time?: string | null; end_time?: string | null; estimated_cost?: number | null; transport_mode?: string | null; }>
    = [];
  plan.itinerary.forEach((d: DayPlan) => {
    const itinerary_id = dayToId.get(d.day_index);
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
    if (itemsErr) return NextResponse.json({ error: itemsErr.message || "保存行程项失败" }, { status: 500 });
  }

  plan.tripId = tripId;
  plan.title = `${plan.destination} 行程`;
  return NextResponse.json(plan);
}

async function generatePlanFromVoiceText(text: string): Promise<PlanResponse> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("缺少 DASHSCOPE_API_KEY 环境变量");
  const model = process.env.DASHSCOPE_MODEL || "qwen-plus";
  const endpoint = process.env.DASHSCOPE_COMPAT_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

  const system = `你是经验丰富的旅行规划师，请根据用户的自然语言语音转写内容生成严格合法的 UTF-8 JSON（仅 JSON，不要额外解释，也不要出现 markdown 代码块标记），并保证内容具体、可执行：\n{
    "title": string,
    "destination": string,
    "days": number,
    "itinerary": [
      {
        "day_index": number,
        "note": string,
        "items": [
          {
            "type": "sight"|"food"|"hotel"|"transport",
            "name": string,
            "description"?: string,
            "estimated_cost"?: number,
            "transport_mode"?: "驾车"|"步行"|"公共交通",
            "address"?: string
          }
        ]
      }
    ],
    "budget_total"?: number
  }\n写作要求：\n- 所有字段内容（包括交通方式、描述、note）必须是中文。\n- transport_mode 只能是："驾车" / "步行" / "公共交通"。\n- 每天 4-6 个 items，包含早/午/晚/夜等节奏，描述要有看点（亮点、玩法、招牌菜），尽量给出 address 便于地理编码。\n- 估算花费（estimated_cost）尽量给出，餐饮/门票优先。\n- note 用 1-2 句概括当天主题与动线。\n- 如果总体预算无法估算，可以省略该字段。`;

  const user = `用户语音转写内容如下，请据此完整提取关键信息并输出上面的 JSON：\n${text}`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`DashScope 请求失败: ${resp.status}`);
  const data = await resp.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("DashScope 无内容");
  let parsedUnknown: unknown; try { parsedUnknown = JSON.parse(content); } catch { throw new Error("LLM 未输出合法 JSON"); }

  type ParsedLLM = {
    title?: unknown;
    destination?: unknown;
    days?: unknown;
    budget_total?: unknown;
    itinerary?: unknown;
  };
  const parsed = parsedUnknown as ParsedLLM;

  // 轻量适配
  const destination = typeof parsed.destination === "string" ? parsed.destination : "未命名目的地";
  const itRaw = Array.isArray((parsed as ParsedLLM).itinerary) ? (parsed as ParsedLLM).itinerary as unknown[] : [];
  const days = typeof parsed.days === "number" ? parsed.days : itRaw.length || 3;

  function normalizeTransport(raw?: string): ItineraryItem["transport_mode"] | undefined {
    if (!raw) return undefined;
    const r = raw.trim().toLowerCase();
    if (["drive","driving","car","taxi","cab","自驾","驾车","打车","出租车"].includes(r)) return "drive";
    if (["walk","walking","步行"].includes(r)) return "walk";
    if (["transit","public transit","public","metro","subway","bus","rail","train","公共交通","公交","地铁","巴士","地鐵"].includes(r)) return "transit";
    return undefined;
  }
  function normalizeType(raw?: string): ItineraryItem["type"] | undefined {
    if (!raw) return undefined;
    const r = raw.trim().toLowerCase();
    if (["sight","景点","景區","景区","打卡","游玩"].includes(r)) return "sight";
    if (["food","餐饮","餐廳","餐厅","美食","小吃","餐馆","餐館","饭店"].includes(r)) return "food";
    if (["hotel","酒店","旅馆","旅館","民宿","宾馆","賓館"].includes(r)) return "hotel";
    if (["transport","交通","出行","换乘"].includes(r)) return "transport";
    return undefined;
  }

  const itineraryRaw: unknown[] = itRaw;
  const itinerary: DayPlan[] = itineraryRaw.map((dU: unknown, idx: number) => {
    const d = dU as { day_index?: unknown; note?: unknown; items?: unknown };
    const itemsSource: unknown[] = Array.isArray(d.items) ? (d.items as unknown[]) : [];
    return {
      day_index: typeof d.day_index === "number" ? d.day_index : idx + 1,
      note: typeof d.note === "string" ? d.note : "",
      items: itemsSource.map((itU: unknown) => {
        const it = itU as { type?: unknown; name?: unknown; description?: unknown; estimated_cost?: unknown; transport_mode?: unknown; address?: unknown };
        return {
          type: normalizeType(typeof it.type === "string" ? it.type : undefined) ?? "sight",
          name: typeof it.name === "string" ? it.name : "",
          description: typeof it.description === "string" ? it.description : undefined,
          estimated_cost: typeof it.estimated_cost === "number" ? it.estimated_cost : undefined,
          transport_mode: normalizeTransport(typeof it.transport_mode === "string" ? it.transport_mode : undefined),
          address: typeof it.address === "string" ? it.address : undefined,
        };
      })
    } as DayPlan;
  });

  const plan: PlanResponse = {
    title: typeof parsed.title === "string" ? parsed.title : `${destination} 行程`,
    destination,
    days,
    itinerary,
    budget_total: typeof parsed.budget_total === "number" ? parsed.budget_total : undefined,
  };
  return plan;
}

async function geocodePlanItemsInPlace(plan: PlanResponse, destination?: string) {
  const key = process.env.AMAP_REST_KEY; if (!key) return;
  const limit = Number(process.env.GEOCODE_LIMIT || 20);
  let count = 0;
  for (const day of plan.itinerary) {
    for (const item of day.items) {
      if (count >= limit) return;
      if (item.lat != null && item.lng != null) continue;
      const addr = (item as ItineraryItem).address ?? item.name; if (!addr) continue;
      const geo = await geocodeOnce(addr, destination, key);
      if (geo) { item.lat = geo.lat; item.lng = geo.lng; }
      count++;
    }
  }
}

async function geocodeOnce(address: string, city: string | undefined, key: string): Promise<{ lat: number; lng: number } | null> {
  const url1 = new URL("https://restapi.amap.com/v3/geocode/geo");
  url1.searchParams.set("address", address); if (city) url1.searchParams.set("city", city);
  url1.searchParams.set("output", "JSON"); url1.searchParams.set("key", key);
  const r1 = await fetch(url1.toString());
  if (r1.ok) {
    const d = await r1.json();
    const first = d?.geocodes?.[0]?.location as string | undefined;
    if (first) {
      const [lngStr, latStr] = first.split(",");
      const lat = Number(latStr), lng = Number(lngStr);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  const url2 = new URL("https://restapi.amap.com/v3/place/text");
  url2.searchParams.set("keywords", address); if (city) url2.searchParams.set("city", city);
  url2.searchParams.set("offset", "1"); url2.searchParams.set("page", "1");
  url2.searchParams.set("output", "JSON"); url2.searchParams.set("key", key);
  const r2 = await fetch(url2.toString()); if (!r2.ok) return null;
  const d2 = await r2.json();
  const first2 = d2?.pois?.[0]?.location as string | undefined; if (!first2) return null;
  const [lngStr2, latStr2] = first2.split(",");
  const lat2 = Number(latStr2), lng2 = Number(lngStr2);
  if (Number.isFinite(lat2) && Number.isFinite(lng2)) return { lat: lat2, lng: lng2 };
  return null;
}

function addTimesToPlan(plan: PlanResponse) {
  const startMinutes = 9 * 60; const endLimit = 22 * 60;
  const durByType: Record<string, number> = { sight: 150, food: 60, hotel: 30, transport: 45 };
  const fmt = (m: number) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  for (const day of plan.itinerary) {
    let cursor = startMinutes;
    for (const it of day.items) {
      if (it.start_time || it.end_time) continue;
      const typ = (it.type || "sight").toLowerCase();
      const dur = durByType[typ] ?? 90;
      const st = cursor; let ed = st + dur; if (ed > endLimit) ed = endLimit;
      it.start_time = fmt(st); it.end_time = fmt(ed); cursor = ed + 15;
    }
  }
}
