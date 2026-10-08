export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const FIELDS = ["work_units", "status"] as const;

const STATUS_MAP: Record<string, string> = {
  invalid: "rejected",
  gps_warning: "out_of_range",
  present: "valid",
};

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
    const patch = pick(await readBody(req), FIELDS);
    if (typeof patch.status === "string" && STATUS_MAP[patch.status]) {
      patch.status = STATUS_MAP[patch.status];
    }
    const { data, error } = await getSupabase().from("attendances").update(patch).eq("id", id).select("id,work_units,status").single();
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
    const { error } = await getSupabase().from("attendances").delete().eq("id", id);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
