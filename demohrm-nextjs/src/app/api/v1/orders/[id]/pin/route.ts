export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

// PATCH /api/v1/orders/:id/pin — Ghim / bo ghim don hang. Body: { pinned: boolean }
export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const id = Number((await ctx.params)["id"]);
    if (!Number.isInteger(id) || id <= 0) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    const body = await readBody(req);
    const pinnedAt = body["pinned"] ? new Date().toISOString() : null;
    const { data, error } = await getSupabase()
      .from("orders")
      .update({ pinned_at: pinnedAt })
      .eq("id", id)
      .select("id,pinned_at")
      .single();
    if (error) {
      if (error.code === "42703" || error.code === "PGRST204") {
        return json({ error: "setup", message: "Chưa thêm cột pinned_at. Chạy supabase/order-pin.sql trước." }, 400);
      }
      throw error;
    }
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
