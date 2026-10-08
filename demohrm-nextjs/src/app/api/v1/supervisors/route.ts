export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const companyId = sp.get("company_id");
    let query = getSupabase().from("company_supervisors").select("*").eq("status", "active").order("full_name");
    if (companyId) {
      query = query.eq("company_id", Number(companyId));
    }
    const { data, error } = await query;
    if (error) throw error;
    return json(data ?? []);
  } catch (e) {
    return apiError(e);
  }
}
