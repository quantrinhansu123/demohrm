export const CASHBOOK_GROUPS = [
  { value: "weekly_wage", label: "Lương tuần" },
  { value: "office", label: "Chi văn phòng" },
] as const;

export type CashbookGroupCode = (typeof CASHBOOK_GROUPS)[number]["value"];

export function normalizeCashbookGroup(code: string): CashbookGroupCode {
  return code === "weekly_wage" || code === "advance" ? "weekly_wage" : "office";
}

export function cashbookGroupLabel(code: string): string {
  return CASHBOOK_GROUPS.find((group) => group.value === normalizeCashbookGroup(code))?.label ?? code;
}

export function cashbookGroupDisplay(code: string, name?: string | null): string {
  const label = cashbookGroupLabel(code);
  const detail = name?.trim();
  if (detail && normalizeCashbookGroup(code) === "office" && detail !== label) {
    return `${label} · ${detail}`;
  }
  return label;
}

export function cashbookGroupTone(code: string): "info" | "warning" | "success" | "neutral" {
  return normalizeCashbookGroup(code) === "weekly_wage" ? "info" : "warning";
}

export function isAdvanceCashbookEntry(row: { source_type?: string | null }): boolean {
  return row.source_type === "advance";
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
