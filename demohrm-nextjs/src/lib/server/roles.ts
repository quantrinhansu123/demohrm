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
  /** CCCD: + team_lead vì Quản lý được sửa CCCD trên Blacklist. */
  cccd: [...ELEVATED, "admin", "recruiter", "team_lead"],
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
  /** Tạo hồ sơ NLĐ: GD/PGĐ/Kỹ thuật/HCNS/Nhân viên/CTV (recruiter). */
  workerCreate: [...ELEVATED, "admin", "recruiter", "coordinator"],
  /** HCNS + Nhân viên/CTV: sửa trạng thái / chốt / tái tuyển (ops patch, không full edit). */
  workerStatusEdit: ["admin", "recruiter", "coordinator"],
  /** Sửa/tạo đơn hàng: chỉ Ban lãnh đạo + Kỹ thuật (HCNS không được) */
  orderWrite: [...ELEVATED],
  /** Sửa/tạo công ty: chỉ Ban lãnh đạo + Kỹ thuật (HCNS không được) */
  companyWrite: [...ELEVATED],
  /** Sửa hồ sơ nhân sự: chỉ Ban lãnh đạo + Kỹ thuật (HCNS không được; vẫn tạo TK / đặt PIN) */
  staffEdit: [...ELEVATED],
  /** Blacklist: thêm/sửa — Ban lãnh đạo + Kỹ thuật + HCNS + Quản lý (team_lead). Ai cũng xem. */
  blacklistWrite: [...ELEVATED, "admin", "team_lead"],
} as const;

/** Trạng thái HCNS được phép gán (đi làm / chờ / nghỉ / không đi làm / tư vấn khi tái tuyển). Không gồm Blacklist. */
export const WORKER_STATUS_HCNS_ALLOWED = ["working", "waiting_start", "resigned", "no_show", "candidate"] as const;

/** Trạng thái Blacklist — chỉ Ban lãnh đạo / HCNS / Quản lý được gán hoặc gỡ. */
export const BLACKLIST_STATUS = "blacklisted" as const;

export function hasRole(role: string | undefined, allowed: readonly string[]): boolean {
  return Boolean(role) && allowed.includes(role as string);
}
