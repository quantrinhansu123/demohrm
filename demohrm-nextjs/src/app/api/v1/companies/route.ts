export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

const COMPANY_COLS = "id,code,short_name,name,hotline,contact_name,contact_phone,bill_rate_per_day,status";

// GET /api/v1/companies — Danh sach cong ty dang hoat dong
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase().from("companies").select(COMPANY_COLS).eq("status", "active").order("short_name");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
