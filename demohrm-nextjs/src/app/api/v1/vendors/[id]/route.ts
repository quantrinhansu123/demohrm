export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const FIELDS = ["code", "name", "short_name", "type", "representative", "phone", "contract_active", "fee_per_worker_day", "status"] as const;
const LIST = "id,code,name,short_name,type,representative,phone,contract_active,fee_per_worker_day,status";

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

export async function PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    getAuth(req);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { data, error } = await getSupabase().from("vendors").update(pick(await readBody(req), FIELDS)).eq("id", id).select(LIST).single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<Record<string, string>> }): Promise<Response> {
  try {
    getAuth(req);
    const id = positiveInt((await ctx.params)["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { error } = await getSupabase().from("vendors").delete().eq("id", id);
    if (error) {
      if ((error as { code?: string }).code === "23503") {
        return json({ error: "in_use", message: "Vendor đang được dùng, không xóa được." }, 409);
      }
      throw error;
    }
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
