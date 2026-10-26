import "server-only";

export const CASHBOOK_MIGRATION_MESSAGE =
  "Chưa chạy migration sổ chi. Hãy chạy supabase/cashbook_expense_month.sql.";

export function isCashbookSchemaError(message: string | null | undefined): boolean {
  return /expense_month|worker_id|staff_id|cashbook_month_closes|fn_cashbook_month_stats|missing_migration|does not exist|schema cache/i.test(
    message ?? "",
  );
}

export function cashbookMigrationResponse(status = 400) {
  return {
    body: { error: "missing_migration" as const, message: CASHBOOK_MIGRATION_MESSAGE },
    status,
  };
}
