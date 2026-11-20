export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
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

// POST /api/v1/workers/:id/documents — Luu metadata giay to sau khi client upload xong qua signed URL
// GET /api/v1/workers/:id/documents — Lay anh chan dung qua signed URL tam thoi
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.cccd);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) return json({ error: "invalid", message: "Id không hợp lệ." }, 400);

    const { data, error } = await getSupabase()
      .from("worker_documents")
      .select("id,storage_bucket,storage_path,mime_type")
      .eq("worker_id", id)
      .eq("doc_type", "portrait");
    if (error) throw error;

    const documents = await Promise.all((data ?? []).map(async (raw) => {
      const doc = raw as { id: number; storage_bucket: string; storage_path: string; mime_type: string };
      const { data: signed, error: signError } = await getSupabase()
        .storage.from(doc.storage_bucket).createSignedUrl(doc.storage_path, 300);
      if (signError) throw signError;
      if (!signed) throw new Error("Không tạo được liên kết ảnh hồ sơ.");
      await writeAudit(auth, {
        action: "VIEW_SENSITIVE",
        table: "worker_documents",
        recordId: doc.id,
        detail: `Cấp signed URL ảnh hồ sơ cho worker ${id}`,
      });
      return { id: doc.id, mime_type: doc.mime_type, url: signed.signedUrl };
    }));

    return Response.json({ documents }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const body = await readBody(req);
    const docType = typeof body["doc_type"] === "string" ? body["doc_type"] : "";
    if (docType !== "national_id" && docType !== "portrait") {
      return json({ error: "invalid", message: "doc_type không hợp lệ." }, 400);
    }
    requireRole(auth, ...(docType === "portrait" ? ROLE.workerPortrait : ROLE.cccd));
    const storagePath = typeof body["storage_path"] === "string" ? body["storage_path"] : "";
    const mime = typeof body["mime"] === "string" && body["mime"] ? body["mime"] : "image/jpeg";
    if (docType !== "national_id" && docType !== "portrait") {
      return json({ error: "invalid", message: "doc_type không hợp lệ." }, 400);
    }
    if (!DOC_MIME[mime]) {
      return json({ error: "invalid", message: "Chỉ nhận ảnh JPEG, PNG hoặc WebP." }, 400);
    }
    if (!storagePath || !storagePath.startsWith(`${id}/`)) {
      return json({ error: "invalid", message: "storage_path không hợp lệ." }, 400);
    }
    const { data: worker, error: missing } = await getSupabase().from("workers").select("id").eq("id", id).maybeSingle();
    if (missing) throw missing;
    if (!worker) {
      return json({ error: "not_found", message: "Không tìm thấy hồ sơ." }, 404);
    }
    const { data, error } = await getSupabase()
      .from("worker_documents")
      .insert({ worker_id: id, doc_type: docType, storage_bucket: "worker-private", storage_path: storagePath, mime_type: mime })
      .select("id,worker_id,doc_type,mime_type")
      .single();
    if (error) throw error;
    return json(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
