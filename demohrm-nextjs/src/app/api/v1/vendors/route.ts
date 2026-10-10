export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { vendorPayload } from "@/lib/server/vendor";

const VENDOR_COLS = "id,code,name,short_name,type,representative,phone,contract_active,fee_per_worker_day,status";

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase().from("vendors").select(VENDOR_COLS).order("name");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const body = vendorPayload(await readBody(req), true);
    if (body instanceof Response) return body;
    const { data, error } = await getSupabase().from("vendors").insert(body).select(VENDOR_COLS).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
