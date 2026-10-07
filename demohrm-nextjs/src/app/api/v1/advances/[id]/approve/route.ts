export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

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

export async function PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const body = pick(await readBody(req), ["status", "payment_method"]);
    const status = body["status"];
    if (status !== "approved" && status !== "paid" && status !== "rejected") {
      return json({ error: "invalid", message: "Trạng thái duyệt không hợp lệ." }, 400);
    }
    if (auth.staffId) body["approved_by"] = Number(auth.staffId);
    body["approved_at"] = new Date().toISOString();
    const { data, error } = await getSupabase().from("salary_advances").update(body).eq("id", id).select("id,code,status,amount").single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
