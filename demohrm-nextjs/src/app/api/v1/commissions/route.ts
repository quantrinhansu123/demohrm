export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

// GET /api/v1/commissions?period=2026-10 — Hoa hong du kien (chi director/deputy_director)
export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.commission);
    const sp = searchParams(req);
    let q = getSupabase().from("v_commission_estimate").select("period_code,code,full_name,company,work_days,rate_per_day,commission_amount").limit(500);
    const period = sp.get("period");
    if (period) q = q.eq("period_code", period);
    const { data, error } = await q;
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
