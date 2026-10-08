export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const WORKER_INSERT = [
  "code", "full_name", "phone", "date_of_birth", "gender", "hometown", "permanent_address",
  "national_id", "old_id_number", "employment_type", "status", "current_company_id",
  "current_position", "recruiter_id", "source_vendor_id", "note",
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
    const recruiterId = sp.get("recruiter_id");
    if (recruiterId) q = q.eq("recruiter_id", Number(recruiterId));
    const sourceVendorId = sp.get("source_vendor_id");
    if (sourceVendorId) q = q.eq("source_vendor_id", Number(sourceVendorId));
    const createdBy = sp.get("created_by");
    if (createdBy) {
      const { data: createdWorkers } = await getSupabase()
        .from("workers")
        .select("id")
        .eq("created_by", Number(createdBy));
      const cIds = (createdWorkers ?? []).map((w) => (w as { id: number }).id);
      if (cIds.length === 0) {
        return json({ rows: [], total: 0, limit, offset });
      }
      q = q.in("id", cIds);
    }
    const handoverStatus = sp.get("handover_status");
    if (handoverStatus) {
      const { data: hRows } = await getSupabase()
        .from("handovers")
        .select("placement_id")
        .eq("status", handoverStatus);
      const pIds = (hRows ?? []).map((h) => (h as { placement_id: number }).placement_id);
      if (pIds.length > 0) {
        const { data: wpRows } = await getSupabase()
          .from("worker_placements")
          .select("worker_id")
          .in("id", pIds);
        const wIds = Array.from(new Set((wpRows ?? []).map((wp) => (wp as { worker_id: number }).worker_id)));
        if (wIds.length > 0) {
          q = q.in("id", wIds);
        } else {
          return json({ rows: [], total: 0, limit, offset });
        }
      } else {
        return json({ rows: [], total: 0, limit, offset });
      }
    }
    const { data, error, count } = await q.range(offset, offset + limit - 1);
    if (error) throw error;
    let rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length > 0) {
      const ids = rows.map((r) => r["id"] as number);
      const [wDetailsRes, assignRes] = await Promise.all([
        getSupabase()
          .from("workers")
          .select("id,national_id,created_by,created_at,updated_at")
          .in("id", ids),
        getSupabase()
          .from("v_worker_assignments")
          .select("worker_id,handover_status")
          .in("worker_id", ids)
          .order("start_date", { ascending: false }),
      ]);
      const wDetails = wDetailsRes.data ?? [];
      const hMap = new Map<number, string>();
      for (const a of (assignRes.data ?? [])) {
        const row = a as { worker_id: number; handover_status: string | null };
        if (row.handover_status && !hMap.has(row.worker_id)) {
          hMap.set(row.worker_id, row.handover_status);
        }
      }

      const creatorIds = Array.from(
        new Set(
          wDetails
            .map((w) => (w as { created_by: number | null }).created_by)
            .filter((cid): cid is number => cid !== null && cid !== undefined),
        ),
      );

      let staffMap = new Map<number, string>();
      if (creatorIds.length > 0) {
        const { data: staffList } = await getSupabase()
          .from("staff")
          .select("id,full_name")
          .in("id", creatorIds);
        staffMap = new Map((staffList ?? []).map((s) => [s.id as number, s.full_name as string]));
      }

      const wMap = new Map(
        wDetails.map((w) => [
          (w as { id: number }).id,
          w as { id: number; national_id: string; created_by: number | null; created_at: string; updated_at?: string },
        ]),
      );

      rows = rows.map((r) => {
        const d = wMap.get(r["id"] as number);
        const creatorId = d?.created_by ?? null;
        const creatorName = creatorId ? staffMap.get(creatorId) ?? `#${creatorId}` : null;
        return {
          ...r,
          national_id_full: canViewCccd ? (d?.national_id ?? null) : null,
          created_by: creatorId,
          creator_name: creatorName,
          created_at: d?.created_at ?? null,
          updated_at: d?.updated_at ?? null,
          handover_status: hMap.get(r["id"] as number) ?? null,
        };
      });
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
    const rawBody = await readBody(req);
    const body = pick(rawBody, WORKER_INSERT);
    if (ctx.staffId) body["created_by"] = Number(ctx.staffId);

    // Tu dong sinh ma NLD neu de trong
    if (!body["code"] || String(body["code"]).trim() === "") {
      const { data: latestWorkers } = await getSupabase()
        .from("workers")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
      const nextId = (((latestWorkers?.[0] as { id?: number } | undefined)?.id) ?? 0) + 1;
      body["code"] = `NLD-${String(nextId).padStart(3, "0")}`;
    }

    // Neu CCCD rong thi dat la null de khong bi loi Check Postgres
    if (!body["national_id"] || String(body["national_id"]).trim() === "") {
      body["national_id"] = null;
    }

    const supervisorId = rawBody["supervisor_id"] ? Number(rawBody["supervisor_id"]) : null;

    const { data, error } = await getSupabase().from("workers").insert(body).select(PUBLIC_RETURN).single();
    if (error) throw error;

    // Neu co nguoi quan ly don va cong ty, tao placement khoi tao de hien thi supervisor
    if (supervisorId && data?.id && body["current_company_id"]) {
      try {
        const { data: order } = await getSupabase()
          .from("orders")
          .select("id")
          .eq("company_id", Number(body["current_company_id"]))
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (order?.id) {
          const { data: pos } = await getSupabase()
            .from("order_positions")
            .select("id")
            .eq("order_id", (order as { id: number }).id)
            .limit(1)
            .maybeSingle();
          if (pos?.id) {
            const today = new Date().toISOString().slice(0, 10);
            await getSupabase().from("worker_placements").insert({
              worker_id: (data as { id: number }).id,
              order_position_id: (pos as { id: number }).id,
              supervisor_id: supervisorId,
              recruiter_id: body["recruiter_id"] ? Number(body["recruiter_id"]) : null,
              stage: "waiting_start",
              start_date: today,
            });
          }
        }
      } catch {
        // Khong chan luu ho so neu tao placement kem that bai
      }
    }

    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
