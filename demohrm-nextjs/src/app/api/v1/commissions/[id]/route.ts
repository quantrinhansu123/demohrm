export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const COLUMNS = "id,company_name,unit_price,period_code,created_at,updated_at";

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// PATCH /api/v1/commissions/:id — Sửa tên công ty / đơn giá.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.commission);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const body = await readBody(req);
    const patch: Record<string, unknown> = {};
    if (body["company_name"] !== undefined) {
      const companyName = cleanText(body["company_name"], 150);
      if (!companyName) return json({ error: "invalid", message: "Nhập tên công ty." }, 400);
      patch["company_name"] = companyName;
    }
    if (body["unit_price"] !== undefined) {
      const unitPrice = Number(body["unit_price"]);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return json({ error: "invalid", message: "Đơn giá không hợp lệ." }, 400);
      }
      patch["unit_price"] = unitPrice;
    }
    if (body["period_code"] !== undefined) {
      const periodCode = cleanText(body["period_code"], 30);
      if (!periodCode) return json({ error: "invalid", message: "Thiếu kỳ tính hoa hồng." }, 400);
      patch["period_code"] = periodCode;
    }
    if (Object.keys(patch).length === 0) {
      return json({ error: "invalid", message: "Không có dữ liệu để cập nhật." }, 400);
    }
    patch["updated_at"] = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from("commission_entries")
      .update(patch)
      .eq("id", id)
      .select(COLUMNS)
      .single();
    if (error) throw error;

    await writeAudit(auth, {
      action: "UPDATE",
      table: "commission_entries",
      recordId: id,
      detail: `Sửa hoa hồng ${(data as { company_name: string }).company_name}`,
    });
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

// DELETE /api/v1/commissions/:id — Chỉ Ban lãnh đạo và Kỹ thuật được xóa.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.deleteRecords);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const { data, error } = await getSupabase()
      .from("commission_entries")
      .delete()
      .eq("id", id)
      .select("id,company_name")
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "not_found", message: "Không tìm thấy dòng hoa hồng." }, 404);

    await writeAudit(auth, {
      action: "DELETE",
      table: "commission_entries",
      recordId: id,
      detail: `Xóa hoa hồng ${(data as { company_name: string }).company_name}`,
    });
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
