export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

// POST /api/v1/periods/:code/close — Sinh luong theo cong, chot vao payrolls, khoa ky
export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.closePeriod);
    const p = await ctx.params;
    const staffId = Number(auth.staffId ?? 0);
    const { data, error } = await getSupabase().rpc("fn_close_period", {
      p_period_code: p["code"] as string,
      p_staff_id: staffId,
    });
    if (error) throw error;
    return json({ ok: true, result: data });
  } catch (e) {
    return apiError(e);
  }
}
