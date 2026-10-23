export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const COLUMNS = "id,company_name,unit_price,period_code,created_at,updated_at";
const WORKER_PAGE = 1000;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function companyKey(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("vi");
}

function addCount(map: Map<string, number>, name: unknown, quantity = 1): void {
  const key = companyKey(name);
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + quantity);
}

/** Đếm NLĐ đang làm theo tên công ty trên v_workers_public.company (thường là short_name). */
async function loadWorkingCountsByCompany(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (let offset = 0; offset < 50000; offset += WORKER_PAGE) {
    const { data, error } = await getSupabase()
      .from("v_workers_public")
      .select("company")
      .eq("status", "working")
      .range(offset, offset + WORKER_PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) addCount(map, (row as { company?: string | null }).company);
    if (batch.length < WORKER_PAGE) break;
  }
  return map;
}

async function loadCompanyAliases(): Promise<Array<{ short_name: string; name: string | null }>> {
  const { data, error } = await getSupabase().from("companies").select("short_name,name").limit(2000);
  if (error) throw error;
  return ((data ?? []) as Array<{ short_name: string; name: string | null }>).map((row) => ({
    short_name: String(row.short_name ?? ""),
    name: row.name == null ? null : String(row.name),
  }));
}

function workerCountFor(
  companyName: string,
  byCompany: Map<string, number>,
  companies: Array<{ short_name: string; name: string | null }>,
): number {
  const key = companyKey(companyName);
  if (!key) return 0;
  if (byCompany.has(key)) return byCompany.get(key) ?? 0;

  const match = companies.find(
    (company) => companyKey(company.short_name) === key || companyKey(company.name) === key,
  );
  if (!match) return 0;

  return (
    byCompany.get(companyKey(match.short_name)) ??
    byCompany.get(companyKey(match.name)) ??
    0
  );
}

// GET /api/v1/commissions?period=2026-10 — Hoa hồng dự kiến theo công ty.
export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.commission);
    const period = searchParams(req).get("period");

    let entriesQuery = getSupabase().from("commission_entries").select(COLUMNS).order("company_name").limit(500);
    if (period) entriesQuery = entriesQuery.eq("period_code", period);

    const [entriesResult, byCompany, companies] = await Promise.all([
      entriesQuery,
      loadWorkingCountsByCompany(),
      loadCompanyAliases(),
    ]);
    if (entriesResult.error) throw entriesResult.error;

    const rows = ((entriesResult.data ?? []) as Array<Record<string, unknown>>).map((entry) => {
      const workerCount = workerCountFor(String(entry["company_name"] ?? ""), byCompany, companies);
      const unitPrice = Number(entry["unit_price"]) || 0;
      return {
        ...entry,
        worker_count: workerCount,
        commission_amount: unitPrice * workerCount,
      };
    });
    return json(rows);
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/v1/commissions — Thêm dòng hoa hồng cho một công ty.
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.commission);
    const body = await readBody(req);
    const companyName = cleanText(body["company_name"], 150);
    const periodCode = cleanText(body["period_code"], 30);
    const unitPrice = Number(body["unit_price"]);

    if (!companyName) return json({ error: "invalid", message: "Nhập tên công ty." }, 400);
    if (!periodCode) return json({ error: "invalid", message: "Thiếu kỳ tính hoa hồng." }, 400);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return json({ error: "invalid", message: "Đơn giá không hợp lệ." }, 400);
    }

    const { data, error } = await getSupabase()
      .from("commission_entries")
      .insert({
        company_name: companyName,
        unit_price: unitPrice,
        period_code: periodCode,
        created_by: positiveInt(auth.staffId),
      })
      .select(COLUMNS)
      .single();
    if (error) throw error;

    await writeAudit(auth, {
      action: "CREATE",
      table: "commission_entries",
      recordId: (data as { id: number }).id,
      detail: `Thêm hoa hồng ${companyName} - ${unitPrice.toLocaleString("vi-VN")} đ`,
    });
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
