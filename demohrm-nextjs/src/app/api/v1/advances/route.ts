export const runtime = "nodejs";

import { randomBytes } from "crypto";

import { getAuth, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";

const EVIDENCE_BUCKET = "worker-private";
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i;
const MAX_IMAGE_BYTES = 5_000_000;

const COLUMNS =
  "id,code,subject_type,worker_id,staff_id,amount,reason,status,advance_date,advance_time,requested_by,approved_by,approved_at,paid_at,settled_at,settled_amount,evidence_path,note,cashbook_entry_id,legacy_salary_advance_id,created_at,updated_at";

interface AdvanceRow {
  id: number;
  code: string;
  subject_type: "worker" | "staff";
  worker_id: number | null;
  staff_id: number | null;
  amount: number;
  reason: string | null;
  status: string;
  advance_date: string;
  advance_time: string;
  requested_by: number | null;
  approved_by?: number | null;
  evidence_path?: string | null;
  legacy_salary_advance_id?: number | null;
  [key: string]: unknown;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function advanceCode(): string {
  const now = new Date();
  const prefix = `TU-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  return `${prefix}${randomBytes(3).toString("hex").toUpperCase()}`;
}

function advanceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}

function advanceTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function decodedImage(dataUrl: string): { mime: string; ext: string; bytes: Buffer } | null {
  const match = DATA_URL.exec(dataUrl.replace(/\s/g, ""));
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, ext, bytes };
}

function evidenceFolder(row: AdvanceRow): string | null {
  if (row.subject_type === "staff") {
    return row.staff_id ? `staff/${row.staff_id}/advances` : null;
  }
  return row.worker_id ? `${row.worker_id}/advances` : null;
}

function evidencePath(row: AdvanceRow, ext: string): string | null {
  const folder = evidenceFolder(row);
  return folder ? `${folder}/${row.id}.${ext}` : null;
}

async function signedUrl(path: string): Promise<string | null> {
  const signed = await getSupabase().storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60 * 60);
  return signed.data?.signedUrl ?? null;
}

async function fallbackEvidenceUrls(rows: AdvanceRow[]): Promise<Map<number, string>> {
  const urls = new Map<number, string>();
  const folders = new Map<string, AdvanceRow[]>();

  for (const row of rows) {
    if (row.evidence_path) continue;
    const folder = evidenceFolder(row);
    if (!folder) continue;
    const list = folders.get(folder) ?? [];
    list.push(row);
    folders.set(folder, list);
  }

  await Promise.all(
    [...folders.entries()].map(async ([folder, list]) => {
      const listed = await getSupabase().storage.from(EVIDENCE_BUCKET).list(folder);
      if (listed.error || !listed.data) return;

      const byFileId = new Map<string, AdvanceRow>();
      for (const row of list) {
        byFileId.set(String(row.id), row);
        if (row.legacy_salary_advance_id) {
          byFileId.set(String(row.legacy_salary_advance_id), row);
        }
      }

      await Promise.all(
        listed.data.map(async (item) => {
          const fileId = item.name.split(".")[0];
          if (!fileId) return;
          const row = byFileId.get(fileId);
          if (!row) return;
          const url = await signedUrl(`${folder}/${item.name}`);
          if (url) urls.set(row.id, url);
        }),
      );
    }),
  );

  return urls;
}

async function enrich(rows: AdvanceRow[]): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return [];

  const workerIds = [
    ...new Set(rows.map((row) => row.worker_id).filter((id): id is number => typeof id === "number" && id > 0)),
  ];
  const staffIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.staff_id, row.requested_by, row.approved_by])
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  ];

  const [workersRes, staffRes] = await Promise.all([
    workerIds.length > 0
      ? getSupabase().from("workers").select("id,code,full_name,current_company_id").in("id", workerIds)
      : Promise.resolve({ data: [], error: null }),
    staffIds.length > 0
      ? getSupabase().from("staff").select("id,full_name").in("id", staffIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (workersRes.error) throw workersRes.error;
  if (staffRes.error) throw staffRes.error;

  const companyIds = [
    ...new Set(
      (workersRes.data ?? [])
        .map((row) => row.current_company_id as number | null)
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  ];
  const companiesRes =
    companyIds.length > 0
      ? await getSupabase().from("companies").select("id,short_name").in("id", companyIds)
      : { data: [], error: null };
  if (companiesRes.error) throw companiesRes.error;

  const workerMap = new Map((workersRes.data ?? []).map((row) => [row.id as number, row]));
  const staffMap = new Map((staffRes.data ?? []).map((row) => [row.id as number, row]));
  const companyMap = new Map((companiesRes.data ?? []).map((row) => [row.id as number, row.short_name as string]));

  const pathUrls = new Map<number, string>();
  await Promise.all(
    rows
      .filter((row) => typeof row.evidence_path === "string" && row.evidence_path)
      .map(async (row) => {
        const url = await signedUrl(row.evidence_path as string);
        if (url) pathUrls.set(row.id, url);
      }),
  );
  const legacyUrls = await fallbackEvidenceUrls(rows);

  return rows.map((row) => {
    const worker = row.worker_id ? workerMap.get(row.worker_id) : null;
    const companyId = worker?.current_company_id as number | null | undefined;
    return {
      ...row,
      worker_name: worker?.full_name ?? null,
      worker_code: worker?.code ?? null,
      company_name: companyId ? companyMap.get(companyId) ?? null : null,
      staff_name: row.staff_id ? staffMap.get(row.staff_id)?.full_name ?? null : null,
      giver_name: row.requested_by ? staffMap.get(row.requested_by)?.full_name ?? null : null,
      approver_name: row.approved_by ? staffMap.get(row.approved_by)?.full_name ?? null : null,
      evidence_url: pathUrls.get(row.id) ?? legacyUrls.get(row.id) ?? null,
    };
  });
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const workerId = positiveInt(sp.get("worker_id"));
    const staffId = positiveInt(sp.get("staff_id"));
    const subjectType = sp.get("subject_type");
    const status = sp.get("status");
    const from = advanceDate(sp.get("from"));
    const to = advanceDate(sp.get("to"));
    const search = sp.get("q")?.trim();
    const limitRaw = Number(sp.get("limit") ?? 300);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 300;

    let q = getSupabase()
      .from("advances")
      .select(COLUMNS)
      .order("advance_date", { ascending: false })
      .order("advance_time", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (workerId) q = q.eq("worker_id", workerId);
    if (staffId) q = q.eq("staff_id", staffId);
    if (subjectType === "staff" || subjectType === "worker") q = q.eq("subject_type", subjectType);
    if (status) q = q.eq("status", status);
    if (from) q = q.gte("advance_date", from);
    if (to) q = q.lte("advance_date", to);
    if (search) {
      const [workersRes, staffRes] = await Promise.all([
        getSupabase().from("workers").select("id").or(`full_name.ilike.%${search}%,code.ilike.%${search}%`).limit(1000),
        getSupabase().from("staff").select("id").or(`full_name.ilike.%${search}%,code.ilike.%${search}%`).limit(1000),
      ]);
      if (workersRes.error) throw workersRes.error;
      if (staffRes.error) throw staffRes.error;
      const workerIds = (workersRes.data ?? []).map((row) => Number((row as { id: unknown }).id)).filter((id) => id > 0);
      const staffIds = (staffRes.data ?? []).map((row) => Number((row as { id: unknown }).id)).filter((id) => id > 0);
      const parts = [
        `code.ilike.%${search}%`,
        `reason.ilike.%${search}%`,
        `note.ilike.%${search}%`,
        ...(workerIds.length > 0 ? [`worker_id.in.(${workerIds.join(",")})`] : []),
        ...(staffIds.length > 0 ? [`staff_id.in.(${staffIds.join(",")})`] : []),
      ];
      q = q.or(parts.join(","));
    }

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as unknown as AdvanceRow[];
    return json(await enrich(rows));
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    const raw = await readBody(req);
    const subjectType = raw["subject_type"] === "staff" ? "staff" : "worker";
    const workerId = positiveInt(raw["worker_id"]);
    const staffId = positiveInt(raw["staff_id"]);
    const amount = Number(raw["amount"]);
    const giverId = positiveInt(raw["requested_by"]);
    const reason = typeof raw["reason"] === "string" ? raw["reason"].trim().replace(/\s+/g, " ") : "";
    const note = typeof raw["note"] === "string" ? raw["note"].trim().replace(/\s+/g, " ") : "";
    const date = advanceDate(raw["advance_date"]);
    const time = advanceTime(raw["advance_time"]);
    const image = typeof raw["evidence"] === "string" ? decodedImage(raw["evidence"]) : null;

    if (subjectType === "staff" && !staffId) {
      return json({ error: "invalid", message: "Thiếu nhân viên tạm ứng." }, 400);
    }
    if (subjectType === "worker" && !workerId) {
      return json({ error: "invalid", message: "Thiếu người lao động tạm ứng." }, 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "invalid", message: "Số tiền tạm ứng không hợp lệ." }, 400);
    }
    if (!date) return json({ error: "invalid", message: "Ngày tạm ứng không hợp lệ." }, 400);
    if (!time) return json({ error: "invalid", message: "Giờ tạm ứng không hợp lệ." }, 400);
    if (!reason) return json({ error: "invalid", message: "Nhập lý do tạm ứng." }, 400);
    if (reason.length > 300) return json({ error: "invalid", message: "Lý do tối đa 300 ký tự." }, 400);
    if (!giverId) return json({ error: "invalid", message: "Chọn người đưa tiền tạm ứng." }, 400);
    if (raw["evidence"] !== undefined && raw["evidence"] !== "" && !image) {
      return json({ error: "invalid", message: "Ảnh bằng chứng không hợp lệ (JPEG/PNG/WEBP, tối đa 5MB)." }, 400);
    }

    const giver = await getSupabase().from("staff").select("id,full_name").eq("id", giverId).maybeSingle();
    if (giver.error) throw giver.error;
    if (!giver.data) return json({ error: "invalid", message: "Không tìm thấy nhân sự đưa tiền." }, 400);

    const { data, error } = await getSupabase()
      .from("advances")
      .insert({
        code: advanceCode(),
        subject_type: subjectType,
        worker_id: subjectType === "worker" ? workerId : null,
        staff_id: subjectType === "staff" ? staffId : null,
        amount,
        reason,
        note: note || null,
        status: "requested",
        advance_date: date,
        advance_time: time,
        requested_by: giverId,
      })
      .select(COLUMNS)
      .single();
    if (error) throw error;

    const created = data as unknown as AdvanceRow;
    if (image) {
      const path = evidencePath(created, image.ext);
      if (!path) throw new Error("Không xác định được đường dẫn ảnh bằng chứng.");
      const uploaded = await getSupabase().storage.from(EVIDENCE_BUCKET).upload(
        path,
        new Blob([new Uint8Array(image.bytes)], { type: image.mime }),
        { contentType: image.mime, upsert: true },
      );
      if (uploaded.error) {
        await getSupabase().from("advances").delete().eq("id", created.id);
        throw uploaded.error;
      }
      const updated = await getSupabase()
        .from("advances")
        .update({ evidence_path: path })
        .eq("id", created.id)
        .select(COLUMNS)
        .single();
      if (updated.error) throw updated.error;
      Object.assign(created, updated.data);
    }

    const enriched = await enrich([created]);
    await writeAudit(auth, {
      action: "INSERT",
      table: "advances",
      recordId: created.id,
      detail: `Tạo tạm ứng ${created.code} - ${Number(created.amount).toLocaleString("vi-VN")} đ`,
    });
    return json({ ...enriched[0], giver_name: String(giver.data.full_name) }, 201);
  } catch (e) {
    return apiError(e);
  }
}
