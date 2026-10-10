export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

const LIST = "id,work_date,check_in_at,check_out_at,check_in_lat,check_in_lng,check_in_distance_m,work_units,status,worker:workers(code,full_name),site:work_sites(name),shift:shifts(name)";

function clampPage(sp: URLSearchParams, fallback = 100, max = 200): { limit: number; offset: number } {
  const limitRaw = Number(sp.get("limit") ?? fallback);
  const offsetRaw = Number(sp.get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), max) : fallback;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  return { limit, offset };
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const { limit, offset } = clampPage(sp, 100, 200);
    let q = getSupabase().from("attendances").select(LIST, { count: "exact" }).order("work_date", { ascending: false }).order("id", { ascending: false });
    const date = sp.get("date");
    if (date) q = q.eq("work_date", date);
    const worker = sp.get("worker");
    if (worker) q = q.eq("worker_id", Number(worker));
    const { data, error, count } = await q.range(offset, offset + limit - 1);
    if (error) throw error;
    return json({ rows: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return apiError(e);
  }
}
