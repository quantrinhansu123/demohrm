import "server-only";

import { z } from "zod";

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

const entryDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày chi không hợp lệ.");

export const positiveIdSchema = z.coerce
  .number({ error: "Id không hợp lệ." })
  .int("Id không hợp lệ.")
  .positive("Id không hợp lệ.");

const optionalNullableText = (max: number, emptyToNull = true) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value == null) return null;
      const trimmed = value.trim().replace(/\s+/g, " ");
      if (!trimmed) return emptyToNull ? null : "";
      return trimmed.slice(0, max);
    });

const amountSchema = z.coerce
  .number({ error: "Số tiền phải lớn hơn 0." })
  .refine((n) => Number.isFinite(n) && n > 0, "Số tiền phải lớn hơn 0.")
  .transform((n) => Math.round(n * 100) / 100);

const groupCodeSchema = z
  .enum(CASHBOOK_GROUPS, { error: "Nhóm chi không hợp lệ." })
  .default("office");

const cashbookFieldsSchema = z.object({
  entry_date: entryDateSchema,
  content: z
    .string({ error: "Nhập nội dung chi." })
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Nhập nội dung chi.").max(1000)),
  amount: amountSchema,
  group_code: groupCodeSchema,
  full_name: optionalNullableText(150).optional(),
  company_name: optionalNullableText(150).optional(),
  note: optionalNullableText(2000).optional(),
});

const cashbookCreateSchema = cashbookFieldsSchema;
const cashbookPatchSchema = cashbookFieldsSchema.partial();

export function cashbookDate(value: unknown): string | null {
  const parsed = entryDateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Strip PostgREST filter metacharacters from free-text search. */
export function cashbookSearchTerm(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[%*,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function isSystemCashbookEntry(row: { source_type?: string | null }): boolean {
  return row.source_type === "advance";
}

function firstZodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
}

export function parsePositiveId(value: unknown): number | null {
  const parsed = positiveIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function cashbookPayload(
  body: Record<string, unknown>,
  partial = false,
): { value?: Record<string, unknown>; error?: string } {
  const parsed = (partial ? cashbookPatchSchema : cashbookCreateSchema).safeParse(body);
  if (!parsed.success) return { error: firstZodMessage(parsed.error) };

  const data = parsed.data;
  const value: Record<string, unknown> = {};

  if (data.entry_date !== undefined) value["entry_date"] = data.entry_date;
  if (data.content !== undefined) value["content"] = data.content;
  if (data.amount !== undefined) value["amount"] = data.amount;
  if (data.group_code !== undefined) {
    value["group_code"] = data.group_code;
    value["group_name"] = null;
  }
  if (data.full_name !== undefined) value["full_name"] = data.full_name;
  if (data.company_name !== undefined) value["company_name"] = data.company_name;
  if (data.note !== undefined) value["note"] = data.note;

  // Manual CRUD never owns system provenance.
  if (!partial) {
    value["source_type"] = null;
    value["source_id"] = null;
  }

  value["updated_at"] = new Date().toISOString();
  return { value };
}
