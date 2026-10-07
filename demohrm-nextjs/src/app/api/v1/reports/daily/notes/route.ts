export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// POST /api/v1/reports/daily/notes — Ghi chu phat sinh
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), ["report_date", "order_id", "note"]);
    if (auth.staffId) body["updated_by"] = Number(auth.staffId);
    const { data, error } = await getSupabase().from("daily_report_notes").insert(body).select("id,report_date,order_id,note").single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
