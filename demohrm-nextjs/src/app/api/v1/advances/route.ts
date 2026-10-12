export const runtime = "nodejs";

import { randomBytes } from "crypto";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody, searchParams } from "@/lib/server/http";

const EVIDENCE_BUCKET = "worker-private";
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i;
const MAX_IMAGE_BYTES = 5_000_000;

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function advanceCode(): string {
  const now = new Date();
  const prefix = `TU-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  return `${prefix}${randomBytes(3).toString("hex").toUpperCase()}`;
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

function evidencePath(workerId: number, advanceId: number, ext: string): string {
  return `${workerId}/advances/${advanceId}.${ext}`;
}

async function evidenceUrls(workerId: number, advanceIds: number[]): Promise<Map<number, string>> {
  const urls = new Map<number, string>();
  if (advanceIds.length === 0) return urls;
  const folder = `${workerId}/advances`;
  const listed = await getSupabase().storage.from(EVIDENCE_BUCKET).list(folder);
  if (listed.error || !listed.data) return urls;
  const wanted = new Set(advanceIds);
  await Promise.all(listed.data.map(async (item) => {
    const advanceId = Number(item.name.split(".")[0]);
    if (!wanted.has(advanceId)) return;
    const signed = await getSupabase().storage.from(EVIDENCE_BUCKET).createSignedUrl(`${folder}/${item.name}`, 60 * 60);
    if (signed.data?.signedUrl) urls.set(advanceId, signed.data.signedUrl);
  }));
  return urls;
}

// GET /api/v1/advances?worker_id= — Danh sach tam ung cua mot nguoi lao dong
export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const workerId = positiveInt(searchParams(req).get("worker_id"));
    if (!workerId) return json({ error: "invalid", message: "Thiếu người lao động." }, 400);
    const { data, error } = await getSupabase()
      .from("salary_advances")
      .select("id,code,worker_id,amount,reason,status,requested_by,requested_at")
      .eq("worker_id", workerId)
      .order("requested_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const giverIds = [...new Set(rows.map((row) => row.requested_by).filter((id): id is number => typeof id === "number" && id > 0))];
    const people = giverIds.length > 0
      ? await getSupabase().from("staff").select("id,full_name").in("id", giverIds)
      : { data: [], error: null };
    if (people.error) throw people.error;
    const names = new Map((people.data ?? []).map((person) => [person.id as number, String(person.full_name)]));
    const photos = await evidenceUrls(workerId, rows.map((row) => row.id as number));
    const advances = rows.map((row) => ({
      ...row,
      giver_name: typeof row.requested_by === "number" ? names.get(row.requested_by) ?? null : null,
      evidence_url: photos.get(row.id as number) ?? null,
    }));
    return json(advances);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const raw = await readBody(req);
    const workerId = positiveInt(raw["worker_id"]);
    const periodId = positiveInt(raw["period_id"]);
    const amount = Number(raw["amount"]);
    const giverId = positiveInt(raw["requested_by"]);
    const reason = typeof raw["reason"] === "string" ? raw["reason"].trim().replace(/\s+/g, " ") : "";
    const requestedAt = typeof raw["requested_at"] === "string" ? new Date(raw["requested_at"]) : null;
    const image = typeof raw["evidence"] === "string" ? decodedImage(raw["evidence"]) : null;
    if (!workerId || !periodId || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "invalid", message: "Thiếu người lao động, kỳ hoặc số tiền." }, 400);
    }
    if (!requestedAt || Number.isNaN(requestedAt.getTime())) {
      return json({ error: "invalid", message: "Ngày giờ không hợp lệ." }, 400);
    }
    if (!reason) return json({ error: "invalid", message: "Nhập lý do tạm ứng." }, 400);
    if (reason.length > 300) return json({ error: "invalid", message: "Lý do tối đa 300 ký tự." }, 400);
    if (!giverId) return json({ error: "invalid", message: "Chọn người tạm ứng." }, 400);
    if (!image) return json({ error: "invalid", message: "Chụp ảnh bằng chứng." }, 400);

    const giver = await getSupabase().from("staff").select("id,full_name").eq("id", giverId).maybeSingle();
    if (giver.error) throw giver.error;
    if (!giver.data) return json({ error: "invalid", message: "Không tìm thấy nhân sự tạm ứng." }, 400);

    const inserted = await getSupabase()
      .from("salary_advances")
      .insert({
        code: advanceCode(),
        worker_id: workerId,
        period_id: periodId,
        amount,
        reason,
        status: "requested",
        requested_by: giverId,
        requested_at: requestedAt.toISOString(),
      })
      .select("id,code,worker_id,period_id,amount,reason,status,requested_by,requested_at")
      .single();
    if (inserted.error) throw inserted.error;

    const created = inserted.data;
    const path = evidencePath(workerId, created.id as number, image.ext);
    const uploaded = await getSupabase().storage.from(EVIDENCE_BUCKET).upload(path, new Blob([new Uint8Array(image.bytes)], { type: image.mime }), {
      contentType: image.mime,
      upsert: true,
    });
    if (uploaded.error) {
      await getSupabase().from("salary_advances").delete().eq("id", created.id);
      throw uploaded.error;
    }
    const signed = await getSupabase().storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60 * 60);
    return json({
      ...created,
      giver_name: String(giver.data.full_name),
      evidence_url: signed.data?.signedUrl ?? null,
    }, 201);
  } catch (e) {
    return apiError(e);
  }
}
