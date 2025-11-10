import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "missing tripId" }, { status: 400 });

  const { data, error } = await supabase.from("budgets").select("id,trip_id,amount_total,currency").eq("trip_id", tripId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { tripId, amount_total, currency } = body ?? {};
  if (!tripId || typeof amount_total !== "number") return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const supabase = await createSupabaseRouteHandlerClient();
  // upsert by trip_id
  const { data, error } = await supabase
    .from("budgets")
    .upsert({ trip_id: tripId, amount_total, currency: currency ?? "CNY" }, { onConflict: "trip_id" })
    .select("id,trip_id,amount_total,currency")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 同步更新 trips.budget_total 以便详情页直接读取
  const { error: tripErr } = await supabase
    .from("trips")
    .update({ budget_total: amount_total })
    .eq("id", tripId);
  if (tripErr) return NextResponse.json({ error: tripErr.message }, { status: 500 });
  return NextResponse.json(data);
}
