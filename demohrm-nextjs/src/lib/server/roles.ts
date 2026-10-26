import "server-only";

/** Ban lãnh đạo + Kỹ thuật: quyền cao nhất (xem hệ thống / tài chính / tài khoản). */
export const ELEVATED = ["director", "deputy_director", "tech"] as const;

/**
 * Ma trận quyền server — khớp yêu cầu chốt:
 * 1) GD / PGĐ / Kỹ thuật
 * 2) HCNS (admin)
 * 3) Nhân viên thường (+ ngoại lệ SĐT theo hồ sơ ở worker-privacy)
 */
export const ROLE = {
  finance: [...ELEVATED, "accountant"],
  commission: [...ELEVATED],
  audit: [...ELEVATED, "team_lead"],
  cccd: [...ELEVATED, "admin", "recruiter"],
  closePeriod: [...ELEVATED, "accountant"],
  /** Xóa bản ghi: chỉ Ban lãnh đạo + Kỹ thuật */
  deleteRecords: [...ELEVATED],
  /** @deprecated Dùng deleteRecords */
  personnelDelete: [...ELEVATED],
  /** Tạo tài khoản + đặt lại PIN: GD/PGĐ/Kỹ thuật/HCNS */
  accountManage: [...ELEVATED, "admin"],
  staffPinReset: [...ELEVATED, "admin"],
  /** Xem SĐT công nhân không cần là người nhập/phụ trách */
  workerPhoneFull: [...ELEVATED, "admin"],
  /** Sửa full hồ sơ NLĐ */
  workerEdit: [...ELEVATED],
  /** HCNS: chỉ sửa trạng thái Đang làm / Nghỉ việc */
  workerStatusEdit: ["admin"],
} as const;

/** Trạng thái HCNS được phép gán. */
export const WORKER_STATUS_HCNS_ALLOWED = ["working", "resigned"] as const;

export function hasRole(role: string | undefined, allowed: readonly string[]): boolean {
  return Boolean(role) && allowed.includes(role as string);
}
