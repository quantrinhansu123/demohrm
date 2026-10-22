import "server-only";

export const CASHBOOK_GROUPS = ["insurance", "office", "advance", "other"] as const;

export const CASHBOOK_COLUMNS =
  "id,entry_date,content,full_name,company_name,amount,note,group_code,group_name,created_at,updated_at";

export function isCashbookGroup(value: unknown): value is (typeof CASHBOOK_GROUPS)[number] {
  return typeof value === "string" && (CASHBOOK_GROUPS as readonly string[]).includes(value);
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

export function cashbookAmount(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
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
    const group = body["group_code"] ?? "other";
    if (!isCashbookGroup(group)) return { error: "Nhóm chi không hợp lệ." };
    value["group_code"] = group;
    if (group !== "other") value["group_name"] = null;
  }

  if (body["group_name"] !== undefined) {
    const groupName = cashbookText(body["group_name"], 100);
    if (!partial && value["group_code"] === "other" && !groupName) {
      return { error: "Nhập tên nhóm chi khác." };
    }
    value["group_name"] = groupName || null;
  } else if (!partial && value["group_code"] === "other") {
    return { error: "Nhập tên nhóm chi khác." };
  }

  if (body["full_name"] !== undefined) value["full_name"] = cashbookText(body["full_name"], 150) || null;
  if (body["company_name"] !== undefined) value["company_name"] = cashbookText(body["company_name"], 150) || null;
  if (body["note"] !== undefined) value["note"] = cashbookText(body["note"], 2000) || null;

  value["updated_at"] = new Date().toISOString();
  return { value };
}
