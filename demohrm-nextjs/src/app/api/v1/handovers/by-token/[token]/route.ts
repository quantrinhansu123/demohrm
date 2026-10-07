export const runtime = "nodejs";

import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";
import { TokenError, verifyHandover } from "@/lib/server/token";

// GET /api/v1/handovers/by-token/:token — Public: thong tin phieu de quan ly xac nhan (khong can login)
export async function GET(_req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    const p = await ctx.params;
    const hid = verifyHandover(p["token"] ?? "");
    const { data, error } = await getSupabase().from("v_handover_board").select("*").eq("handover_id", hid).maybeSingle();
    if (error) throw error;
    if (!data) {
      return json({ error: "not_found" }, 404);
    }
    return json(data);
  } catch (e) {
    if (e instanceof TokenError) {
      return json({ error: "bad_token", message: e.message }, 400);
    }
    return apiError(e);
  }
}
