import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

// Next.js 16: params 可能是 Promise
type ParamsPromise = { params: Promise<{ id: string }> };

// DELETE /api/trips/[id]  删除整个行程
export async function DELETE(_req: NextRequest, context: ParamsPromise) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const supabase = await createSupabaseRouteHandlerClient();
  // RLS 确保只能删除自己的 trip；外键 on delete cascade 会级联删除 itineraries/items/budgets/expenses
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
