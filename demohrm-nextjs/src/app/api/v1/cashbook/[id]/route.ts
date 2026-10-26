export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import {
  CASHBOOK_COLUMNS,
  cashbookPayload,
  isSystemCashbookEntry,
  parsePositiveId,
} from "@/lib/server/cashbook";
import { CASHBOOK_MIGRATION_MESSAGE, isCashbookSchemaError } from "@/lib/server/cashbook-errors";

async function loadEntry(id: number) {
  return getSupabase().from("cashbook_entries").select(CASHBOOK_COLUMNS).eq("id", id).maybeSingle();
}

/** Gỡ liên kết sổ chi tạm ứng (legacy) và đưa phiếu về đã duyệt nếu còn. */
async function unlinkAdvanceCashbook(entryId: number, sourceId: number | null) {
  const cols = "id,code,status,advance_date,cashbook_entry_id";
  let advance: { id: number; code: string; status: string; advance_date: string; cashbook_entry_id: number | null } | null =
    null;

  if (sourceId && sourceId > 0) {
    const bySource = await getSupabase().from("advances").select(cols).eq("id", sourceId).maybeSingle();
    if (bySource.error) throw bySource.error;
    advance = bySource.data;
  }
  if (!advance) {
    const byLink = await getSupabase().from("advances").select(cols).eq("cashbook_entry_id", entryId).maybeSingle();
    if (byLink.error) throw byLink.error;
    advance = byLink.data;
  }
  if (!advance) {
    return { advance: null as null };
  }

  const paidOrSettled = advance.status === "paid" || advance.status === "settled";
  const { error } = await getSupabase()
    .from("advances")
    .update({
      ...(paidOrSettled
        ? {
            status: "approved",
            paid_at: null,
            settled_at: null,
            settled_amount: null,
          }
        : {}),
      cashbook_entry_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", advance.id);
  if (error) throw error;
  return { advance };
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const params = await ctx.params;
    const id = parsePositiveId(params["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const current = await loadEntry(id);
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy khoản chi." }, 404);

    const parsed = await cashbookPayload(await readBody(req), true);
    if (parsed.error || !parsed.value) return json({ error: "invalid", message: parsed.error }, 400);

    const keys = Object.keys(parsed.value).filter((key) => key !== "updated_at");
    if (keys.length === 0) return json({ error: "invalid", message: "Không có dữ liệu để cập nhật." }, 400);

    // Cho phép sửa cả khoản chi legacy từ tạm ứng (màn tạm ứng đã bỏ).
    const { data, error } = await getSupabase()
      .from("cashbook_entries")
      .update(parsed.value)
      .eq("id", id)
      .select(CASHBOOK_COLUMNS)
      .single();
    if (error) {
      if (isCashbookSchemaError(error.message)) {
        return json({ error: "missing_migration", message: CASHBOOK_MIGRATION_MESSAGE }, 400);
      }
      throw error;
    }

    await writeAudit(auth, {
      action: "UPDATE",
      table: "cashbook_entries",
      recordId: id,
      detail: `Sửa khoản chi ${data.content} - ${Number(data.amount).toLocaleString("vi-VN")} đ`,
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
    const id = parsePositiveId(params["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const current = await loadEntry(id);
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy khoản chi." }, 404);

    const fromAdvance = isSystemCashbookEntry(current.data);
    let advanceCode: string | null = null;
    if (fromAdvance) {
      const sourceId = current.data.source_id == null ? null : Number(current.data.source_id);
      const { advance } = await unlinkAdvanceCashbook(id, Number.isFinite(sourceId) ? sourceId : null);
      if (advance) advanceCode = String(advance.code);
    }

    const { error } = await getSupabase().from("cashbook_entries").delete().eq("id", id);
    if (error) throw error;

    await writeAudit(auth, {
      action: "DELETE",
      table: "cashbook_entries",
      recordId: id,
      detail: fromAdvance
        ? `Xóa khoản chi (legacy tạm ứng) ${current.data.content} - ${Number(current.data.amount).toLocaleString("vi-VN")} đ${
            advanceCode ? ` (phiếu ${advanceCode} → đã duyệt)` : ""
          }`
        : `Xóa khoản chi ${current.data.content} - ${Number(current.data.amount).toLocaleString("vi-VN")} đ`,
    });
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
