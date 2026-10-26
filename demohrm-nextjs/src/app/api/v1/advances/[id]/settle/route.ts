export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
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

    const current = await getSupabase()
      .from("advances")
      .select("id,code,status,amount,settled_at,advance_date")
      .eq("id", id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy phiếu tạm ứng." }, 404);
    if (current.data.status !== "paid") {
      return json({ error: "invalid", message: "Chỉ quyết toán phiếu đã chi tiền." }, 400);
    }
    if (current.data.settled_at) {
      return json({ error: "invalid", message: "Phiếu này đã được quyết toán." }, 400);
    }
    const body = await readBody(req);
    const settledRaw = body["settled_amount"];
    const settledAmount =
      settledRaw === undefined || settledRaw === null || settledRaw === ""
        ? Number(current.data.amount)
        : Number(settledRaw);
    if (!Number.isFinite(settledAmount) || settledAmount < 0) {
      return json({ error: "invalid", message: "Số tiền quyết toán không hợp lệ." }, 400);
    }

    const { data, error } = await getSupabase()
      .from("advances")
      .update({
        status: "settled",
        settled_at: new Date().toISOString(),
        settled_amount: settledAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id,code,status,settled_at,settled_amount")
      .single();
    if (error) throw error;

    await writeAudit(auth, {
      action: "SETTLE",
      table: "advances",
      recordId: id,
      detail: `Quyết toán phiếu tạm ứng ${current.data.code}`,
    });
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
