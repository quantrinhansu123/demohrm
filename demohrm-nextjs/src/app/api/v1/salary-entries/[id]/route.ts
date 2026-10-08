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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const rawBody = (await readBody(req)) as Record<string, unknown>;
    const body = pick(rawBody, [
      "work_days",
      "daily_rate",
      "amount",
      "content",
      "entry_type",
      "placement_id",
      "entry_date",
      "voided_at",
      "void_reason",
    ]);
    if (rawBody.reason && !body.void_reason) {
      body.void_reason = String(rawBody.reason);
    }
    if (auth.staffId) {
      body["updated_by"] = Number(auth.staffId);
      if (body.voided_at) body["voided_by"] = Number(auth.staffId);
    }
    const { data, error } = await getSupabase()
      .from("salary_entries")
      .update(body)
      .eq("id", id)
      .select("id,code,amount,voided_at,void_reason")
      .single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
