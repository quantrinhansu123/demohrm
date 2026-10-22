export const DEPARTMENTS = [
  { label: "Ban lãnh đạo", role: "director" },
  { label: "Hành chính nhân sự", role: "admin" },
  { label: "Kỹ thuật", role: "tech" },
  { label: "Quản lý team", role: "team_lead" },
  { label: "Nhân viên", role: "recruiter" },
  { label: "CTV", role: "recruiter" },
] as const;

export const ORG_BANDS: { title: string; labels: string[] }[] = [
  { title: "Ban lãnh đạo · Hành chính · Kỹ thuật", labels: ["Ban lãnh đạo", "Hành chính nhân sự", "Kỹ thuật"] },
  { title: "Quản lý team", labels: ["Quản lý team"] },
  { title: "Nhân viên / CTV / Vendor", labels: ["Nhân viên", "CTV"] },
];

const LEGACY_DEPARTMENT: Record<string, string> = {
  "Giám đốc": "Ban lãnh đạo",
  "Phó giám đốc": "Ban lãnh đạo",
  "Trưởng phòng": "Quản lý team",
  "Quản lý": "Quản lý team",
  "Nhân viên kinh doanh": "Nhân viên",
  "Nhân viên sale": "Nhân viên",
  "Kế toán": "Hành chính nhân sự",
  "Nhân viên truyền thông": "Nhân viên",
  "Hành chính nhân sự": "Hành chính nhân sự",
};

export type DepartmentLabel = (typeof DEPARTMENTS)[number]["label"];

const ROLE_DEPARTMENT: Record<string, string> = {
  director: "Ban lãnh đạo",
  deputy_director: "Ban lãnh đạo",
  tech: "Kỹ thuật",
  team_lead: "Quản lý team",
  accountant: "Hành chính nhân sự",
  admin: "Hành chính nhân sự",
  recruiter: "Nhân viên",
  coordinator: "CTV",
};

const LEAD_DEPARTMENTS = new Set<string>(["Ban lãnh đạo", "Quản lý team"]);

export function isSaleStaff(_person: { title?: string | null; role: string }): boolean {
  return true;
}

export function isLeadStaff(person: { title?: string | null; role: string }): boolean {
  const department = departmentOf(person);
  if (department && LEAD_DEPARTMENTS.has(department)) return true;
  return (person.title ?? "").includes("Phụ trách");
}

export function departmentSpec(label: string): (typeof DEPARTMENTS)[number] | null {
  return DEPARTMENTS.find((d) => d.label === label) ?? null;
}

export function resolveDepartment(label: string, position = ""): { label: string; role: string } | null {
  const name = label.trim().replace(/\s+/g, " ");
  if (!name || name.length > 60 || name.includes("·")) return null;
  const spec = departmentSpec(name);
  const job = position.trim().replace(/\s+/g, " ");
  let role = spec?.role ?? "coordinator";
  // Ban lãnh đạo + vị trí Phó giám đốc → role deputy_director
  if (role === "director" && /phó\s*giám\s*đốc/i.test(job)) role = "deputy_director";
  return { label: spec?.label ?? name, role };
}

export function departmentOf(person: { title?: string | null; role: string }): string | null {
  const title = person.title?.trim() ?? "";
  if (!title) return ROLE_DEPARTMENT[person.role] ?? null;
  const head = title.split(" · ")[0]?.trim() ?? "";
  const exact = DEPARTMENTS.find((d) => d.label === head || d.label === title);
  if (exact) return exact.label;
  const legacy = LEGACY_DEPARTMENT[head] ?? LEGACY_DEPARTMENT[title];
  if (legacy) return legacy;
  return head || ROLE_DEPARTMENT[person.role] || null;
}

export function positionOf(person: { title?: string | null; role: string }): string {
  const title = person.title?.trim() ?? "";
  const department = departmentOf(person);
  if (!title || !department || title === department) return "";
  const prefix = `${department} · `;
  if (title.startsWith(prefix)) return title.slice(prefix.length);
  const head = title.split(" · ")[0]?.trim() ?? "";
  if ((LEGACY_DEPARTMENT[head] || DEPARTMENTS.some((item) => item.label === head)) && title.includes(" · ")) {
    return title.split(" · ").slice(1).join(" · ");
  }
  return "";
}

export function staffTitle(department: string, position: string): string {
  const job = position.trim().replace(/\s+/g, " ").split(" · ").join(" - ");
  if (!job || job === department) return department;
  return `${department} · ${job}`;
}
