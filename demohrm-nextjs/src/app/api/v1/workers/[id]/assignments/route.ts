export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// GET /api/v1/workers/:id/assignments — Lich su dieu dong cua NLD
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const { data: w, error: e0 } = await getSupabase().from("workers").select("code").eq("id", id).single();
    if (e0) throw e0;
    const { data, error } = await getSupabase()
      .from("v_worker_assignments")
      .select("*")
      .eq("worker_code", (w as { code: string }).code)
      .order("start_date");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
