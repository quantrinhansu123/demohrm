import type { ModuleId } from "@/types/hrm";

/** Tên trang trên thanh địa chỉ, không dấu. */
export const MODULE_SLUG: Record<ModuleId, string> = {
  dashboard: "tong-quan",
  orders: "don-hang-cung-ung",
  workers: "nguoi-lao-dong",
  personnel: "nhan-su",
  companies: "cong-ty",
  vendors: "vendor",
  attendance: "cham-cong",
  timesheet: "bang-cong",
  payroll: "luong",
  advances: "tam-ung",
  finance: "tai-chinh",
  commission: "hoa-hong",
  reports: "bao-cao",
  audit: "lich-su",
  team: "nhom",
  factory: "nha-may",
  cycle: "chu-ky",
};

const SLUG_MODULE = Object.fromEntries(
  Object.entries(MODULE_SLUG).map(([id, slug]) => [slug, id])
) as Record<string, ModuleId>;

export function isModuleSlug(slug: string): boolean {
  return slug in SLUG_MODULE;
}

export function moduleFromPath(pathname: string): ModuleId {
  const slug = pathname.split("/").filter(Boolean)[0] ?? "";
  if (slug === "khach-hang") return "companies";
  // Tạm ứng đã gộp vào sổ chi / Tài chính.
  if (slug === "tam-ung") return "finance";
  return SLUG_MODULE[slug] ?? "orders";
}

export function pathForModule(module: ModuleId): string {
  if (module === "advances") return `/${MODULE_SLUG.finance}`;
  return `/${MODULE_SLUG[module]}`;
}
