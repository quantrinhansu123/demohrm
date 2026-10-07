export const runtime = "nodejs";

import { randomBytes } from "crypto";

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

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function advanceCode(): string {
  const now = new Date();
  const prefix = `TU-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  return `${prefix}${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    let q = getSupabase()
      .from("salary_advances")
      .select("id,code,worker_id,period_id,amount,reason,status,worker:workers(code,full_name)")
      .order("id", { ascending: false })
      .limit(100);
    const status = sp.get("status");
    if (status) q = q.eq("status", status);
    const period = sp.get("period");
    if (period) q = q.eq("period_id", Number(period));
    const { data, error } = await q;
    if (error) throw error;
    return json(data ?? []);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), ["worker_id", "placement_id", "period_id", "amount", "reason"]);
    if (!positiveInt(body["worker_id"]) || !positiveInt(body["period_id"]) || !(Number(body["amount"]) > 0)) {
      return json({ error: "invalid", message: "Thiếu người lao động, kỳ hoặc số tiền." }, 400);
    }
    body["code"] = advanceCode();
    body["status"] = "requested";
    if (auth.staffId) body["requested_by"] = Number(auth.staffId);
    const { data, error } = await getSupabase().from("salary_advances").insert(body).select("id,code,worker_id,period_id,amount,reason,status").single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
