export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { attachOrderMedia } from "@/lib/server/order-media";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";

const ORDER_FIELDS = [
  "code",
  "company_id",
  "work_site_id",
  "period_id",
  "name",
  "owner_staff_id",
  "team_id",
  "start_date",
  "end_date",
  "target_qty",
  "status",
  "health",
  "note",
] as const;
const POSITION_FIELDS = [
  "title",
  "job_description",
  "requirements",
  "target_qty",
  "shift_id",
  "wage_unit",
  "bill_rate",
  "assignee_staff_id",
  "assignee_vendor_id",
] as const;

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

// GET /api/v1/orders?period=2026-10 — The don hang + vi tri
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const q = getSupabase()
      .from("v_order_progress")
      .select(
        "order_id,code,company,company_name,name,start_date,end_date,owner,status,health,target_qty,working_qty,waiting_qty,interview_qty,applied_qty,total_profiles,position_count,vendor_count",
      )
      .order("order_id")
      .limit(200);
    const period = searchParams(req).get("period");
    if (period) q.eq("period_code", period);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Array<{ order_id: number }>;
    return json(await attachOrderMedia(rows));
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/v1/orders — Tao don hang kem vi tri tuyen
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = await readBody(req);
    const raw = body as { positions?: unknown[] };
    const order = pick(body, ORDER_FIELDS);
    if (auth.staffId) order["created_by"] = Number(auth.staffId);
    const { data: created, error } = await getSupabase()
      .from("orders")
      .insert(order)
      .select("id,code,name,status")
      .single();
    if (error) throw error;
    const createdId = (created as { id: number }).id;
    if (Array.isArray(raw.positions) && raw.positions.length > 0) {
      const rows = raw.positions.map((pos, i) => ({
        ...pick(pos, POSITION_FIELDS),
        order_id: createdId,
        sort_order: i + 1,
      }));
      const { error: e2 } = await getSupabase().from("order_positions").insert(rows);
      if (e2) {
        await getSupabase().from("orders").delete().eq("id", createdId);
        throw e2;
      }
    }
    return json(created, 201);
  } catch (e) {
    return apiError(e);
  }
}
