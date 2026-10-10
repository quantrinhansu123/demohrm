export const DEPARTMENTS = [
  { label: "Giám đốc", role: "director" },
  { label: "Phó giám đốc", role: "deputy_director" },
  { label: "Trưởng phòng", role: "team_lead" },
  { label: "Quản lý", role: "team_lead" },
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

const LEAD_DEPARTMENTS = new Set<string>(["Giám đốc", "Phó giám đốc", "Trưởng phòng", "Quản lý"]);

export function isSaleStaff(person: { title?: string | null; role: string }): boolean {
  return departmentOf(person) === "Nhân viên sale";
}

export function isLeadStaff(person: { title?: string | null; role: string }): boolean {
  const department = departmentOf(person);
  if (department && LEAD_DEPARTMENTS.has(department)) return true;
  return (person.title ?? "").includes("Phụ trách");
}

export function departmentSpec(label: string): (typeof DEPARTMENTS)[number] | null {
  return DEPARTMENTS.find((d) => d.label === label) ?? null;
}

export function departmentOf(person: { title?: string | null; role: string }): DepartmentLabel | null {
  const title = person.title?.trim() ?? "";
  const head = title.split(" · ")[0] ?? "";
  const exact = DEPARTMENTS.find((d) => d.label === head || d.label === title);
  if (exact) return exact.label;
  return ROLE_DEPARTMENT[person.role] ?? null;
}

export function positionOf(person: { title?: string | null; role: string }): string {
  const title = person.title?.trim() ?? "";
  const department = departmentOf(person);
  if (department && title.startsWith(`${department} · `)) return title.slice(department.length + 3);
  if (!title || (department && title === department)) return "";
  if (DEPARTMENTS.some((d) => d.label === title)) return "";
  return title;
}

export function staffTitle(department: string, position: string): string {
  const job = position.trim().replace(/\s+/g, " ").split(" · ").join(" - ");
  if (!job || job === department) return department;
  return `${department} · ${job}`;
}
