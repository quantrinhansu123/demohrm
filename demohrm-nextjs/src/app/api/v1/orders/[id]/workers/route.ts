export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/orders/:id/workers — Danh sách NLĐ của đơn
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const orderId = Number(p["id"]);
    if (!orderId) {
      return json({ error: "invalid", message: "Id đơn hàng không hợp lệ." }, 400);
    }
    const { data, error } = await getSupabase()
      .from("v_order_workers")
      .select("*")
      .eq("order_id", orderId)
      .order("position")
      .order("worker_code");
    if (error) throw error;
    return json(data ?? []);
  } catch (e) {
    return apiError(e);
  }
}
