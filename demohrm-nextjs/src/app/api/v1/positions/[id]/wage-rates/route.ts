export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// POST /api/v1/positions/:id/wage-rates — Them muc luong moi (dong muc cu)
export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const positionId = positiveInt(p["id"]);
    if (!positionId) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const body = await readBody(req);
    const rest = pick(body, ["wage_unit", "rate_amount", "day_rate", "note"]);
    const effectiveFrom = (body as { effective_from?: unknown }).effective_from;
    if (typeof effectiveFrom !== "string" || !effectiveFrom) {
      return json({ error: "invalid", message: "Thiếu ngày hiệu lực." }, 400);
    }
    const { data: openRates, error: e0 } = await getSupabase()
      .from("position_wage_rates")
      .select("id")
      .eq("position_id", positionId)
      .is("effective_to", null);
    if (e0) throw e0;
    const openIds = ((openRates ?? []) as Array<{ id: number }>).map((r) => r.id);
    const { error: e1 } = await getSupabase()
      .from("position_wage_rates")
      .update({ effective_to: effectiveFrom })
      .eq("position_id", positionId)
      .is("effective_to", null);
    if (e1) throw e1;
    const { data, error: e2 } = await getSupabase()
      .from("position_wage_rates")
      .insert({ ...rest, position_id: positionId, effective_from: effectiveFrom })
      .select("id,position_id,effective_from,rate_amount")
      .single();
    if (e2) {
      if (openIds.length > 0)
        await getSupabase().from("position_wage_rates").update({ effective_to: null }).in("id", openIds);
      throw e2;
    }
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
