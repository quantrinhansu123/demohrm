export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

// POST /api/v1/placements/by-code — Them dot lam viec theo ma don (chuyen/quay lai cong ty).
// Body: { worker_id, order_code, position?, recruiter_id?, supervisor_id?, stage?, start_date }
// Tu ket thuc dot dang mo (end_date = start_date moi) roi tao dot moi, giu lich su cu.
export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const b = (await readBody(req)) as {
      worker_id: number;
      order_code: string;
      position?: string;
      recruiter_id?: number | null;
      supervisor_id?: number | null;
      stage?: string;
      start_date: string;
    };
    const { data: order, error: e0 } = await getSupabase()
      .from("orders")
      .select("id")
      .eq("code", b.order_code)
      .single();
    if (e0) throw e0;
    const posBase = getSupabase()
      .from("order_positions")
      .select("id")
      .eq("order_id", (order as { id: number }).id)
      .order("sort_order");
    const posQ = b.position ? posBase.ilike("title", `%${b.position}%`) : posBase;
    const { data: pos, error: e1 } = await posQ.limit(1).maybeSingle();
    if (e1) throw e1;
    if (!pos) {
      return json(
        { error: "position_not_found", message: `Don ${b.order_code} khong co vi tri phu hop.` },
        400,
      );
    }
    const { data: openRows, error: eOpen } = await getSupabase()
      .from("worker_placements")
      .select("id, start_date")
      .eq("worker_id", b.worker_id)
      .is("end_date", null);
    if (eOpen) throw eOpen;
    const typedOpenRows = (openRows ?? []) as Array<{ id: number; start_date: string | null }>;
    for (const r of typedOpenRows) {
      if (r.start_date && b.start_date < r.start_date) {
        return json(
          {
            error: "invalid_date",
            message: `Ngày vào của đợt mới (${b.start_date}) không được trước ngày vào của đợt đang làm (${r.start_date}).`,
          },
          400,
        );
      }
    }
    const openIds = typedOpenRows.map((r) => r.id);
    const { error: e2 } = await getSupabase()
      .from("worker_placements")
      .update({ end_date: b.start_date, end_reason: `Chuyen sang ${b.order_code}` })
      .eq("worker_id", b.worker_id)
      .is("end_date", null);
    if (e2) throw e2;
    const { data, error: e3 } = await getSupabase()
      .from("worker_placements")
      .insert({
        worker_id: b.worker_id,
        order_position_id: (pos as { id: number }).id,
        recruiter_id: b.recruiter_id ?? null,
        supervisor_id: b.supervisor_id ?? null,
        stage: b.stage ?? "working",
        start_date: b.start_date,
      })
      .select("id,worker_id,start_date,stage")
      .single();
    if (e3) {
      if (openIds.length > 0) {
        await getSupabase()
          .from("worker_placements")
          .update({ end_date: null, end_reason: null })
          .in("id", openIds);
      }
      throw e3;
    }
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
