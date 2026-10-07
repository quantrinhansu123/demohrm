export const runtime = "nodejs";

import { writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, clientIp, json, readBody } from "@/lib/server/http";
import { TokenError, verifyHandover } from "@/lib/server/token";

// PATCH /api/v1/handovers/by-token/:token/receive|refuse — Quan ly xac nhan/tu choi qua link (public)
export async function PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    const p = await ctx.params;
    const action = p["action"] ?? "";
    if (action !== "receive" && action !== "refuse") {
      return json({ error: "invalid", message: "Hành động không hợp lệ." }, 400);
    }
    const hid = verifyHandover(p["token"] ?? "");
    const body = await readBody(req);
    const patch: Record<string, unknown> =
      action === "receive"
        ? { status: "received", received_at: new Date().toISOString(), received_channel: "link", received_by_name: body["received_by_name"] ?? null }
        : { status: "refused", refuse_reason: body["refuse_reason"] ?? null };
    const { data, error } = await getSupabase().from("handovers").update(patch).eq("id", hid).select("id,status,received_at,refuse_reason").single();
    if (error) throw error;
    await writeAudit(
      { ip: clientIp(req) },
      {
        action: "APPROVE",
        table: "handovers",
        recordId: hid,
        detail: `Quản lý xác nhận qua link: ${action}`,
      }
    );
    return json(data);
  } catch (e) {
    if (e instanceof TokenError) {
      return json({ error: "bad_token", message: e.message }, 400);
    }
    return apiError(e);
  }
}
