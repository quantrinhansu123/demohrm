import "server-only";

export const CASHBOOK_GROUPS = ["weekly_wage", "office"] as const;
export type CashbookGroupCode = (typeof CASHBOOK_GROUPS)[number];

/** Legacy codes still readable before/during migration. */
const WEEKLY_WAGE_CODES = ["weekly_wage", "advance"] as const;
const OFFICE_CODES = ["office", "insurance", "other"] as const;

export const CASHBOOK_COLUMNS =
  "id,entry_date,content,full_name,company_name,amount,note,group_code,group_name,source_type,source_id,created_at,updated_at";

export function isCashbookGroup(value: unknown): value is CashbookGroupCode {
  return typeof value === "string" && (CASHBOOK_GROUPS as readonly string[]).includes(value);
}

export function normalizeCashbookGroup(code: unknown): CashbookGroupCode {
  return code === "weekly_wage" || code === "advance" ? "weekly_wage" : "office";
}

/** Apply UI group filter, including legacy codes until migration finishes. */
export function applyCashbookGroupFilter<T extends { in: (column: string, values: readonly string[]) => T; eq: (column: string, value: string) => T }>(
  query: T,
  group: string | null,
): T {
  if (!group || !isCashbookGroup(group)) return query;
  if (group === "weekly_wage") return query.in("group_code", WEEKLY_WAGE_CODES);
  return query.in("group_code", OFFICE_CODES);
}

export function cashbookDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function cashbookText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, max) : "";
}

/** Strip PostgREST filter metacharacters from free-text search. */
export function cashbookSearchTerm(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[%*,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function cashbookAmount(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function isSystemCashbookEntry(row: { source_type?: string | null }): boolean {
  return row.source_type === "advance";
}

export function cashbookPayload(
  body: Record<string, unknown>,
  partial = false,
): { value?: Record<string, unknown>; error?: string } {
  const value: Record<string, unknown> = {};

  if (body["entry_date"] !== undefined || !partial) {
    const date = cashbookDate(body["entry_date"]);
    if (!date) return { error: "Ngày chi không hợp lệ." };
    value["entry_date"] = date;
  }

  if (body["content"] !== undefined || !partial) {
    const content = cashbookText(body["content"], 1000);
    if (!content) return { error: "Nhập nội dung chi." };
    value["content"] = content;
  }

  if (body["amount"] !== undefined || !partial) {
    const amount = cashbookAmount(body["amount"]);
    if (!amount) return { error: "Số tiền phải lớn hơn 0." };
    value["amount"] = amount;
  }

  if (body["group_code"] !== undefined || !partial) {
    const group = body["group_code"] ?? "office";
    if (!isCashbookGroup(group)) return { error: "Nhóm chi không hợp lệ." };
    value["group_code"] = group;
    value["group_name"] = null;
  }

  if (body["full_name"] !== undefined) value["full_name"] = cashbookText(body["full_name"], 150) || null;
  if (body["company_name"] !== undefined) value["company_name"] = cashbookText(body["company_name"], 150) || null;
  if (body["note"] !== undefined) value["note"] = cashbookText(body["note"], 2000) || null;

  // Manual CRUD never owns system provenance.
  if (!partial) {
    value["source_type"] = null;
    value["source_id"] = null;
  }

  value["updated_at"] = new Date().toISOString();
  return { value };
}
