export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

// GET /api/v1/reports/daily/workers?date=&order= — NLD trong bao cao ngay cua don
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const { data, error } = await getSupabase().rpc("fn_daily_report_workers", {
      p_date: sp.get("date") ?? new Date().toISOString().slice(0, 10),
      p_order_id: Number(sp.get("order") ?? undefined),
    });
    if (error) throw error;
    const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
      worker_code: r["worker_code"],
      full_name: r["full_name"],
      phone: r["phone"],
      position: r["position_title"] ?? r["position"] ?? "",
      position_title: r["position_title"] ?? r["position"] ?? "",
      start_date: r["start_date"] ?? "",
      end_date: r["end_date"] ?? null,
      status_today: r["day_status"] ?? r["status_today"] ?? "",
      day_status: r["day_status"] ?? r["status_today"] ?? "",
      check_in_at: r["check_in"] ?? r["check_in_at"] ?? null,
      check_out_at: r["check_out"] ?? r["check_out_at"] ?? null,
      handover_status: r["handover_status"] ?? null,
      supervisor_name: r["supervisor_name"] ?? null,
      supervisor_phone: r["supervisor_phone"] ?? null,
    }));
    return json(mapped);
  } catch (e) {
    return apiError(e);
  }
}
