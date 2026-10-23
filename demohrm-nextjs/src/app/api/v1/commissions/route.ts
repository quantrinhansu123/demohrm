export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const COLUMNS = "id,company_name,unit_price,period_code,created_at,updated_at";

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

function addCount(map: Map<string, number>, name: unknown, quantity: number): void {
  const key = companyKey(name);
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + quantity);
}

function buildWorkerCounts(rows: Array<Record<string, unknown>>): {
  byShortName: Map<string, number>;
  byFullName: Map<string, number>;
} {
  const byShortName = new Map<string, number>();
  const byFullName = new Map<string, number>();
  for (const row of rows) {
    const quantity = Number(row["working_qty"]) || 0;
    addCount(byShortName, row["company"], quantity);
    addCount(byFullName, row["company_name"], quantity);
  }
  return { byShortName, byFullName };
}

function workerCountFor(counts: ReturnType<typeof buildWorkerCounts>, companyName: string): number {
  const key = companyKey(companyName);
  return counts.byFullName.get(key) ?? counts.byShortName.get(key) ?? 0;
}

// GET /api/v1/commissions?period=2026-10 — Hoa hồng dự kiến theo công ty.
export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.commission);
    const period = searchParams(req).get("period");

    let entriesQuery = getSupabase().from("commission_entries").select(COLUMNS).order("company_name").limit(500);
    let ordersQuery = getSupabase().from("v_order_progress").select("company,company_name,working_qty").limit(500);
    if (period) {
      entriesQuery = entriesQuery.eq("period_code", period);
      ordersQuery = ordersQuery.eq("period_code", period);
    }

    const [entriesResult, ordersResult] = await Promise.all([entriesQuery, ordersQuery]);
    if (entriesResult.error) throw entriesResult.error;
    if (ordersResult.error) throw ordersResult.error;

    const counts = buildWorkerCounts((ordersResult.data ?? []) as Array<Record<string, unknown>>);
    const rows = ((entriesResult.data ?? []) as Array<Record<string, unknown>>).map((entry) => {
      const workerCount = workerCountFor(counts, String(entry["company_name"] ?? ""));
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
