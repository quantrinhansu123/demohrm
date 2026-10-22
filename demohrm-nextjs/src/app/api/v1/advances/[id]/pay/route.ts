export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const params = await ctx.params;
    const id = Number(params["id"]);
    if (!Number.isInteger(id) || id <= 0) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }

    const { data, error } = await getSupabase().rpc("fn_pay_advance", {
      p_advance_id: id,
      p_staff_id: Number(auth.staffId),
    });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") {
        return json(
          { error: "missing_migration", message: "Chưa chạy migration chi tạm ứng. Hãy chạy supabase/fn_pay_advance.sql." },
          400,
        );
      }
      throw error;
    }

    await writeAudit(auth, {
      action: "PAY",
      table: "advances",
      recordId: id,
      detail: "Chi tiền tạm ứng và ghi sổ chi",
    });
    return json({ ok: true, result: data });
  } catch (e) {
    return apiError(e);
  }
}
