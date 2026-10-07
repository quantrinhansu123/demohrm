export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

function clampPage(sp: URLSearchParams, fallback = 100, max = 200): { limit: number; offset: number } {
  const limitRaw = Number(sp.get("limit") ?? fallback);
  const offsetRaw = Number(sp.get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), max) : fallback;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  return { limit, offset };
}

// GET /api/v1/audit-logs — Nhat ky thao tac
export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.audit);
    const { limit, offset } = clampPage(searchParams(req), 100, 200);
    const { data, error, count } = await getSupabase()
      .from("audit_logs")
      .select("id,occurred_at,actor_id,actor_role,action,table_name,record_id,detail,ip_address", { count: "exact" })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return json({ rows: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return apiError(e);
  }
}
