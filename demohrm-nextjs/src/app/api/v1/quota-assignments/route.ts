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

// POST /api/v1/quota-assignments — Giao chi tieu cho nhom/thanh vien
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), [
      "period_id",
      "team_id",
      "staff_id",
      "order_id",
      "order_position_id",
      "target_qty",
      "due_date",
      "label",
    ]);
    if (auth.staffId) body["assigned_by"] = Number(auth.staffId);
    const { data, error } = await getSupabase()
      .from("quota_assignments")
      .insert(body)
      .select("id,target_qty")
      .single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
