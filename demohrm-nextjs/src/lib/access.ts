export interface Access {
  canViewFinance: boolean;
  canViewCommission: boolean;
  canViewAudit: boolean;
  canViewCccd: boolean;
  canClosePeriod: boolean;
}

const FINANCE = ["director", "deputy_director", "accountant"];
const COMMISSION = ["director", "deputy_director"];
const AUDIT = ["director", "deputy_director", "team_lead"];
const CCCD = ["director", "deputy_director", "recruiter"];
const CLOSE = ["director", "deputy_director", "accountant"];

export function accessFor(role: string): Access {
  return {
    canViewFinance: FINANCE.includes(role),
    canViewCommission: COMMISSION.includes(role),
    canViewAudit: AUDIT.includes(role),
    canViewCccd: CCCD.includes(role),
    canClosePeriod: CLOSE.includes(role),
  };
}

const LABELS: Record<string, string> = {
  director: "Giám đốc",
  deputy_director: "Phó giám đốc",
  accountant: "Kế toán",
  recruiter: "Tuyển dụng",
  team_lead: "Trưởng nhóm",
  coordinator: "Điều phối",
};

export function roleLabel(role: string): string {
  return LABELS[role] ?? role;
}
