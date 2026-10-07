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

function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), ["worker_id", "check_in_lat", "check_in_lng", "note"]);
    const workerId = positiveInt(body["worker_id"]);
    if (!workerId) {
      return json({ error: "invalid", message: "Chọn người lao động." }, 400);
    }
    const row: Record<string, unknown> = {
      worker_id: workerId,
      work_date: todayVN(),
      check_in_at: new Date().toISOString(),
      recorded_by: Number(auth.staffId),
    };
    if (typeof body["note"] === "string" && body["note"]) row["note"] = body["note"];
    if (body["check_in_lat"] != null) row["check_in_lat"] = Number(body["check_in_lat"]);
    if (body["check_in_lng"] != null) row["check_in_lng"] = Number(body["check_in_lng"]);
    const { data: open, error: e0 } = await getSupabase()
      .from("worker_placements")
      .select("id,work_site_id,shift_id")
      .eq("worker_id", workerId)
      .is("end_date", null)
      .limit(1)
      .maybeSingle();
    if (e0) throw e0;
    const placement = open as { id: number; work_site_id: number | null; shift_id: number | null } | null;
    if (placement) {
      row["placement_id"] = placement.id;
      if (placement.work_site_id) row["work_site_id"] = placement.work_site_id;
      if (placement.shift_id) row["shift_id"] = placement.shift_id;
    }
    const { data, error } = await getSupabase().from("attendances").insert(row).select(LIST).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
