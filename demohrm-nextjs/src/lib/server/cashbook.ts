import "server-only";

import { z } from "zod";
import { monthCodeFromDate, parseMonthCode } from "@/lib/advance-months";
import { getSupabase } from "@/lib/server/db";

export const CASHBOOK_GROUPS = ["weekly_wage", "office"] as const;
export type CashbookGroupCode = (typeof CASHBOOK_GROUPS)[number];

/** Legacy codes still readable before/during migration. */
const WEEKLY_WAGE_CODES = ["weekly_wage", "advance"] as const;
const OFFICE_CODES = ["office", "insurance", "other"] as const;

export const CASHBOOK_COLUMNS =
  "id,entry_date,expense_month,content,full_name,company_name,worker_id,staff_id,amount,note,group_code,group_name,source_type,source_id,created_at,updated_at";

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

const expenseMonthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Tháng chi không hợp lệ.");

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

const optionalId = z
  .union([z.coerce.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
    return n;
  });

const cashbookFieldsSchema = z.object({
  entry_date: entryDateSchema,
  expense_month: expenseMonthSchema.optional(),
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
  worker_id: optionalId.optional(),
  staff_id: optionalId.optional(),
});

const cashbookCreateSchema = cashbookFieldsSchema;
const cashbookPatchSchema = cashbookFieldsSchema.partial();

export function cashbookDate(value: unknown): string | null {
  const parsed = entryDateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function cashbookMonth(value: unknown): string | null {
  return parseMonthCode(typeof value === "string" ? value : null);
}

/** Strip PostgREST filter metacharacters from free-text search. */
export function cashbookSearchTerm(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[%*,()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Nhiều `company=` — sanitize từng giá trị, bỏ trùng. */
export function cashbookCompanyFilters(sp: URLSearchParams): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of sp.getAll("company")) {
    const value = cashbookSearchTerm(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Áp dụng lọc company_name: 1 → eq, nhiều → in. */
export function applyCashbookCompanyFilter<T extends { eq: (c: string, v: unknown) => T; in: (c: string, v: readonly unknown[]) => T }>(
  query: T,
  companies: string[],
): T {
  if (companies.length === 1) return query.eq("company_name", companies[0]);
  if (companies.length > 1) return query.in("company_name", companies);
  return query;
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

async function resolvePayeeName(workerId: number | null, staffId: number | null): Promise<string | null> {
  if (workerId) {
    const { data, error } = await getSupabase().from("workers").select("full_name").eq("id", workerId).maybeSingle();
    if (error) throw error;
    return data?.full_name?.trim() || null;
  }
  if (staffId) {
    const { data, error } = await getSupabase().from("staff").select("full_name").eq("id", staffId).maybeSingle();
    if (error) throw error;
    return data?.full_name?.trim() || null;
  }
  return null;
}

export async function cashbookPayload(
  body: Record<string, unknown>,
  partial = false,
): Promise<{ value?: Record<string, unknown>; error?: string }> {
  const parsed = (partial ? cashbookPatchSchema : cashbookCreateSchema).safeParse(body);
  if (!parsed.success) return { error: firstZodMessage(parsed.error) };

  const data = parsed.data;
  const value: Record<string, unknown> = {};

  if (data.entry_date !== undefined) value["entry_date"] = data.entry_date;
  if (data.content !== undefined) value["content"] = data.content;
  if (data.amount !== undefined) value["amount"] = data.amount;
  if (data.company_name !== undefined) value["company_name"] = data.company_name;
  if (data.note !== undefined) value["note"] = data.note;
  if (data.group_code !== undefined) {
    value["group_code"] = data.group_code;
    value["group_name"] = null;
  }

  const touchPayee = data.worker_id !== undefined || data.staff_id !== undefined;
  if (touchPayee) {
    const workerId = data.worker_id !== undefined ? (data.worker_id ?? null) : null;
    const staffId = data.staff_id !== undefined ? (data.staff_id ?? null) : null;
    if (workerId != null && staffId != null) {
      return { error: "Chỉ chọn công nhân hoặc nhân sự, không chọn cả hai." };
    }
    // XOR: chọn một bên thì clear bên còn lại; clear cả hai khi không chọn.
    value["worker_id"] = workerId && !staffId ? workerId : null;
    value["staff_id"] = staffId && !workerId ? staffId : null;
    value["full_name"] =
      workerId || staffId
        ? await resolvePayeeName(workerId, staffId)
        : data.full_name !== undefined
          ? data.full_name
          : null;
  } else if (data.full_name !== undefined) {
    value["full_name"] = data.full_name;
  }

  const expenseMonth =
    data.expense_month ??
    (data.entry_date !== undefined ? monthCodeFromDate(data.entry_date) : undefined);
  if (expenseMonth !== undefined) {
    if (!expenseMonth) return { error: "Tháng chi không hợp lệ." };
    value["expense_month"] = expenseMonth;
  }

  if (!partial) {
    value["source_type"] = null;
    value["source_id"] = null;
    if (!value["expense_month"] && typeof value["entry_date"] === "string") {
      value["expense_month"] = monthCodeFromDate(value["entry_date"] as string);
    }
    if (!value["expense_month"]) return { error: "Chọn tháng chi." };
  }

  value["updated_at"] = new Date().toISOString();
  return { value };
}
