export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const WRITE = ["code", "short_name", "name", "hotline", "contact_name", "contact_phone", "bill_rate_per_day", "status"] as const;

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

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
    getAuth(req);
    const body = pick(await readBody(req), WRITE);
    if (!body["code"] || !body["short_name"] || !body["name"]) {
      return json({ error: "invalid", message: "Thiếu mã, tên ngắn hoặc tên công ty." }, 400);
    }
    if (!body["status"]) body["status"] = "active";
    const { data, error } = await getSupabase().from("companies").insert(body).select(COMPANY_COLS).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
