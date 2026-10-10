export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

// GET /api/v1/reports/daily/workers?date=&order= — NLD trong bao cao ngay cua don
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const { data, error } = await getSupabase().rpc("fn_daily_report_workers", {
      p_date: sp.get("date") ?? new Date().toISOString().slice(0, 10),
      p_order_id: Number(sp.get("order") ?? undefined),
    });
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
