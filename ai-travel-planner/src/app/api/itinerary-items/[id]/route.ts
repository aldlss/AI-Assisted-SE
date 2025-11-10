import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server";

// 注意：Next.js 16 + React 19 下 context.params 可能为 Promise，需要显式 await
type ParamsPromise = { params: Promise<{ id: string }> };

// DELETE /api/itinerary-items/[id]
export async function DELETE(_req: NextRequest, context: ParamsPromise) {
	const { id } = await context.params;
	if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
	const supabase = await createSupabaseRouteHandlerClient();
	const { error } = await supabase.from("itinerary_items").delete().eq("id", id);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ success: true });
}
