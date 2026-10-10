export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const LIST = "id,work_date,check_in_at,check_out_at,check_in_lat,check_in_lng,check_in_distance_m,work_units,status,worker:workers(code,full_name),site:work_sites(name),shift:shifts(name)";

function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function phoneOf(staffId: number, phone: string | null): string {
  const raw = (phone ?? "").replace(/\D/g, "");
  if (/^0\d{9}$/.test(raw)) return raw;
  return `09${String(staffId).padStart(8, "0").slice(-8)}`;
}

async function nextWorkerCode(): Promise<string> {
  const { data, error } = await getSupabase().from("workers").select("code");
  if (error) throw error;
  const used = new Set((data ?? []).map((row) => String(row.code)));
  let n = 20;
  while (used.has(String(n))) n += 1;
  return String(n);
}

async function ensureWorker(staffId: number): Promise<number | null> {
  const sb = getSupabase();
  const withDate = await sb.from("staff").select("id,full_name,phone,date_of_birth").eq("id", staffId).maybeSingle();
  let staff = withDate.data as { id: number; full_name: string; phone: string | null; date_of_birth: string | null } | null;
  if (withDate.error) {
    if (withDate.error.code !== "42703" && withDate.error.code !== "PGRST204") throw withDate.error;
    const plain = await sb.from("staff").select("id,full_name,phone").eq("id", staffId).maybeSingle();
    if (plain.error) throw plain.error;
    staff = plain.data ? { id: plain.data.id as number, full_name: String(plain.data.full_name), phone: (plain.data.phone as string | null) ?? null, date_of_birth: null } : null;
  }
  if (!staff) return null;
  const found = await sb.from("workers").select("id").eq("full_name", staff.full_name).limit(1);
  if (found.error) throw found.error;
  const existingId = found.data?.[0]?.id as number | undefined;
  if (existingId) return existingId;
  const inserted = await sb.from("workers").insert({
    code: await nextWorkerCode(),
    full_name: staff.full_name,
    phone: phoneOf(staff.id, null),
    date_of_birth: staff.date_of_birth?.slice(0, 10) || "1990-01-01",
    hometown: "Việt Nam",
    national_id: `001090${String(staff.id).padStart(6, "0")}`,
    employment_type: "seasonal",
    status: "working",
    ekyc_status: "verified",
    recruiter_id: staff.id,
  }).select("id").single();
  if (inserted.error) throw inserted.error;
  return inserted.data.id as number;
}

async function openPlacement(workerId: number, staffId: number | null): Promise<{ id: number; work_site_id: number | null; shift_id: number | null } | null> {
  const sb = getSupabase();
  const orders = await sb.from("orders").select("id,work_site_id").eq("status", "running").order("id", { ascending: false }).limit(20);
  if (orders.error) throw orders.error;
  const order = ((orders.data ?? []) as Array<{ id: number; work_site_id: number | null }>).find((item) => item.work_site_id) ?? (orders.data?.[0] as { id: number; work_site_id: number | null } | undefined);
  if (!order) return null;
  const position = await sb.from("order_positions").select("id").eq("order_id", order.id).order("sort_order").limit(1).maybeSingle();
  if (position.error) throw position.error;
  if (!position.data) return null;
  const created = await sb.from("worker_placements").insert({
    worker_id: workerId,
    order_position_id: position.data.id,
    work_site_id: order.work_site_id,
    recruiter_id: staffId,
    stage: "working",
    start_date: todayVN(),
  }).select("id,work_site_id,shift_id").single();
  if (created.error) throw created.error;
  return created.data as { id: number; work_site_id: number | null; shift_id: number | null };
}

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const body = pick(await readBody(req), ["worker_id", "staff_id", "check_in_lat", "check_in_lng", "note"]);
    const staffId = positiveInt(body["staff_id"]);
    let workerId = positiveInt(body["worker_id"]);
    if (!workerId && staffId) workerId = await ensureWorker(staffId);
    if (!workerId) {
      return json({ error: "invalid", message: "Chọn người lao động." }, 400);
    }
    const row: Record<string, unknown> = {
      worker_id: workerId,
      work_date: todayVN(),
      check_in_at: new Date().toISOString(),
      recorded_by: Number(auth.staffId),
    };
    if (typeof body["note"] === "string" && body["note"]) row["note"] = body["note"];
    if (body["check_in_lat"] != null) row["check_in_lat"] = Number(body["check_in_lat"]);
    if (body["check_in_lng"] != null) row["check_in_lng"] = Number(body["check_in_lng"]);
    const { data: open, error: e0 } = await getSupabase()
      .from("worker_placements")
      .select("id,work_site_id,shift_id")
      .eq("worker_id", workerId)
      .is("end_date", null)
      .limit(1)
      .maybeSingle();
    if (e0) throw e0;
    const placement = open as { id: number; work_site_id: number | null; shift_id: number | null } | null;
    const active = placement ?? (await openPlacement(workerId, staffId));
    if (!active) {
      return json({ error: "bad_request", message: "Chưa có đơn hàng đang chạy để gắn đợt làm việc." }, 400);
    }
    row["placement_id"] = active.id;
    if (active.work_site_id) row["work_site_id"] = active.work_site_id;
    if (active.shift_id) row["shift_id"] = active.shift_id;
    const { data, error } = await getSupabase().from("attendances").insert(row).select(LIST).single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
