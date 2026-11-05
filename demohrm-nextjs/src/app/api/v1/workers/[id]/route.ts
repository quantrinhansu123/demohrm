export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { ForbiddenError, apiError, json, readBody } from "@/lib/server/http";
import { BLACKLIST_STATUS, ROLE, WORKER_STATUS_HCNS_ALLOWED, hasRole } from "@/lib/server/roles";
import { applyWorkerPhonePrivacy, canViewWorkerPhone } from "@/lib/server/worker-privacy";

const WORKER_PATCH = [
  "full_name", "phone", "date_of_birth", "gender", "hometown", "permanent_address",
  "national_id", "employment_type", "status", "current_company_id", "current_position", "recruiter_id", "manager_id", "note",
  "consult_date", "start_work_date", "resign_date",
] as const;

/** HCNS chốt/tái tuyển/sửa trạng thái: vận hành hồ sơ, không full edit. */
const WORKER_HCNS_OPS_PATCH = [
  "status",
  "start_work_date",
  "resign_date",
  "consult_date",
  "manager_id",
  "recruiter_id",
  "full_name",
  "phone",
  "hometown",
  "employment_type",
  "current_position",
  "current_company_id",
  "note",
] as const;

/** Ban lãnh đạo / HCNS / Quản lý: quản lý blacklist — sửa tên, CCCD, trạng thái. */
const WORKER_BLACKLIST_PATCH = ["full_name", "national_id", "status"] as const;

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

function normalizeCccd(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "").slice(0, 20);
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

    const canFull = hasRole(auth.staffRole, ROLE.workerEdit);
    const canStatus = hasRole(auth.staffRole, ROLE.workerStatusEdit);
    const canBlacklist = hasRole(auth.staffRole, ROLE.blacklistWrite);
    if (!canFull && !canStatus && !canBlacklist) {
      throw new ForbiddenError("Bạn không có quyền sửa hồ sơ người lao động.");
    }

    const raw = await readBody(req);
    let body: Record<string, unknown>;

    if (canFull) {
      body = pick(raw, WORKER_PATCH);
      if (body["national_id"] !== undefined) {
        const cccd = normalizeCccd(body["national_id"]);
        if (!/^\d{9,12}$/.test(cccd)) {
          return json({ error: "invalid", message: "CCCD phải gồm 9–12 chữ số." }, 400);
        }
        body["national_id"] = cccd;
      }
    } else if (canBlacklist && !canStatus) {
      // Quản lý (team_lead): chỉ tên / CCCD / trạng thái (đưa vào·gỡ blacklist).
      body = pick(raw, WORKER_BLACKLIST_PATCH);
      if (Object.keys(body).length === 0) {
        return json({ error: "invalid", message: "Không có dữ liệu được phép cập nhật." }, 400);
      }
      if (body["national_id"] !== undefined) {
        const cccd = normalizeCccd(body["national_id"]);
        if (!/^\d{9,12}$/.test(cccd)) {
          return json({ error: "invalid", message: "CCCD phải gồm 9–12 chữ số." }, 400);
        }
        body["national_id"] = cccd;
      }
      if (body["status"] !== undefined) {
        const status = String(body["status"]);
        const allowed = new Set<string>([...WORKER_STATUS_HCNS_ALLOWED, BLACKLIST_STATUS, "on_leave"]);
        if (!allowed.has(status)) {
          return json({ error: "forbidden", message: "Trạng thái không hợp lệ." }, 403);
        }
      }
      const extra = Object.keys(raw).filter(
        (key) => raw[key] !== undefined && !(WORKER_BLACKLIST_PATCH as readonly string[]).includes(key),
      );
      if (extra.length > 0) {
        return json({ error: "forbidden", message: "Bạn chỉ được sửa tên, CCCD và trạng thái." }, 403);
      }
    } else {
      // HCNS / Nhân viên / CTV (+ HCNS cũng có blacklistWrite): ops patch.
      const allowedKeys: readonly string[] = canBlacklist
        ? [...WORKER_HCNS_OPS_PATCH, "national_id"]
        : WORKER_HCNS_OPS_PATCH;
      body = pick(raw, allowedKeys);
      if (Object.keys(body).length === 0) {
        return json({ error: "invalid", message: "Không có dữ liệu được phép cập nhật." }, 400);
      }
      if (body["national_id"] !== undefined) {
        if (!canBlacklist) {
          return json({ error: "forbidden", message: "Bạn không có quyền sửa CCCD." }, 403);
        }
        const cccd = normalizeCccd(body["national_id"]);
        if (!/^\d{9,12}$/.test(cccd)) {
          return json({ error: "invalid", message: "CCCD phải gồm 9–12 chữ số." }, 400);
        }
        body["national_id"] = cccd;
      }
      if (body["status"] !== undefined) {
        const status = String(body["status"]);
        const opsOk = (WORKER_STATUS_HCNS_ALLOWED as readonly string[]).includes(status);
        const blacklistOk = status === BLACKLIST_STATUS || status === "on_leave";
        if (status === BLACKLIST_STATUS && !canBlacklist) {
          return json({ error: "forbidden", message: "Bạn không có quyền đặt trạng thái Blacklist." }, 403);
        }
        if (!opsOk && !(canBlacklist && blacklistOk)) {
          return json(
            {
              error: "forbidden",
              message: "Chỉ được đặt trạng thái Đang làm, Chờ đi làm, Nghỉ việc, Không đi làm hoặc Đang tư vấn.",
            },
            403,
          );
        }
      }
      const extra = Object.keys(raw).filter(
        (key) => raw[key] !== undefined && !allowedKeys.includes(key),
      );
      if (extra.length > 0) {
        return json(
          { error: "forbidden", message: "Bạn không có quyền sửa một số trường hồ sơ này." },
          403,
        );
      }
    }

    // GD/PGĐ/KT đặt Blacklist: phải thuộc blacklistWrite (thực tế ELEVATED luôn có).
    if (canFull && body["status"] === BLACKLIST_STATUS && !canBlacklist) {
      return json({ error: "forbidden", message: "Bạn không có quyền đặt trạng thái Blacklist." }, 403);
    }

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
