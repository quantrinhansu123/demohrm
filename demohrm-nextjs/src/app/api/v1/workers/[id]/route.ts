export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, readBody } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import { applyWorkerPhonePrivacy, canViewWorkerPhone } from "@/lib/server/worker-privacy";

const WORKER_PATCH = [
  "full_name", "phone", "date_of_birth", "gender", "hometown", "permanent_address",
  "employment_type", "status", "current_company_id", "current_position", "recruiter_id", "manager_id", "note",
  "consult_date", "start_work_date", "resign_date",
] as const;

const PUBLIC_RETURN =
  "id,code,full_name,phone,hometown,employment_type,status,current_position,current_company_id,recruiter_id,manager_id,created_by";

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

// PATCH /api/v1/workers/:id — Cap nhat ho so NLD
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

    const body = pick(await readBody(req), WORKER_PATCH);
    if (body["phone"] !== undefined) {
      const current = await getSupabase()
        .from("workers")
        .select("id,created_by,recruiter_id,manager_id")
        .eq("id", id)
        .maybeSingle();
      if (current.error) throw current.error;
      if (!current.data) return json({ error: "not_found", message: "Không tìm thấy hồ sơ." }, 404);
      if (!canViewWorkerPhone(auth.staffRole, auth.staffId, current.data)) {
        return json({ error: "forbidden", message: "Bạn không có quyền sửa số điện thoại hồ sơ này." }, 403);
      }
    }

    const { data, error } = await getSupabase()
      .from("workers")
      .update(body)
      .eq("id", id)
      .select(PUBLIC_RETURN)
      .single();
    if (error) {
      // created_by có thể chưa có trên DB cũ
      if ((error as { code?: string }).code === "42703" || (error as { code?: string }).code === "PGRST204") {
        const again = await getSupabase()
          .from("workers")
          .update(body)
          .eq("id", id)
          .select("id,code,full_name,phone,hometown,employment_type,status,current_position,current_company_id,recruiter_id")
          .single();
        if (again.error) throw again.error;
        return json(applyWorkerPhonePrivacy(again.data as Record<string, unknown>, auth.staffRole, auth.staffId));
      }
      throw error;
    }
    return json(applyWorkerPhonePrivacy(data as Record<string, unknown>, auth.staffRole, auth.staffId));
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
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.deleteRecords);
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
