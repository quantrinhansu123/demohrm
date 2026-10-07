export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

// GET /api/v1/reports/daily?date=&company= — Bao cao ngay
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const date = sp.get("date") ?? new Date().toISOString().slice(0, 10);
    const companyParam = sp.get("company");
    const company = companyParam ? Number(companyParam) : null;
    const { data, error } = await getSupabase().rpc("fn_daily_report", { p_date: date, p_company_id: company });
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
