export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("order_positions")
      .select("id,order_id,title,sort_order")
      .order("order_id")
      .order("sort_order")
      .limit(500);
    if (error) throw error;
    return json(data ?? []);
  } catch (e) {
    return apiError(e);
  }
}
