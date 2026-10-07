export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    let q = getSupabase()
      .from("vendor_quotas")
      .select("id,quota_qty,sla_target_pct,handover_deadline,vendor:vendors(name,short_name,phone,representative,status),company:companies(short_name)")
      .limit(200);
    const period = sp.get("period");
    if (period) q = q.eq("period_id", Number(period));
    const { data, error } = await q;
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const body = pick(await readBody(req), ["vendor_id", "company_id", "shift_id", "period_id", "order_id", "quota_qty", "handover_deadline", "sla_target_pct", "sla_note"]);
    const { data, error } = await getSupabase().from("vendor_quotas").insert(body).select("id,quota_qty").single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
