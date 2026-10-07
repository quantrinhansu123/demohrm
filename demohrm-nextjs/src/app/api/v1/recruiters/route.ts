export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/recruiters — Nguoi tuyen/nguon va so NLD
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("v_recruiter_workers")
      .select("source_type,source_id,source_code,source_name,total_workers,working,waiting_start,inactive")
      .order("total_workers", { ascending: false })
      .limit(200);
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
