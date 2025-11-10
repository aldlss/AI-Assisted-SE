import { NextRequest, NextResponse } from "next/server";

// 高德步行路径规划代理
// GET /api/map/direction/walking?origin=lng,lat&destination=lng,lat
export async function GET(req: NextRequest) {
  const key = process.env.AMAP_REST_KEY;
  if (!key) return NextResponse.json({ code: "CONFIG_MISSING", message: "缺少 AMAP_REST_KEY" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  if (!origin || !destination) return NextResponse.json({ code: "INVALID_PARAMS", message: "缺少 origin 或 destination" }, { status: 400 });
  const qs = new URLSearchParams({ key, origin, destination });
  const url = `https://restapi.amap.com/v3/direction/walking?${qs.toString()}`;
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
