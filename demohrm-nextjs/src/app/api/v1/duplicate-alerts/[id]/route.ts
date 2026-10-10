export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function pick(src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
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

// PATCH /api/v1/duplicate-alerts/:id — Ghi ket luan (khong tu gop/xoa ho so)
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
    const body = pick(await readBody(req), ["status", "review_note", "assigned_to"]);
    if (auth.staffId) body["reviewed_by"] = Number(auth.staffId);
    body["reviewed_at"] = new Date().toISOString();
    const { data, error } = await getSupabase().from("duplicate_alerts").update(body).eq("id", id).select("id,status,review_note").single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
