export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

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

const PATCH_FIELDS = ["name", "target_qty", "note"] as const;

// PATCH /api/v1/orders/:id — Sua ten, chi tieu, ghi chu
export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const body = await readBody(req);
    const patch: Record<string, unknown> = {};
    for (const key of PATCH_FIELDS) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    if (patch["target_qty"] !== undefined) patch["target_qty"] = Number(patch["target_qty"]);
    if (Object.keys(patch).length === 0) {
      return json({ error: "bad_request", message: "Không có thông tin để sửa." }, 400);
    }
    const { data, error } = await getSupabase()
      .from("orders")
      .update(patch)
      .eq("id", Number(p["id"]))
      .select("id,name,target_qty,note")
      .single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
