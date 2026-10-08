export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

// GET /api/v1/payroll/placements?period=...&worker_id=... — Luong theo tung dot / cong ty
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const period = sp.get("period");
    const workerId = sp.get("worker_id");

    let q = getSupabase()
      .from("v_placement_pay")
      .select("*")
      .order("placement_id", { ascending: false });

    if (period) {
      q = q.eq("period_code", period);
    }
    if (workerId) {
      q = q.eq("worker_id", Number(workerId));
    }

    const { data, error } = await q;
    if (error) throw error;
    return json(data ?? []);
  } catch (e) {
    return apiError(e);
  }
}
