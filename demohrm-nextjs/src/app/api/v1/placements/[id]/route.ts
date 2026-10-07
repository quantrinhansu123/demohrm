export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

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
    const body = await readBody(req);
    const patch: Record<string, unknown> = {};
    if (typeof body["start_date"] === "string") patch["start_date"] = body["start_date"];
    if (typeof body["note"] === "string" || body["note"] === null) patch["note"] = body["note"];
    const { data, error } = await getSupabase().from("worker_placements").update(patch).eq("id", id).select("id,start_date,note").single();
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
    const { error } = await getSupabase().from("worker_placements").delete().eq("id", id);
    if (error) {
      if ((error as { code?: string }).code === "23503") {
        return json({ error: "in_use", message: "Đợt đang có chấm công hoặc bàn giao, không xóa được." }, 409);
      }
      throw error;
    }
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
