export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

// GET /api/v1/salary-entries?worker=&period= — Tung lan nhap luong
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const q = getSupabase()
      .from("salary_entries")
      .select(
        "id,code,worker_id,period_id,entry_type,work_days,daily_rate,amount,content,entry_date,voided_at",
      )
      .order("id")
      .limit(200);
    const worker = searchParams(req).get("worker");
    if (worker) q.eq("worker_id", Number(worker));
    const period = searchParams(req).get("period");
    if (period) q.eq("period_id", Number(period));
    const { data, error } = await q;
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/v1/salary-entries — Dong nhap moi (bo sung). Sua: UPDATE (trigger luu lich su). Huy: voided_at.
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), [
      "code",
      "worker_id",
      "placement_id",
      "period_id",
      "entry_type",
      "work_days",
      "daily_rate",
      "amount",
      "content",
      "entry_date",
    ]);
    if (auth.staffId) body["entered_by"] = Number(auth.staffId);
    const { data, error } = await getSupabase()
      .from("salary_entries")
      .insert(body)
      .select("id,code,amount")
      .single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
