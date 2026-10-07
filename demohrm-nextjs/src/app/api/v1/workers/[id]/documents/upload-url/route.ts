export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const DOC_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function safeFileName(raw: unknown): string {
  const base = String(raw ?? "").split("/").pop() ?? "";
  const name = base.split("\\").pop() ?? "";
  return name.trim().slice(0, 120);
}

// POST /api/v1/workers/:id/documents/upload-url — Cap signed URL de client upload truc tiep (2 buoc, bo base64)
export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.cccd);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const body = await readBody(req);
    const mime = typeof body["mime"] === "string" ? body["mime"] : "";
    if (!DOC_MIME[mime]) {
      return json({ error: "invalid", message: "Chỉ nhận ảnh JPEG, PNG hoặc WebP." }, 400);
    }
    const filename = safeFileName(body["filename"]);
    if (!filename) {
      return json({ error: "invalid", message: "Thiếu tên file." }, 400);
    }
    const { data: worker, error: missing } = await getSupabase().from("workers").select("id").eq("id", id).maybeSingle();
    if (missing) throw missing;
    if (!worker) {
      return json({ error: "not_found", message: "Không tìm thấy hồ sơ." }, 404);
    }
    const path = `${id}/${Date.now()}-${filename}`;
    const { data: signed, error: upErr } = await getSupabase().storage.from("worker-private").createSignedUploadUrl(path);
    if (upErr) throw upErr;
    if (!signed) {
      return json({ error: "internal", message: "Lỗi máy chủ." }, 500);
    }
    return json({ path: signed.path, token: signed.token, signedUrl: signed.signedUrl });
  } catch (e) {
    return apiError(e);
  }
}
