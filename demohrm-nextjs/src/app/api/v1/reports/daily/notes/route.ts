export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// POST /api/v1/reports/daily/notes — Ghi chu phat sinh
export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), ["report_date", "order_id", "note"]);
    if (auth.staffId) body["updated_by"] = Number(auth.staffId);
    const { data, error } = await getSupabase().from("daily_report_notes").insert(body).select("id,report_date,order_id,note").single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), ["report_date", "order_id", "note"]);
    if (auth.staffId) body["updated_by"] = Number(auth.staffId);
    const { data, error } = await getSupabase()
      .from("daily_report_notes")
      .update({ note: body["note"], updated_by: body["updated_by"] })
      .eq("report_date", body["report_date"] as string)
      .eq("order_id", Number(body["order_id"]))
      .select("id,report_date,order_id,note");
    if (error) throw error;
    const row = (data ?? [])[0];
    if (!row) return json({ error: "not_found", message: "Chưa có ghi chú." }, 404);
    return json(row);
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const reportDate = sp.get("date");
    const orderId = Number(sp.get("order"));
    if (!reportDate || !Number.isInteger(orderId) || orderId <= 0) {
      return json({ error: "invalid", message: "Thiếu ngày hoặc đơn." }, 400);
    }
    const { error } = await getSupabase().from("daily_report_notes").delete().eq("report_date", reportDate).eq("order_id", orderId);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
