export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/staff — Danh sach nhan su dang hoat dong
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("staff")
      .select("id,code,full_name,role,title,status")
      .eq("status", "active")
      .order("full_name");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
