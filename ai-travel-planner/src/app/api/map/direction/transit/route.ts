import { NextRequest, NextResponse } from "next/server";

// 高德公交路线规划代理（多策略可拓展）
// GET /api/map/direction/transit?origin=lng,lat&destination=lng,lat&city=城市名
export async function GET(req: NextRequest) {
  const key = process.env.AMAP_REST_KEY;
  if (!key) return NextResponse.json({ code: "CONFIG_MISSING", message: "缺少 AMAP_REST_KEY" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const city = searchParams.get("city") || "北京"; // 默认为北京，可由前端指定目的地城市
  if (!origin || !destination) return NextResponse.json({ code: "INVALID_PARAMS", message: "缺少 origin 或 destination" }, { status: 400 });
  const qs = new URLSearchParams({ key, origin, destination, city });
  const url = `https://restapi.amap.com/v3/direction/transit/integrated?${qs.toString()}`;
  try {
    const r = await fetch(url, { next: { revalidate: 30 } });
    if (!r.ok) throw new Error(`AMap HTTP ${r.status}`);
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ code: "AMAP_ERROR", message: msg }, { status: 502 });
  }
}
