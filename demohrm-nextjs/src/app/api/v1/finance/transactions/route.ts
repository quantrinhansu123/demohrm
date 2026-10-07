export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const LIST = "id,code,txn_date,type,description,amount,status,created_by,category:finance_categories(name),company:companies(short_name),worker:workers(code,full_name)";

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function clampPage(sp: URLSearchParams, fallback = 100, max = 200): { limit: number; offset: number } {
  const limitRaw = Number(sp.get("limit") ?? fallback);
  const offsetRaw = Number(sp.get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), max) : fallback;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  return { limit, offset };
}

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const { limit, offset } = clampPage(searchParams(req), 100, 200);
    const { data, error, count } = await getSupabase()
      .from("finance_transactions")
      .select(LIST, { count: "exact" })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return json({ rows: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const body = pick(await readBody(req), ["code", "txn_date", "type", "category_id", "period_id", "description", "company_id", "vendor_id", "worker_id", "amount", "status"]);
    if (auth.staffId) body["created_by"] = Number(auth.staffId);
    const { data, error } = await getSupabase().from("finance_transactions").insert(body).select(LIST).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
