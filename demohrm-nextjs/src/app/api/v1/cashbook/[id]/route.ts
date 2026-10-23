export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import { CASHBOOK_COLUMNS, cashbookPayload, isSystemCashbookEntry } from "@/lib/server/cashbook";

function positiveInt(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadEntry(id: number) {
  return getSupabase().from("cashbook_entries").select(CASHBOOK_COLUMNS).eq("id", id).maybeSingle();
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

    const current = await loadEntry(id);
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy khoản chi." }, 404);
    if (isSystemCashbookEntry(current.data)) {
      return json(
        { error: "locked", message: "Khoản chi từ tạm ứng không được sửa. Hãy xử lý trên màn Tạm ứng." },
        400,
      );
    }

    const parsed = cashbookPayload(await readBody(req), true);
    if (parsed.error || !parsed.value) return json({ error: "invalid", message: parsed.error }, 400);

    const keys = Object.keys(parsed.value).filter((key) => key !== "updated_at");
    if (keys.length === 0) return json({ error: "invalid", message: "Không có dữ liệu để cập nhật." }, 400);

    const { data, error } = await getSupabase()
      .from("cashbook_entries")
      .update(parsed.value)
      .eq("id", id)
      .is("source_type", null)
      .select(CASHBOOK_COLUMNS)
      .single();
    if (error) throw error;

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
    const id = positiveInt(params["id"] ?? "");
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const current = await loadEntry(id);
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy khoản chi." }, 404);
    if (isSystemCashbookEntry(current.data)) {
      return json(
        { error: "locked", message: "Khoản chi từ tạm ứng không được xóa. Hãy xử lý trên màn Tạm ứng." },
        400,
      );
    }

    const { error } = await getSupabase()
      .from("cashbook_entries")
      .delete()
      .eq("id", id)
      .is("source_type", null);
    if (error) throw error;

    await writeAudit(auth, {
      action: "DELETE",
      table: "cashbook_entries",
      recordId: id,
      detail: `Xóa khoản chi ${current.data.content} - ${Number(current.data.amount).toLocaleString("vi-VN")} đ`,
    });
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
