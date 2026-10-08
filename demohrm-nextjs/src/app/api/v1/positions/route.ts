export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

// GET /api/v1/positions?order=<order_id> — Tiến độ từng vị trí (v_position_progress)
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const q = getSupabase()
      .from("v_position_progress")
      .select(
        "position_id,order_id,sort_order,title,job_description,shift,start_time,end_time,wage_unit,rate_amount,day_rate,rate_from,rate_to,target_qty,working_qty,waiting_qty,interview_qty,applied_qty,left_qty,progress_pct,remaining_qty",
      )
      .order("order_id")
      .order("sort_order")
      .limit(500);
    const order = searchParams(req).get("order");
    if (order) q.eq("order_id", Number(order));
    const { data, error } = await q;
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
