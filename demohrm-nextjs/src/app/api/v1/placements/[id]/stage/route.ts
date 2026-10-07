export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// PATCH /api/v1/placements/:id/stage — Chuyen buoc pheu (hen PV, cho nhan viec, di lam)
export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    const stage = ((await readBody(req)) as { stage?: unknown }).stage;
    if (!id || typeof stage !== "string" || !stage) {
      return json({ error: "invalid", message: "Thiếu bước phễu." }, 400);
    }
    const { data, error } = await getSupabase()
      .from("worker_placements")
      .update({ stage })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
