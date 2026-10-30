export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import {
  CASHBOOK_COLUMNS,
  applyCashbookCompanyFilter,
  applyCashbookGroupFilter,
  cashbookCompanyFilters,
  cashbookDate,
  cashbookMonth,
  cashbookPayload,
  cashbookSearchTerm,
} from "@/lib/server/cashbook";
import { CASHBOOK_MIGRATION_MESSAGE, isCashbookSchemaError } from "@/lib/server/cashbook-errors";

function clampPage(sp: URLSearchParams, fallback = 200, max = 500): { limit: number; offset: number } {
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
    const sp = searchParams(req);
    const { limit, offset } = clampPage(sp);
    let q = getSupabase()
      .from("cashbook_entries")
      .select(CASHBOOK_COLUMNS, { count: "exact" })
      .order("entry_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    const month = cashbookMonth(sp.get("month"));
    if (month) {
      q = q.eq("expense_month", month);
    } else {
      const from = cashbookDate(sp.get("from"));
      const to = cashbookDate(sp.get("to"));
      if (from) q = q.gte("entry_date", from);
      if (to) q = q.lte("entry_date", to);
    }

    q = applyCashbookGroupFilter(q, sp.get("group"));

    q = applyCashbookCompanyFilter(q, cashbookCompanyFilters(sp));

    const workerId = Number(sp.get("worker_id") ?? "");
    if (Number.isFinite(workerId) && workerId > 0) q = q.eq("worker_id", workerId);

    const staffId = Number(sp.get("staff_id") ?? "");
    if (Number.isFinite(staffId) && staffId > 0) q = q.eq("staff_id", staffId);

    const search = cashbookSearchTerm(sp.get("q"));
    if (search) {
      q = q.or(
        `content.ilike.%${search}%,full_name.ilike.%${search}%,company_name.ilike.%${search}%,note.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await q;
    if (error) {
      if (isCashbookSchemaError(error.message)) {
        return json({ error: "missing_migration", message: CASHBOOK_MIGRATION_MESSAGE }, 400);
      }
      throw error;
    }
    return json({ rows: data ?? [], total: count ?? 0, limit, offset });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const parsed = await cashbookPayload(await readBody(req));
    if (parsed.error || !parsed.value) return json({ error: "invalid", message: parsed.error }, 400);

    const { data, error } = await getSupabase()
      .from("cashbook_entries")
      .insert(parsed.value)
      .select(CASHBOOK_COLUMNS)
      .single();
    if (error) {
      if (isCashbookSchemaError(error.message)) {
        return json({ error: "missing_migration", message: CASHBOOK_MIGRATION_MESSAGE }, 400);
      }
      throw error;
    }

    await writeAudit(auth, {
      action: "INSERT",
      table: "cashbook_entries",
      recordId: data.id as number,
      detail: `Thêm khoản chi ${data.content} - ${Number(data.amount).toLocaleString("vi-VN")} đ`,
    });
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
