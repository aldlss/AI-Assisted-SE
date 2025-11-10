import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

// 注意：Next.js 16 + React 19 下 context.params 可能为 Promise，需要显式 await
type ParamsPromise = { params: Promise<{ id: string }> };

// PATCH /api/expenses/[id]  更新单条支出
export async function PATCH(req: NextRequest, context: ParamsPromise) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.amount === "number") patch.amount = body.amount;
  if (typeof body.category === "string") patch.category = body.category;
  if (typeof body.note === "string" || body.note === null) patch.note = body.note;
  if (typeof body.item_id === "string" || body.item_id === null) patch.item_id = body.item_id;
  if (typeof body.occurred_at === "string") patch.occurred_at = body.occurred_at; // ISO 字符串

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "empty patch" }, { status: 400 });
  const supabase = await createSupabaseRouteHandlerClient();
  const { data, error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .select("id,trip_id,item_id,category,amount,occurred_at,note")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/expenses/[id]
export async function DELETE(_req: NextRequest, context: ParamsPromise) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const supabase = await createSupabaseRouteHandlerClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
