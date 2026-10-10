export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// GET /api/v1/companies/:id/sites — Dia diem lam viec cua 1 cong ty
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const { data, error } = await getSupabase()
      .from("work_sites")
      .select("id,company_id,name,address,latitude,longitude,geofence_radius_m,status")
      .eq("company_id", id)
      .order("name");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
