export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { removeOrderMedia } from "@/lib/server/order-media";
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

// DELETE /api/v1/orders/:id — Xoa don hang
export async function DELETE(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const id = Number((await ctx.params)["id"]);
    if (!Number.isInteger(id) || id <= 0) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    await removeOrderMedia(id);
    const positions = await getSupabase().from("order_positions").delete().eq("order_id", id);
    if (positions.error) {
      if (positions.error.code === "23503") {
        return json({ error: "foreign_key", message: "Đơn này đang có người lao động, chưa xóa được." }, 400);
      }
      throw positions.error;
    }
    const { error } = await getSupabase().from("orders").delete().eq("id", id);
    if (error) {
      if (error.code === "23503") {
        return json({ error: "foreign_key", message: "Đơn này đang có người lao động, chưa xóa được." }, 400);
      }
      throw error;
    }
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
