export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/teams — Danh sach doi/nhom dang hoat dong
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("teams")
      .select("id,code,name,region,leader_id,status,leader:staff!teams_leader_id_fkey(full_name)")
      .eq("status", "active")
      .order("name");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
