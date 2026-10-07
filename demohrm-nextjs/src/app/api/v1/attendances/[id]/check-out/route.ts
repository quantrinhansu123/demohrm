export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const LIST = "id,work_date,check_in_at,check_out_at,check_in_lat,check_in_lng,check_in_distance_m,work_units,status,worker:workers(code,full_name),site:work_sites(name),shift:shifts(name)";

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function POST(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const body = pick(await readBody(req), ["check_out_lat", "check_out_lng", "note"]);
    const patch: Record<string, unknown> = { check_out_at: new Date().toISOString() };
    if (body["check_out_lat"] != null) patch["check_out_lat"] = Number(body["check_out_lat"]);
    if (body["check_out_lng"] != null) patch["check_out_lng"] = Number(body["check_out_lng"]);
    if (typeof body["note"] === "string") patch["note"] = body["note"];
    const { data, error } = await getSupabase().from("attendances").update(patch).eq("id", id).select(LIST).single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
