export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

function strOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  return String(value);
}

// POST /api/v1/workers/check-duplicates — Kiem tra trung truoc khi tao ho so
export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const b = await readBody(req);
    const { data, error } = await getSupabase().rpc("fn_find_worker_duplicates", {
      p_exclude_id: null,
      p_code: strOrNull(b["code"]),
      p_national_id: strOrNull(b["national_id"]),
      p_old_id: strOrNull(b["old_id_number"]),
      p_phone: strOrNull(b["phone"]),
      p_full_name: strOrNull(b["full_name"]),
      p_dob: strOrNull(b["date_of_birth"]),
    });
    if (error) throw error;
    const hits = (data ?? []) as Array<{ matched_worker_id: number }>;
    // Gan trang thai ho so cu de FE phan biet chan tao moi / cho tai tuyen (RESIGNED_STATUS).
    const ids = [...new Set(hits.map((h) => Number(h.matched_worker_id)).filter((n) => Number.isInteger(n) && n > 0))];
    if (ids.length === 0) return json(hits);
    const { data: workers, error: statusError } = await getSupabase().from("workers").select("id,status").in("id", ids);
    if (statusError) throw statusError;
    const statusById = new Map((workers ?? []).map((w) => [w.id as number, w.status as string]));
    return json(hits.map((h) => ({ ...h, matched_status: statusById.get(Number(h.matched_worker_id)) ?? null })));
  } catch (e) {
    return apiError(e);
  }
}
