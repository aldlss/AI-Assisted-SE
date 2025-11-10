import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();
  const { searchParams } = new URL(req.url);
  const tripId = searchParams.get("tripId");
  if (!tripId) return NextResponse.json({ error: "missing tripId" }, { status: 400 });

  const { data, error } = await supabase
    .from("expenses")
    .select("id,trip_id,item_id,category,amount,occurred_at,note")
    .eq("trip_id", tripId)
    .order("occurred_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { trip_id, item_id, category, amount, occurred_at, note } = body ?? {};
  if (!trip_id || typeof amount !== "number") return NextResponse.json({ error: "invalid payload" }, { status: 400 });

  const supabase = await createSupabaseRouteHandlerClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({ trip_id, item_id: item_id ?? null, category: category ?? "other", amount, occurred_at: occurred_at ?? new Date().toISOString(), note: note ?? null })
    .select("id,trip_id,item_id,category,amount,occurred_at,note")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
