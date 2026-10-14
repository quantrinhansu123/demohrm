export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const WORKER_INSERT = [
  "code", "full_name", "phone", "date_of_birth", "gender", "hometown", "permanent_address",
  "national_id", "old_id_number", "employment_type", "status", "current_company_id",
  "current_position", "recruiter_id", "manager_id", "source_vendor_id", "note",
  "consult_date", "start_work_date", "resign_date",
] as const;

const PUBLIC_RETURN = "id,code,full_name,phone,hometown,employment_type,status,current_position,current_company_id,recruiter_id";

function pick(src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

function clampPage(sp: URLSearchParams, fallback = 50, max = 200): { limit: number; offset: number } {
  const limitRaw = Number(sp.get("limit") ?? fallback);
  const offsetRaw = Number(sp.get("offset") ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), max) : fallback;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  return { limit, offset };
}

function safeSearch(raw: unknown): string {
  return String(raw ?? "").replace(/[%_,.()]/g, "").trim().slice(0, 80);
}

async function nextWorkerCode(): Promise<string> {
  const { data, error } = await getSupabase().from("workers").select("code");
  if (error) throw error;
  let max = 0;
  for (const row of data ?? []) {
    const n = Number(/^NL-(\d+)$/.exec(String(row.code))?.[1] ?? 0);
    if (n > max) max = n;
  }
  return `NL-${String(max + 1).padStart(3, "0")}`;
}

// GET /api/v1/workers — Danh sach NLD (merge national_id_full neu co quyen cccd)
export async function GET(req: Request): Promise<Response> {
  try {
    const ctx = getAuth(req);
    const canViewCccd = (ROLE.cccd as readonly string[]).includes(ctx.staffRole);
    const sp = searchParams(req);
    const { limit, offset } = clampPage(sp);
    let q = getSupabase().from("v_workers_public").select("*", { count: "exact" }).order("code");
    const status = sp.get("status");
    if (status) q = q.eq("status", status);
    const company = sp.get("company");
    if (company) q = q.eq("company", company);
    const type = sp.get("type");
    if (type) q = q.eq("employment_type", type);
    const needle = safeSearch(sp.get("q"));
    if (needle) q = q.or(`full_name.ilike.%${needle}%,code.ilike.%${needle}%,phone.ilike.%${needle}%`);
    const { data, error, count } = await q.range(offset, offset + limit - 1);
    if (error) throw error;
    let rows = (data ?? []) as Array<Record<string, unknown>>;
    const ids = rows.map((row) => Number(row["id"])).filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length > 0) {
      const links = await getSupabase().from("workers").select("id,manager_id").in("id", ids);
      if (links.error && links.error.code !== "PGRST204" && links.error.code !== "42703") throw links.error;
      const byWorker = new Map((links.data ?? []).map((row) => [row.id as number, row.manager_id as number | null]));
      const dates = await getSupabase().from("workers").select("id,consult_date,start_work_date,resign_date").in("id", ids);
      if (dates.error && dates.error.code !== "PGRST204" && dates.error.code !== "42703") throw dates.error;
      const dateById = new Map((dates.data ?? []).map((row) => [row.id as number, row]));
      const managerIds = [...new Set([...byWorker.values()].filter((id): id is number => typeof id === "number" && id > 0))];
      const people = managerIds.length > 0
        ? await getSupabase().from("staff").select("id,full_name").in("id", managerIds)
        : { data: [], error: null };
      if (people.error) throw people.error;
      const names = new Map((people.data ?? []).map((row) => [row.id as number, String(row.full_name)]));
      rows = rows.map((row) => {
        const managerId = byWorker.get(row["id"] as number) ?? null;
        const d = dateById.get(row["id"] as number);
        return {
          ...row,
          manager_id: managerId,
          manager_name: managerId ? names.get(managerId) ?? null : null,
          consult_date: d?.consult_date ?? null,
          start_work_date: d?.start_work_date ?? null,
          resign_date: d?.resign_date ?? null,
        };
      });
    }
    if (canViewCccd && rows.length > 0) {
      const ids = rows.map((r) => r["id"] as number);
      const { data: full, error: e2 } = await getSupabase().from("workers").select("id,national_id").in("id", ids);
      if (e2) throw e2;
      const map = new Map(((full ?? []) as Array<{ id: number; national_id: string }>).map((w) => [w.id, w.national_id]));
      rows = rows.map((r) => ({ ...r, national_id_full: map.get(r["id"] as number) ?? null }));
    }
    return json({ rows, total: count ?? rows.length, limit, offset });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/v1/workers — Tao ho so NLD
export async function POST(req: Request): Promise<Response> {
  try {
    const ctx = getAuth(req);
    const body = pick(await readBody(req), WORKER_INSERT);
    if (ctx.staffId) body["created_by"] = Number(ctx.staffId);
    if (!body["code"]) body["code"] = await nextWorkerCode();
    const { data, error } = await getSupabase().from("workers").insert(body).select(PUBLIC_RETURN).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
