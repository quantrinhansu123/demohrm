export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { ForbiddenError, apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

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

export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    try {
      requireRole(auth, ...ROLE.companyWrite);
    } catch {
      throw new ForbiddenError("Chỉ Ban lãnh đạo và Kỹ thuật được sửa công ty.");
    }
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = await readBody(req);
    const name = typeof body["name"] === "string" ? body["name"].trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 120) return json({ error: "bad_request", message: "Nhập địa điểm, tối đa 120 ký tự." }, 400);
    const address = typeof body["address"] === "string" && body["address"].trim() ? body["address"].trim() : name;
    let latitude = Number(body["latitude"]);
    let longitude = Number(body["longitude"]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
      // Khong co toa do that: ke thua tu 1 site cung cong ty da cau hinh, tranh site 0,0 gay tran so khoang cach cham cong.
      const sibling = await getSupabase()
        .from("work_sites")
        .select("latitude,longitude")
        .eq("company_id", id)
        .order("id")
        .limit(20);
      if (!sibling.error) {
        const good = ((sibling.data ?? []) as Array<{ latitude: number | null; longitude: number | null }>).find(
          (s) => Number(s.latitude) !== 0 && Number(s.longitude) !== 0,
        );
        if (good) {
          latitude = Number(good.latitude);
          longitude = Number(good.longitude);
        }
      }
    }
    const { data, error } = await getSupabase()
      .from("work_sites")
      .insert({
        company_id: id,
        name,
        address,
        status: "active",
        latitude: Number.isFinite(latitude) ? latitude : 0,
        longitude: Number.isFinite(longitude) ? longitude : 0,
      })
      .select("id,company_id,name,address,latitude,longitude,geofence_radius_m,status")
      .single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
