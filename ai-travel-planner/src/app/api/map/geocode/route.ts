import { NextRequest, NextResponse } from "next/server";

// 通过服务端代理调用高德地理编码 Web Service，避免在前端暴露私密 Key
// 调用示例：/api/map/geocode?address=北京市朝阳区
export async function GET(req: NextRequest) {
  const key = process.env.AMAP_REST_KEY;
  if (!key) {
    return NextResponse.json(
      { code: "CONFIG_MISSING", message: "服务端未配置 AMAP_REST_KEY" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const city = searchParams.get("city") || undefined; // 可选城市限定
  if (!address) {
    return NextResponse.json(
      { code: "INVALID_PARAMS", message: "缺少 address 参数" },
      { status: 400 }
    );
  }

  const qs = new URLSearchParams({ key, address });
  if (city) qs.set("city", city);

  const url = `https://restapi.amap.com/v3/geocode/geo?${qs.toString()}`;
  try {
    const r = await fetch(url, { next: { revalidate: 60 } });
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
