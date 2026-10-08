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
    const id = Number(p["id"]);
    if (!id || Number.isNaN(id)) {
      return json({ error: "invalid_id", message: "ID đợt làm việc không hợp lệ." }, 400);
    }
    if (!end_date) {
      return json({ error: "missing_end_date", message: "Vui lòng chọn ngày kết thúc đợt." }, 400);
    }
    const { data: cur, error: eFind } = await getSupabase()
      .from("worker_placements")
      .select("start_date")
      .eq("id", id)
      .single();
    if (eFind || !cur) {
      return json({ error: "not_found", message: "Không tìm thấy đợt làm việc." }, 404);
    }
    if (cur.start_date && end_date < cur.start_date) {
      return json({ error: "invalid_date", message: "Ngày kết thúc không được trước ngày vào." }, 400);
    }
    const { data, error } = await getSupabase()
      .from("worker_placements")
      .update({ end_date, end_reason: end_reason?.trim() || "Kết thúc đợt" })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
