export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/duplicate-alerts — Bao cao trung
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase().from("v_duplicate_report").select("*").limit(200);
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
