export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

// POST /api/v1/placements — Dua NLD vao vi tri tuyen
export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const body = pick(await readBody(req), [
      "worker_id",
      "order_position_id",
      "work_site_id",
      "vendor_id",
      "recruiter_id",
      "supervisor_id",
      "shift_id",
      "stage",
      "start_date",
      "note",
    ]);
    const { data, error } = await getSupabase()
      .from("worker_placements")
      .insert(body)
      .select("id,worker_id,stage,start_date")
      .single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
