export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { ForbiddenError, apiError, json, readBody } from "@/lib/server/http";
import { hashPin } from "@/lib/server/pin";
import { ROLE } from "@/lib/server/roles";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// POST /api/v1/staff/:id/reset-pin — BGĐ đặt lại PIN cho nhân sự (không cần PIN cũ).
export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    try {
      requireRole(auth, ...ROLE.staffPinReset);
    } catch {
      throw new ForbiddenError("Chỉ Ban giám đốc được đặt lại mật khẩu.");
    }
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    if (String(id) === auth.staffId) {
      return json({ error: "bad_request", message: "Để đổi PIN của chính bạn, dùng chức năng Đổi mật khẩu." }, 400);
    }
    const body = await readBody(req);
    const newPin = typeof body["new_pin"] === "string" ? body["new_pin"] : "";
    if (!newPin || newPin.length < 4) {
      return json({ error: "bad_request", message: "Mật khẩu mới tối thiểu 4 ký tự." }, 400);
    }
    if (newPin.length > 32) {
      return json({ error: "bad_request", message: "Mật khẩu tối đa 32 ký tự." }, 400);
    }
    const { error } = await getSupabase().from("staff").update({ pin_hash: hashPin(newPin) }).eq("id", id);
    if (error) throw error;
    await writeAudit(auth, {
      action: "RESET_PIN",
      table: "staff",
      recordId: id,
      detail: `BGĐ đặt lại PIN cho nhân sự #${id}`,
    });
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
