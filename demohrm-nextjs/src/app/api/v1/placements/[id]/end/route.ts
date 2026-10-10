export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

// PATCH /api/v1/placements/:id/end — Ket thuc dot (ngay ra, ly do). Khong xoa dot cu.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const { end_date, end_reason } = (await readBody(req)) as {
      end_date: string;
      end_reason?: string;
    };
    const { data, error } = await getSupabase()
      .from("worker_placements")
      .update({ end_date, end_reason })
      .eq("id", Number(p["id"]))
      .select()
      .single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
