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

export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const body = pick(await readBody(req), ["vendor_id", "company_id", "shift_id", "period_id", "work_date", "quota_qty", "actual_qty", "note"]);
    const { data, error } = await getSupabase().from("vendor_shift_reconciliations").insert(body).select("id").single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
