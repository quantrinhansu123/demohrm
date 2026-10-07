export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/periods — Danh sach chu ky (de resolve period_id)
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("periods")
      .select("id,code,name,type,status,start_date,end_date")
      .order("start_date", { ascending: false });
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
