import "server-only";

import { ROLE, hasRole } from "@/lib/server/roles";

export type WorkerPhoneScope = {
  created_by?: number | null;
  recruiter_id?: number | null;
  manager_id?: number | null;
};

/** Ẩn SĐT: giữ 3 số cuối. */
export function maskWorkerPhone(phone: string | null | undefined): string {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-3)}`;
}

/**
 * GD/PGĐ/Kỹ thuật/HCNS: xem mọi SĐT.
 * Nhân viên thường: chỉ khi là người tạo, sale phụ trách, hoặc quản lý hồ sơ.
 */
export function canViewWorkerPhone(
  role: string | undefined,
  staffId: string | number | null | undefined,
  worker: WorkerPhoneScope,
): boolean {
  if (hasRole(role, ROLE.workerPhoneFull)) return true;
  const sid = Number(staffId);
  if (!Number.isInteger(sid) || sid <= 0) return false;
  return worker.created_by === sid || worker.recruiter_id === sid || worker.manager_id === sid;
}

export function applyWorkerPhonePrivacy<T extends Record<string, unknown>>(
  row: T,
  role: string | undefined,
  staffId: string | number | null | undefined,
): T & { phone_hidden: boolean } {
  const scope: WorkerPhoneScope = {
    created_by: row["created_by"] == null ? null : Number(row["created_by"]),
    recruiter_id: row["recruiter_id"] == null ? null : Number(row["recruiter_id"]),
    manager_id: row["manager_id"] == null ? null : Number(row["manager_id"]),
  };
  const allowed = canViewWorkerPhone(role, staffId, scope);
  if (allowed) return { ...row, phone_hidden: false };
  return {
    ...row,
    phone: maskWorkerPhone(row["phone"] as string | null | undefined),
    phone_hidden: true,
  };
}
