export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/periods/:code/dashboard — So lieu tong quan chu ky
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const code = p["code"] as string;
    const sb = getSupabase();
    const { data, error } = await sb.from("v_period_dashboard").select("*").eq("code", code).maybeSingle();
    if (error) throw error;
    if (data) return json(data);
    const period = await sb.from("periods").select("code,name,status,start_date,end_date").eq("code", code).maybeSingle();
    if (period.error) throw period.error;
    if (!period.data) return json({ error: "not_found", message: "Không tìm thấy kỳ này." }, 404);
    return json({
      ...period.data,
      order_count: 0,
      target_qty: 0,
      working_qty: 0,
      total_work_days: 0,
      approved_advances: 0,
      advance_workers: 0,
    });
  } catch (e) {
    return apiError(e);
  }
}
