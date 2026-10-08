export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("order_positions")
      .select("id,order_id,title,sort_order,job_description,wage_unit,shift_id,orders(id,code,name,company_id,companies(short_name))")
      .order("order_id")
      .order("sort_order")
      .limit(500);
    if (error) throw error;

    const { data: rates } = await getSupabase()
      .from("v_position_current_rate")
      .select("position_id,wage_unit,rate_amount,day_rate,effective_from,effective_to");

    const rateMap = new Map((rates ?? []).map((r) => [r.position_id, r]));

    const flattened = ((data ?? []) as any[]).map((p) => {
      const order = p.orders;
      const rate = rateMap.get(p.id);
      return {
        id: p.id,
        order_id: p.order_id,
        title: p.title,
        sort_order: p.sort_order,
        job_description: p.job_description,
        wage_unit: rate?.wage_unit ?? p.wage_unit ?? "day",
        shift_id: p.shift_id,
        order_code: order?.code ?? "",
        order_name: order?.name ?? "",
        company_name: order?.companies?.short_name ?? "",
        current_rate_amount: rate?.rate_amount ?? null,
        current_day_rate: rate?.day_rate ?? null,
        effective_from: rate?.effective_from ?? null,
        effective_to: rate?.effective_to ?? null,
      };
    });

    return json(flattened);
  } catch (e) {
    return apiError(e);
  }
}
