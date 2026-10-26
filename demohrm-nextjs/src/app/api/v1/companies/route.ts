export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { ForbiddenError, apiError, json, readBody } from "@/lib/server/http";
import { companyPayload } from "@/lib/server/company";
import { ROLE } from "@/lib/server/roles";

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

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    try {
      requireRole(auth, ...ROLE.companyWrite);
    } catch {
      throw new ForbiddenError("Chỉ Ban lãnh đạo và Kỹ thuật được tạo công ty.");
    }
    const body = companyPayload(await readBody(req), true);
    if (body instanceof Response) return body;
    const { data, error } = await getSupabase().from("companies").insert({ ...body, status: "active" }).select(COMPANY_COLS).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
