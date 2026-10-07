export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/handovers/by-placement/:placementId — Phieu ban giao cua 1 dot
export async function GET(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const { data, error } = await getSupabase()
      .from("handovers")
      .select("id,placement_id,status,handed_over_at,received_at")
      .eq("placement_id", Number(p["placementId"]))
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return json({ error: "not_found", message: "Dot nay chua co phieu ban giao." }, 404);
    }
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
