export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const ORDER_FIELDS = [
  "code", "company_id", "work_site_id", "period_id", "name", "owner_staff_id", "team_id",
  "start_date", "end_date", "target_qty", "status", "health", "note",
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

// GET /api/v1/orders/:id — Chi tiet don
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const { data, error } = await getSupabase()
      .from("v_order_progress")
      .select("*")
      .eq("order_id", Number(p["id"]))
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return json({ error: "not_found" }, 404);
    }
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function missingRelation(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01" || error?.code === "42703";
}

async function countRows(table: string, column: string, value: number | number[]): Promise<number> {
  if (Array.isArray(value) && value.length === 0) return 0;
  let q = getSupabase().from(table).select("id", { count: "exact", head: true });
  q = Array.isArray(value) ? q.in(column, value) : q.eq(column, value);
  const { count, error } = await q;
  if (missingRelation(error)) return 0;
  if (error) throw error;
  return count ?? 0;
}

// PATCH /api/v1/orders/:id — Sua thong tin don
export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = pick(await readBody(req), ORDER_FIELDS);
    const { data, error } = await getSupabase().from("orders").update(body).eq("id", id).select("id,code,name,status").single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

// DELETE /api/v1/orders/:id — Xoa don chua co nguoi lao dong
export async function DELETE(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const { data: order, error: missing } = await getSupabase().from("orders").select("id").eq("id", id).maybeSingle();
    if (missing) throw missing;
    if (!order) return json({ error: "not_found", message: "Không tìm thấy đơn." }, 404);

    const { data: positions, error: posErr } = await getSupabase().from("order_positions").select("id").eq("order_id", id);
    if (posErr) throw posErr;
    const positionIds = ((positions ?? []) as Array<{ id: number }>).map((row) => row.id);

    if (await countRows("worker_placements", "order_position_id", positionIds) > 0) {
      return json({ error: "in_use", message: "Đơn đang có người lao động, không xóa được." }, 409);
    }
    if (
      (await countRows("vendor_quotas", "order_id", id)) > 0 ||
      (await countRows("quota_assignments", "order_id", id)) > 0 ||
      (await countRows("quota_assignments", "order_position_id", positionIds)) > 0
    ) {
      return json({ error: "in_use", message: "Đơn đang có hạn mức hoặc chỉ tiêu, không xóa được." }, 409);
    }

    if (await countRows("daily_report_notes", "order_id", id) > 0) {
      const { error } = await getSupabase().from("daily_report_notes").delete().eq("order_id", id);
      if (error && !missingRelation(error)) throw error;
    }
    if (positionIds.length > 0) {
      const { error: wageErr } = await getSupabase().from("position_wage_rates").delete().in("position_id", positionIds);
      if (wageErr && !missingRelation(wageErr)) throw wageErr;
      const { error: delPos } = await getSupabase().from("order_positions").delete().eq("order_id", id);
      if (delPos) throw delPos;
    }
    const { error } = await getSupabase().from("orders").delete().eq("id", id);
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "23503") return json({ error: "in_use", message: "Đơn đang được dùng, không xóa được." }, 409);
      throw error;
    }
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
