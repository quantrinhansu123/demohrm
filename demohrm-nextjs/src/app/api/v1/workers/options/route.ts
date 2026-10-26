export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

/** Cột tối thiểu cho select/search — không extras, không CCCD, không count. */
const OPTIONS_COLUMNS = "id,code,full_name,phone,company,current_position,status";

function safeSearch(raw: unknown): string {
  return String(raw ?? "").replace(/[%_,.()]/g, "").trim().slice(0, 80);
}

function clampLimit(raw: string | null, fallback = 40, max = 100): number {
  const n = Number(raw ?? fallback);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), max) : fallback;
}

function positiveId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/v1/workers/options — danh sách gọn cho searchable select
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const limit = clampLimit(sp.get("limit"));
    const needle = safeSearch(sp.get("q"));
    const selectedId = positiveId(sp.get("id"));

    let q = getSupabase()
      .from("v_workers_public")
      .select(OPTIONS_COLUMNS)
      .order("code")
      .limit(limit);

    if (needle) {
      q = q.or(`full_name.ilike.%${needle}%,code.ilike.%${needle}%,phone.ilike.%${needle}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = [...((data ?? []) as Array<Record<string, unknown>>)];
    const hasSelected = selectedId != null && rows.some((row) => Number(row["id"]) === selectedId);

    if (selectedId != null && !hasSelected) {
      const one = await getSupabase()
        .from("v_workers_public")
        .select(OPTIONS_COLUMNS)
        .eq("id", selectedId)
        .maybeSingle();
      if (one.error) throw one.error;
      if (one.data) rows.unshift(one.data as Record<string, unknown>);
    }

    return json({
      rows: rows.map((row) => ({
        id: Number(row["id"]),
        code: String(row["code"] ?? ""),
        full_name: String(row["full_name"] ?? ""),
        phone: String(row["phone"] ?? ""),
        company: (row["company"] as string | null) ?? null,
        current_position: (row["current_position"] as string | null) ?? null,
        status: String(row["status"] ?? ""),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
