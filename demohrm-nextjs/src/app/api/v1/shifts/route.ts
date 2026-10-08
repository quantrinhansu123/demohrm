export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

// GET /api/v1/shifts?company_id=...
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const companyId = searchParams(req).get("company_id");
    let q = getSupabase()
      .from("shifts")
      .select("id,company_id,name,start_time,end_time,is_default")
      .order("name");
    if (companyId) {
      q = q.eq("company_id", Number(companyId));
    }
    const { data, error } = await q;
    if (error) throw error;
    return json(data ?? []);
  } catch (e) {
    return apiError(e);
  }
}
