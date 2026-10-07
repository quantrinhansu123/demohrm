export const runtime = "nodejs";

import { getAuth, requireRole, writeAudit } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// GET /api/v1/workers/:id/documents/:docId/url — Cap signed URL xem giay to (5 phut) + ghi audit VIEW_SENSITIVE
export async function GET(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.cccd);
    const p = await ctx.params;
    const workerId = positiveInt(p["id"]);
    const docId = positiveInt(p["docId"]);
    if (!workerId || !docId) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const { data: doc, error: e0 } = await getSupabase()
      .from("worker_documents")
      .select("storage_bucket, storage_path, worker_id")
      .eq("id", docId)
      .eq("worker_id", workerId)
      .single();
    if (e0) throw e0;
    const d = doc as { storage_bucket: string; storage_path: string; worker_id: number };
    const { data: signed, error: e1 } = await getSupabase().storage.from(d.storage_bucket).createSignedUrl(d.storage_path, 300);
    if (e1) throw e1;
    if (!signed) {
      return json({ error: "internal", message: "Lỗi máy chủ." }, 500);
    }
    await writeAudit(auth, {
      action: "VIEW_SENSITIVE",
      table: "worker_documents",
      recordId: docId,
      detail: `Cấp signed URL giấy tờ cho worker ${d.worker_id}`,
    });
    return json({ url: signed.signedUrl, expires_in: 300 });
  } catch (e) {
    return apiError(e);
  }
}
