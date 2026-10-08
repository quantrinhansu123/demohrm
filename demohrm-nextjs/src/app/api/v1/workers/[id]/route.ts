export const runtime = "nodejs";

import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";

const WORKER_PATCH = [
  "full_name", "phone", "date_of_birth", "gender", "hometown", "permanent_address",
  "national_id", "employment_type", "status", "current_company_id", "current_position",
  "recruiter_id", "note",
] as const;

const PUBLIC_RETURN = "id,code,full_name,phone,hometown,employment_type,status,current_position,current_company_id,recruiter_id,created_by,created_at,updated_at";

function pick(src: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// PATCH /api/v1/workers/:id — Cap nhat ho so NLD (giu nguyen nguoi tao ban dau, ghi rieng nguoi sua vao lich su)
export async function PATCH(
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
    const { data: oldWorker } = await getSupabase().from("workers").select("*").eq("id", id).maybeSingle();
    const patch = pick(await readBody(req), WORKER_PATCH);
    patch["updated_at"] = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from("workers")
      .update(patch)
      .eq("id", id)
      .select(PUBLIC_RETURN)
      .single();
    if (error) throw error;

    // Ghi nhan rieng nguoi sua va thoi gian sua vao audit_logs
    try {
      await getSupabase().from("audit_logs").insert({
        actor_id: auth.staffId ? Number(auth.staffId) : null,
        actor_role: auth.staffRole,
        action: "UPDATE",
        table_name: "workers",
        record_id: String(id),
        old_data: oldWorker ?? null,
        new_data: data,
        detail: `Chỉnh sửa hồ sơ ${(data as { code?: string }).code ?? id}`,
      });
    } catch {
      // Non-blocking neu ghi audit loi
    }

    return json(data);
  } catch (e) {
    return apiError(e);
  }
}

// DELETE /api/v1/workers/:id — Xoa ho so NLD
export async function DELETE(
  req: Request,
  ctx: { params: Promise<Record<string, string>> },
): Promise<Response> {
  try {
    getAuth(req);
    const p = await ctx.params;
    const id = positiveInt(p["id"]);
    if (!id) {
      return json({ error: "invalid", message: "Id không hợp lệ." }, 400);
    }
    const { error } = await getSupabase().from("workers").delete().eq("id", id);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
