export const runtime = "nodejs";

import { isCashbookMonthClosed, parseMonthCode } from "@/lib/server/cashbook-months";
import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.closePeriod);

    const body = await readBody(req);
    const month = parseMonthCode(body["month"]);
    if (!month) {
      return json({ error: "invalid", message: "Mã tháng không hợp lệ (YYYY-MM)." }, 400);
    }

    if (!(await isCashbookMonthClosed(month))) {
      return json({ error: "invalid", message: `Tháng ${month} đang mở.` }, 400);
    }

    const { error } = await getSupabase()
      .from("cashbook_month_closes")
      .delete()
      .eq("month_code", month);
    if (error) throw error;

    await writeAudit(auth, {
      action: "REOPEN",
      table: "cashbook_month_closes",
      recordId: month,
      detail: `Mở lại tháng chi ${month}`,
    });

    return json({ month_code: month, status: "open" as const });
  } catch (e) {
    return apiError(e);
  }
}
