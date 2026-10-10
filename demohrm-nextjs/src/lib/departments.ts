export const DEPARTMENTS = [
  { label: "Giám đốc", role: "director" },
  { label: "Phó giám đốc", role: "deputy_director" },
  { label: "Trưởng phòng", role: "team_lead" },
  { label: "Nhân viên kinh doanh", role: "recruiter" },
  { label: "Kế toán", role: "accountant" },
  { label: "Hành chính nhân sự", role: "admin" },
  { label: "Nhân viên sale", role: "recruiter" },
  { label: "Nhân viên truyền thông", role: "coordinator" },
] as const;

export type DepartmentLabel = (typeof DEPARTMENTS)[number]["label"];

const ROLE_DEPARTMENT: Record<string, DepartmentLabel> = {
  director: "Giám đốc",
  deputy_director: "Phó giám đốc",
  team_lead: "Trưởng phòng",
  accountant: "Kế toán",
  admin: "Hành chính nhân sự",
  recruiter: "Nhân viên kinh doanh",
};

export function departmentSpec(label: string): (typeof DEPARTMENTS)[number] | null {
  return DEPARTMENTS.find((d) => d.label === label) ?? null;
}

export function departmentOf(person: { title?: string | null; role: string }): DepartmentLabel | null {
  const title = person.title?.trim() ?? "";
  const exact = DEPARTMENTS.find((d) => d.label === title);
  if (exact) return exact.label;
  return ROLE_DEPARTMENT[person.role] ?? null;
}
