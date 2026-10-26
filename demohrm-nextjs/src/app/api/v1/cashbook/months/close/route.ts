export const runtime = "nodejs";

import { isCashbookMonthClosed, nextMonthCode, parseMonthCode } from "@/lib/server/cashbook-months";
import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import { CASHBOOK_MIGRATION_MESSAGE, isCashbookSchemaError } from "@/lib/server/cashbook-errors";

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.closePeriod);

    const body = await readBody(req);
    const month = parseMonthCode(body["month"]);
    if (!month) {
      return json({ error: "invalid", message: "Mã tháng không hợp lệ (YYYY-MM)." }, 400);
    }

    if (await isCashbookMonthClosed(month)) {
      return json({ error: "duplicate", message: `Tháng ${month} đã được kết thúc.` }, 409);
    }

    const note = typeof body["note"] === "string" ? body["note"].trim().slice(0, 500) : "";
    const { data, error } = await getSupabase()
      .from("cashbook_month_closes")
      .insert({
        month_code: month,
        closed_by: Number(auth.staffId) || null,
        note: note || null,
      })
      .select("month_code,closed_at,closed_by,note")
      .single();
    if (error) {
      if (isCashbookSchemaError(error.message)) {
        return json({ error: "missing_migration", message: CASHBOOK_MIGRATION_MESSAGE }, 400);
      }
      throw error;
    }

    await writeAudit(auth, {
      action: "CLOSE",
      table: "cashbook_month_closes",
      recordId: month,
      detail: `Kết thúc tháng chi ${month}`,
    });

    return json({
      ...data,
      next_month: nextMonthCode(month),
    });
  } catch (e) {
    return apiError(e);
  }
}

/** Xóa bản ghi kết thúc tháng (tháng sẽ mở lại). */
export async function DELETE(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.closePeriod);

    const month = parseMonthCode(searchParams(req).get("month"));
    if (!month) {
      return json({ error: "invalid", message: "Mã tháng không hợp lệ (YYYY-MM)." }, 400);
    }

    if (!(await isCashbookMonthClosed(month))) {
      return json({ error: "invalid", message: `Tháng ${month} chưa có bản ghi kết thúc tháng.` }, 400);
    }

    const { error } = await getSupabase()
      .from("cashbook_month_closes")
      .delete()
      .eq("month_code", month);
    if (error) throw error;

    await writeAudit(auth, {
      action: "DELETE",
      table: "cashbook_month_closes",
      recordId: month,
      detail: `Xóa kết thúc tháng chi ${month}`,
    });

    return json({ month_code: month, status: "open" as const, deleted: true });
  } catch (e) {
    return apiError(e);
  }
}
