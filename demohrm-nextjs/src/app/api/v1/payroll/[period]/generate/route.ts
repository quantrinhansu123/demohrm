export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.closePeriod);
    const p = await ctx.params;
    const { data, error } = await getSupabase().rpc("fn_generate_wage_entries", {
      p_period_code: p["period"] as string,
      p_staff_id: Number(auth.staffId ?? 0),
    });
    if (error) throw error;
    return json({ ok: true, result: data });
  } catch (e) {
    return apiError(e);
  }
}
