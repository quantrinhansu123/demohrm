export const CASHBOOK_GROUPS = [
  { value: "insurance", label: "Bảo hiểm (BH)" },
  { value: "office", label: "Chi văn phòng (VP)" },
  { value: "other", label: "Khác" },
] as const;

export const CASHBOOK_ENTRY_GROUPS = CASHBOOK_GROUPS;

export function cashbookGroupLabel(code: string): string {
  if (code === "advance") return "Khác";
  return CASHBOOK_GROUPS.find((group) => group.value === code)?.label ?? code;
}

export function cashbookGroupDisplay(code: string, name?: string | null): string {
  if (code === "advance") return "Khác";
  if (code === "other" && name) return name;
  return cashbookGroupLabel(code);
}

export function cashbookGroupTone(code: string): "info" | "warning" | "success" | "neutral" {
  if (code === "insurance") return "info";
  if (code === "office") return "warning";
  return "neutral";
}

export function todayInput(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function monthRangeInput(): { from: string; to: string } {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return { from, to: todayInput() };
}

export function weekRangeInput(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  const pad = (value: number) => String(value).padStart(2, "0");
  const from = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  return { from, to: todayInput() };
}

export function formatCashbookDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}
