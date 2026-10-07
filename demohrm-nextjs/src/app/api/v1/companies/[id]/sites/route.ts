export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

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

export async function POST(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    getAuth(req);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = await readBody(req);
    const name = typeof body["name"] === "string" ? body["name"].trim() : "";
    if (!name) return json({ error: "invalid", message: "Thiếu tên địa điểm." }, 400);
    const latitude = Number(body["latitude"]);
    const longitude = Number(body["longitude"]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return json({ error: "invalid", message: "Thiếu tọa độ địa điểm." }, 400);
    }
    const row: Record<string, unknown> = {
      company_id: id,
      name,
      address: typeof body["address"] === "string" && body["address"].trim() ? body["address"].trim() : null,
      latitude,
      longitude,
      status: "active",
    };
    if (body["geofence_radius_m"] !== undefined && body["geofence_radius_m"] !== "" && body["geofence_radius_m"] !== null) {
      row["geofence_radius_m"] = Number(body["geofence_radius_m"]);
    }
    const { data, error } = await getSupabase()
      .from("work_sites")
      .insert(row)
      .select("id,company_id,name,address,latitude,longitude,geofence_radius_m,status")
      .single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
