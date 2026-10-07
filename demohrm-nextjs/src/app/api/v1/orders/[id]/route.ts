export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

// GET /api/v1/orders/:id — Chi tiet don
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const { data, error } = await getSupabase()
      .from("v_order_progress")
      .select("*")
      .eq("order_id", Number(p["id"]))
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      return json({ error: "not_found" }, 404);
    }
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
