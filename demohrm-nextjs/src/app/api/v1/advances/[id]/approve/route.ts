export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const raw = await readBody(req);
    const status = raw["status"];
    if (status !== "approved" && status !== "rejected") {
      return json({ error: "invalid", message: "Trạng thái duyệt không hợp lệ." }, 400);
    }

    const current = await getSupabase()
      .from("advances")
      .select("id,status,advance_date")
      .eq("id", id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return json({ error: "not_found", message: "Không tìm thấy phiếu tạm ứng." }, 404);
    if (current.data.status !== "requested") {
      return json({ error: "invalid", message: "Chỉ duyệt hoặc từ chối phiếu đang chờ duyệt." }, 400);
    }

    const { data, error } = await getSupabase()
      .from("advances")
      .update({
        status,
        approved_by: Number(auth.staffId),
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id,code,status,amount")
      .single();
    if (error) throw error;

    await writeAudit(auth, {
      action: status === "approved" ? "APPROVE" : "REJECT",
      table: "advances",
      recordId: id,
      detail: `${status === "approved" ? "Duyệt" : "Từ chối"} phiếu tạm ứng ${data.code}`,
    });
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
