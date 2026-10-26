export const runtime = "nodejs";

import { assertAdvanceMonthOpen } from "@/lib/server/advance-months";
import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const COLUMNS =
  "id,code,subject_type,worker_id,staff_id,amount,reason,status,advance_date,advance_time,requested_by,note,updated_at";

function positiveInt(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : "";
}

function advanceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}

function advanceTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const params = await ctx.params;
    const id = positiveInt(params["id"] ?? "");
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const current = await getSupabase()
      .from("advances")
      .select("id,code,status,advance_date")
      .eq("id", id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy phiếu tạm ứng." }, 404);
    if (current.data.status !== "requested") {
      return json({ error: "invalid", message: "Chỉ sửa được phiếu đang chờ duyệt." }, 400);
    }
    const currentLocked = await assertAdvanceMonthOpen(String(current.data.advance_date));
    if (currentLocked) return currentLocked;

    const body = await readBody(req);
    const patch: Record<string, unknown> = {};
    if (body["amount"] !== undefined) {
      const amount = Number(body["amount"]);
      if (!Number.isFinite(amount) || amount <= 0) {
        return json({ error: "invalid", message: "Số tiền không hợp lệ." }, 400);
      }
      patch["amount"] = amount;
    }
    if (body["reason"] !== undefined) {
      const reason = text(body["reason"], 300);
      if (!reason) return json({ error: "invalid", message: "Nhập lý do tạm ứng." }, 400);
      patch["reason"] = reason;
    }
    if (body["advance_date"] !== undefined) {
      const date = advanceDate(body["advance_date"]);
      if (!date) return json({ error: "invalid", message: "Ngày tạm ứng không hợp lệ." }, 400);
      const targetLocked = await assertAdvanceMonthOpen(date);
      if (targetLocked) return targetLocked;
      patch["advance_date"] = date;
    }
    if (body["advance_time"] !== undefined) {
      const time = advanceTime(body["advance_time"]);
      if (!time) return json({ error: "invalid", message: "Giờ tạm ứng không hợp lệ." }, 400);
      patch["advance_time"] = time;
    }
    if (body["note"] !== undefined) patch["note"] = text(body["note"], 2000) || null;

    if (Object.keys(patch).length === 0) {
      return json({ error: "invalid", message: "Không có dữ liệu để cập nhật." }, 400);
    }
    patch["updated_at"] = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from("advances")
      .update(patch)
      .eq("id", id)
      .select(COLUMNS)
      .single();
    if (error) throw error;

    await writeAudit(auth, {
      action: "UPDATE",
      table: "advances",
      recordId: id,
      detail: `Sửa phiếu tạm ứng ${data.code}`,
    });
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.deleteRecords);
    const params = await ctx.params;
    const id = positiveInt(params["id"] ?? "");
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const current = await getSupabase()
      .from("advances")
      .select("id,code,status,advance_date")
      .eq("id", id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy phiếu tạm ứng." }, 404);

    const status = String(current.data.status);
    // Ban lãnh đạo / Kỹ thuật được xóa phiếu đã quyết toán khi tháng còn mở.
    const directorDeleteSettled = status === "settled";
    if (status === "paid") {
      return json({ error: "invalid", message: "Không thể hủy phiếu đã chi. Hãy quyết toán trước hoặc liên hệ quản trị." }, 400);
    }
    if (status === "cancelled" || status === "rejected") {
      return json({ error: "invalid", message: "Phiếu này đã hủy hoặc từ chối." }, 400);
    }
    if (!directorDeleteSettled && status !== "requested" && status !== "approved") {
      return json({ error: "invalid", message: "Không thể hủy phiếu ở trạng thái hiện tại." }, 400);
    }
    const monthLocked = await assertAdvanceMonthOpen(String(current.data.advance_date));
    if (monthLocked) return monthLocked;

    const { error } = await getSupabase()
      .from("advances")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    await writeAudit(auth, {
      action: directorDeleteSettled ? "DELETE" : "CANCEL",
      table: "advances",
      recordId: id,
      detail: directorDeleteSettled
        ? `Xóa phiếu tạm ứng đã quyết toán ${current.data.code}`
        : `Hủy phiếu tạm ứng ${current.data.code}`,
    });
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
