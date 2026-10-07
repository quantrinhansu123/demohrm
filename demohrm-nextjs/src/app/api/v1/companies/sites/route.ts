export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/companies/sites — Danh sach dia diem lam viec (toi da 200)
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("work_sites")
      .select("id,company_id,name,address,latitude,longitude,geofence_radius_m,status")
      .order("name")
      .limit(200);
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
