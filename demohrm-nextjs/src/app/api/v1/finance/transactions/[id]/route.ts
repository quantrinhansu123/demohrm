export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const FIELDS = ["txn_date", "type", "category_id", "period_id", "description", "company_id", "vendor_id", "worker_id", "amount", "status"] as const;
const LIST = "id,code,txn_date,type,description,amount,status,category:finance_categories(name),company:companies(short_name)";

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
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
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { data, error } = await getSupabase().from("finance_transactions").update(pick(await readBody(req), FIELDS)).eq("id", id).select(LIST).single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { error } = await getSupabase().from("finance_transactions").delete().eq("id", id);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
