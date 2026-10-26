export interface Access {
  canViewFinance: boolean;
  canViewAdvances: boolean;
  canViewCommission: boolean;
  canViewAudit: boolean;
  canViewCccd: boolean;
  canClosePeriod: boolean;
  /** Xóa bản ghi (nhân sự, công nhân, công ty, đơn hàng, vendor, tài chính, tạm ứng) */
  canDelete: boolean;
  /** @deprecated Dùng canDelete */
  canDeletePersonnel: boolean;
  canResetStaffPin: boolean;
  /** Tạo / quản lý tài khoản nhân sự (ID + mật khẩu) */
  canManageAccounts: boolean;
  /** Xem mọi SĐT công nhân (không cần là người nhập/phụ trách) */
  canViewAllWorkerPhones: boolean;
  /** GD / PGĐ / Kỹ thuật: sửa full hồ sơ NLĐ (chốt, sửa mọi trường) */
  canEditWorker: boolean;
  /** GD / PGĐ / Kỹ thuật / HCNS: tạo hồ sơ NLĐ */
  canCreateWorker: boolean;
  /** HCNS: chỉ sửa trạng thái Đang làm / Nghỉ việc */
  canEditWorkerStatus: boolean;
}

const ELEVATED: readonly string[] = ["director", "deputy_director", "tech"];

const FINANCE: readonly string[] = [...ELEVATED, "accountant"];
const ADVANCES: readonly string[] = [...ELEVATED, "accountant", "recruiter"];
const COMMISSION: readonly string[] = [...ELEVATED];
const AUDIT: readonly string[] = [...ELEVATED, "team_lead"];
const CCCD: readonly string[] = [...ELEVATED, "admin", "recruiter"];
const CLOSE: readonly string[] = [...ELEVATED, "accountant"];
const ACCOUNT_MANAGE: readonly string[] = [...ELEVATED, "admin"];
const WORKER_PHONE_FULL: readonly string[] = [...ELEVATED, "admin"];
const WORKER_STATUS_EDIT: readonly string[] = ["admin"];
const WORKER_CREATE: readonly string[] = [...ELEVATED, "admin"];

export function accessFor(role: string): Access {
  return {
    canViewFinance: FINANCE.includes(role),
    canViewAdvances: ADVANCES.includes(role),
    canViewCommission: COMMISSION.includes(role),
    canViewAudit: AUDIT.includes(role),
    canViewCccd: CCCD.includes(role),
    canClosePeriod: CLOSE.includes(role),
    canDelete: ELEVATED.includes(role),
    canDeletePersonnel: ELEVATED.includes(role),
    canResetStaffPin: ACCOUNT_MANAGE.includes(role),
    canManageAccounts: ACCOUNT_MANAGE.includes(role),
    canViewAllWorkerPhones: WORKER_PHONE_FULL.includes(role),
    canEditWorker: ELEVATED.includes(role),
    canCreateWorker: WORKER_CREATE.includes(role),
    canEditWorkerStatus: WORKER_STATUS_EDIT.includes(role),
  };
}

const LABELS: Record<string, string> = {
  director: "Giám đốc",
  deputy_director: "Phó giám đốc",
  tech: "Kỹ thuật",
  accountant: "Kế toán",
  recruiter: "Tuyển dụng",
  team_lead: "Trưởng nhóm",
  coordinator: "Điều phối",
  admin: "Hành chính nhân sự",
};

export function roleLabel(role: string): string {
  return LABELS[role] ?? role;
}
