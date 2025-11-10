import { NextRequest, NextResponse } from "next/server";
import type { PlanRequest, PlanResponse, DayPlan, ItineraryItem } from "@/types/plan";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

// 占位实现：返回一个简化的行程 JSON，后续接入阿里云百炼 LLM
export async function POST(req: NextRequest) {
  const body = (await req.json()) as PlanRequest;

  // 1) 优先调用 DashScope(Qwen) 生成结构化行程；失败则回退到占位
  let plan: PlanResponse | null = null;
  try {
    plan = await generatePlanWithQwen(body);
  } catch {
    // graceful fallback
    plan = null;
  }
  if (!plan) {
    const days = body.days || 3;
    plan = {
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
  }

  // 2) 对没有经纬度的条目做地理编码（最多处理若干个，避免超额调用）
  try {
    await geocodePlanItemsInPlace(plan, body.destination);
  } catch {
    // 地理编码失败不阻断主流程
  }

  // 3) 持久化到 Supabase（需要已登录）
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

// 调用 DashScope 的 OpenAI 兼容聊天接口，生成结构化行程
async function generatePlanWithQwen(body: PlanRequest): Promise<PlanResponse> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error("缺少 DASHSCOPE_API_KEY 环境变量");
  const model = process.env.DASHSCOPE_MODEL || "qwen-plus";
  const endpoint = process.env.DASHSCOPE_COMPAT_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

  const system = `你是经验丰富的旅行规划师，请输出严格合法的 UTF-8 JSON（仅 JSON，不要额外解释，也不要出现 markdown 代码块标记），并保证内容具体、可执行：\n{
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
            "transport_mode"?: "驾车"|"步行"|"公共交通", // 交通方式务必使用这三种中文其一，若不确定可省略
            "address"?: string
          }
        ]
      }
    ],
    "budget_total"?: number
  }\n写作要求：\n- 所有字段内容（包括交通方式、描述、note）必须是中文。\n- transport_mode 只能是："驾车" / "步行" / "公共交通"（不要输出英文 drive/walk/transit）。\n- 每天 4-6 个 items，包含早/午/晚/夜等节奏，描述要有看点（亮点、玩法、招牌菜），尽量给出 address 便于地理编码。\n- 估算花费（estimated_cost）尽量给出，餐饮/门票优先。\n- note 用 1-2 句概括当天主题与动线。\n- 如果总体预算（budget_total）无法估算，可以省略该字段。`;

  const user = `目的地: ${body.destination}\n天数: ${body.days ?? "3"}\n日期: ${body?.dateRange?.start ?? "?"} ~ ${body?.dateRange?.end ?? "?"}\n预算: ${body.budget ?? "?"}\n人数: ${body.partySize ?? "?"}\n偏好: ${body.preferences ?? "无"}`;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
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

  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error("LLM 未输出合法 JSON"); }

  // 轻量校验 & 适配到 PlanResponse
  type LlmItemRaw = { type?: unknown; name?: unknown; description?: unknown; estimated_cost?: unknown; transport_mode?: unknown; address?: unknown };
  type LlmDayRaw = { day_index?: unknown; note?: unknown; items?: unknown };
  type LlmPlanRaw = { title?: unknown; destination?: unknown; days?: unknown; itinerary?: unknown; budget_total?: unknown };

  const p = parsed as LlmPlanRaw;
  const destination = typeof p.destination === "string" ? p.destination : String(body.destination || "");
  const days = typeof p.days === "number" ? p.days : Number(body.days || 1);
  const itineraryUnknown = (p.itinerary ?? []) as unknown;
  const itinerarySource = Array.isArray(itineraryUnknown) ? itineraryUnknown : [];

  function normalizeTransport(raw: string | undefined): ItineraryItem["transport_mode"] | undefined {
    if (!raw) return undefined;
    const r = raw.trim().toLowerCase();
    // 中文 & 英文同义词映射到统一英文枚举，保持数据库兼容
    if (["drive", "driving", "car", "taxi", "cab", "自驾", "驾车", "打车", "出租车"].includes(r)) return "drive";
    if (["walk", "walking", "步行"].includes(r)) return "walk";
    if (["transit", "public transit", "public", "metro", "subway", "bus", "rail", "train", "公共交通", "公交", "地铁", "巴士", "地鐵"].includes(r)) return "transit";
    return undefined;
  }

  function normalizeType(raw: string | undefined): ItineraryItem["type"] | undefined {
    if (!raw) return undefined;
    const r = raw.trim().toLowerCase();
    if (["sight", "景点", "景區", "景区", "打卡", "游玩"].includes(r)) return "sight";
    if (["food", "餐饮", "餐廳", "餐厅", "美食", "小吃", "餐馆", "餐館", "饭店"].includes(r)) return "food";
    if (["hotel", "酒店", "旅馆", "旅館", "民宿", "宾馆", "賓館"].includes(r)) return "hotel";
    if (["transport", "交通", "出行", "换乘"].includes(r)) return "transport";
    return undefined;
  }

  const toItem = (itUnknown: unknown): ItineraryItem => {
    const it = itUnknown as LlmItemRaw;
  const typeStr = typeof it.type === "string" ? it.type : undefined;
  const normalizedType = normalizeType(typeStr);
  const type = normalizedType ?? "sight";
    const name = typeof it.name === "string" ? it.name : "";
    const description = typeof it.description === "string" ? it.description : undefined;
    const estimated_cost = typeof it.estimated_cost === "number" ? it.estimated_cost : undefined;
    const tmRaw = typeof it.transport_mode === "string" ? it.transport_mode : undefined;
    const transport_mode = normalizeTransport(tmRaw);
    const address = typeof it.address === "string" ? it.address : undefined;
    return { type, name, description, estimated_cost, transport_mode, address };
  };

  const itinerary: DayPlan[] = itinerarySource.map((dUnknown: unknown, idx: number) => {
    const d = dUnknown as LlmDayRaw;
    const itemsSource = Array.isArray(d.items as unknown) ? (d.items as unknown[]) : [];
    const day_index = Number(typeof d.day_index === "number" ? d.day_index : (typeof d.day_index === "string" ? Number(d.day_index) : idx + 1));
    const note = typeof d.note === "string" ? d.note : "";
    return { day_index, note, items: itemsSource.map(toItem) };
  });

  const plan: PlanResponse = {
    title: (typeof p.title === "string" ? p.title : `${destination} 行程`),
    destination,
    days,
    itinerary,
    budget_total: typeof p.budget_total === "number" ? p.budget_total : undefined,
  };
  return plan;
}

// 使用高德 REST 对计划中的 items 进行地理编码填充经纬度
async function geocodePlanItemsInPlace(plan: PlanResponse, destination?: string) {
  const key = process.env.AMAP_REST_KEY;
  if (!key) return;
  const limit = Number(process.env.GEOCODE_LIMIT || 20);
  let count = 0;
  for (const day of plan.itinerary) {
    for (const item of day.items) {
      if (count >= limit) return;
      if (item.lat != null && item.lng != null) continue;
  const addr = (item as ItineraryItem).address ?? item.name;
      if (!addr) continue;
      const geo = await geocodeOnce(addr, destination, key);
      if (geo) {
        item.lat = geo.lat; item.lng = geo.lng;
      }
      count++;
    }
  }
}

async function geocodeOnce(address: string, city: string | undefined, key: string): Promise<{ lat: number; lng: number } | null> {
  // 首选地理编码
  {
    const url = new URL("https://restapi.amap.com/v3/geocode/geo");
    url.searchParams.set("address", address);
    if (city) url.searchParams.set("city", city);
    url.searchParams.set("output", "JSON");
    url.searchParams.set("key", key);
    const resp = await fetch(url.toString());
    if (resp.ok) {
      const data = await resp.json();
      const first = data?.geocodes?.[0]?.location as string | undefined;
      if (first) {
        const [lngStr, latStr] = first.split(",");
        const lat = Number(latStr), lng = Number(lngStr);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    }
  }
  // 失败则使用地点搜索回退
  {
    const url = new URL("https://restapi.amap.com/v3/place/text");
    url.searchParams.set("keywords", address);
    if (city) url.searchParams.set("city", city);
    url.searchParams.set("offset", "1");
    url.searchParams.set("page", "1");
    url.searchParams.set("output", "JSON");
    url.searchParams.set("key", key);
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    const first = data?.pois?.[0]?.location as string | undefined;
    if (!first) return null;
    const [lngStr, latStr] = first.split(",");
    const lat = Number(latStr), lng = Number(lngStr);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }
}
