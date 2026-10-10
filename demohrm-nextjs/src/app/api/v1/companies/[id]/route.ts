export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { companyPayload } from "@/lib/server/company";
import { apiError, json, readBody } from "@/lib/server/http";

const COMPANY_COLS = "id,code,short_name,name,hotline,contact_name,contact_phone,bill_rate_per_day,status";

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
    const id = positiveInt((await ctx.params).id);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { data, error } = await getSupabase().from("companies").select(COMPANY_COLS).eq("id", id).single();
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
    const id = positiveInt((await ctx.params).id);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = companyPayload(await readBody(req), false);
    if (body instanceof Response) return body;
    const { data, error } = await getSupabase().from("companies").update(body).eq("id", id).select(COMPANY_COLS).single();
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
    const id = positiveInt((await ctx.params).id);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const { error } = await getSupabase().from("companies").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return json({ error: "foreign_key", message: "Khách hàng này đang có đơn hàng hoặc địa điểm, chưa xóa được." }, 400);
      }
      throw error;
    }
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
