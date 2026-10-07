export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const FIELDS = ["code", "name", "short_name", "type", "representative", "phone", "contract_active", "fee_per_worker_day", "status"] as const;
const LIST = "id,code,name,short_name,type,representative,phone,contract_active,fee_per_worker_day,status";

function pick(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const { data, error } = await getSupabase()
      .from("vendors")
      .select("id,code,name,short_name,type,representative,phone,contract_active,fee_per_worker_day,status")
      .order("name");
    if (error) throw error;
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const body = pick(await readBody(req), FIELDS);
    if (!body["code"] || !body["name"]) return json({ error: "invalid", message: "Thiếu mã hoặc tên vendor." }, 400);
    const { data, error } = await getSupabase().from("vendors").insert(body).select(LIST).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
