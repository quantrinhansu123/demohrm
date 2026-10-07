export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const q = getSupabase()
      .from("v_payroll_preview")
      .select(
        "period_code,worker_id,code,full_name,companies,work_days,wage_amount,extra_amount,deduction,advance_amount,net_amount,has_variance",
      )
      .limit(500);
    const period = searchParams(req).get("period");
    if (period) q.eq("period_code", period);
    const worker = searchParams(req).get("worker");
    if (worker) q.eq("code", worker);
    const { data, error } = await q;
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
