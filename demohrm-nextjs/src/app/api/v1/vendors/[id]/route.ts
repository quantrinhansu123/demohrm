export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { vendorPayload } from "@/lib/server/vendor";

const VENDOR_COLS = "id,code,name,short_name,type,representative,phone,contract_active,fee_per_worker_day,status";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    getAuth(req);
    const { id: raw } = await ctx.params;
    const id = positiveInt(raw);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { data, error } = await getSupabase().from("vendors").select(VENDOR_COLS).eq("id", id).single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    getAuth(req);
    const { id: raw } = await ctx.params;
    const id = positiveInt(raw);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = vendorPayload(await readBody(req), false);
    if (body instanceof Response) return body;
    const { data, error } = await getSupabase().from("vendors").update(body).eq("id", id).select(VENDOR_COLS).single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    getAuth(req);
    const { id: raw } = await ctx.params;
    const id = positiveInt(raw);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { error } = await getSupabase().from("vendors").delete().eq("id", id);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
