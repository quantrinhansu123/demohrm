export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/orders/:id/workers — Danh sach NLD cua don
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const { data: order, error: e0 } = await getSupabase()
      .from("orders")
      .select("code")
      .eq("id", Number(p["id"]))
      .single();
    if (e0) throw e0;
    const { data, error } = await getSupabase()
      .from("v_order_workers")
      .select("*")
      .eq("order_code", (order as { code: string }).code)
      .order("position")
      .order("worker_code");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
