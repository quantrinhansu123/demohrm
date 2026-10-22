export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import {
  CASHBOOK_COLUMNS,
  cashbookDate,
  cashbookPayload,
  isCashbookGroup,
} from "@/lib/server/cashbook";

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

    const from = cashbookDate(sp.get("from"));
    const to = cashbookDate(sp.get("to"));
    if (from) q = q.gte("entry_date", from);
    if (to) q = q.lte("entry_date", to);

    const group = sp.get("group");
    if (group === "other") q = q.in("group_code", ["other", "advance"]);
    else if (group && isCashbookGroup(group)) q = q.eq("group_code", group);

    const company = sp.get("company")?.trim();
    if (company) q = q.ilike("company_name", `%${company}%`);

    const search = sp.get("q")?.trim();
    if (search) {
      q = q.or(
        `content.ilike.%${search}%,full_name.ilike.%${search}%,company_name.ilike.%${search}%,note.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await q;
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
    const parsed = cashbookPayload(await readBody(req));
    if (parsed.error || !parsed.value) return json({ error: "invalid", message: parsed.error }, 400);

    const { data, error } = await getSupabase()
      .from("cashbook_entries")
      .insert(parsed.value)
      .select(CASHBOOK_COLUMNS)
      .single();
    if (error) throw error;

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
