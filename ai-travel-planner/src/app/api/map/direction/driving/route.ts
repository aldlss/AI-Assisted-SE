import { NextRequest, NextResponse } from "next/server";

// 通过服务端代理调用高德驾车路径规划 Web Service
// 调用示例：/api/map/direction/driving?origin=116.481028,39.989643&destination=116.434446,39.90816
export async function GET(req: NextRequest) {
  const key = process.env.AMAP_REST_KEY;
  if (!key) {
    return NextResponse.json(
      { code: "CONFIG_MISSING", message: "服务端未配置 AMAP_REST_KEY" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  const strategy = searchParams.get("strategy") || "0"; // 策略可选，默认速度优先
  if (!origin || !destination) {
    return NextResponse.json(
      { code: "INVALID_PARAMS", message: "缺少 origin 或 destination 参数" },
      { status: 400 }
    );
  }

  const qs = new URLSearchParams({ key, origin, destination, strategy });

  const url = `https://restapi.amap.com/v3/direction/driving?${qs.toString()}`;
  try {
    const r = await fetch(url, { next: { revalidate: 30 } });
    if (!r.ok) throw new Error(`AMap HTTP ${r.status}`);
    const data = await r.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { code: "AMAP_ERROR", message: msg },
      { status: 502 }
    );
  }
}
