export const runtime = "nodejs";

import { currentMonthCode } from "@/lib/server/cashbook-months";
import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import { CASHBOOK_MIGRATION_MESSAGE, isCashbookSchemaError } from "@/lib/server/cashbook-errors";

interface CloseRow {
  month_code: string;
  closed_at: string;
  closed_by: number | null;
  note: string | null;
}

interface StatRow {
  expense_month: string;
  entry_count: number | string;
  total_amount: number | string;
  weekly_wage: number | string;
  office: number | string;
}

function migrationError(): Response {
  return json({ error: "missing_migration", message: CASHBOOK_MIGRATION_MESSAGE }, 400);
}

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);

    const [closesRes, statsRes] = await Promise.all([
      getSupabase()
        .from("cashbook_month_closes")
        .select("month_code,closed_at,closed_by,note")
        .order("month_code", { ascending: false }),
      getSupabase().rpc("fn_cashbook_month_stats"),
    ]);

    if (closesRes.error) {
      if (isCashbookSchemaError(closesRes.error.message)) return migrationError();
      throw closesRes.error;
    }
    if (statsRes.error) {
      if (isCashbookSchemaError(statsRes.error.message)) return migrationError();
      throw statsRes.error;
    }

    const closedRows = (closesRes.data ?? []) as CloseRow[];
    const closedMap = new Map(closedRows.map((row) => [String(row.month_code), row]));

    const stats = new Map<
      string,
      { count: number; amount: number; weekly_wage: number; office: number }
    >();
    for (const row of (statsRes.data ?? []) as StatRow[]) {
      const month = String(row.expense_month ?? "");
      if (!month) continue;
      stats.set(month, {
        count: Number(row.entry_count) || 0,
        amount: Number(row.total_amount) || 0,
        weekly_wage: Number(row.weekly_wage) || 0,
        office: Number(row.office) || 0,
      });
    }

    const current = currentMonthCode();
    const codes = new Set<string>([current, ...closedMap.keys(), ...stats.keys()]);
    const months = [...codes]
      .sort((a, b) => b.localeCompare(a))
      .map((month_code) => {
        const closed = closedMap.get(month_code);
        const stat = stats.get(month_code) ?? { count: 0, amount: 0, weekly_wage: 0, office: 0 };
        return {
          month_code,
          status: closed ? ("closed" as const) : ("open" as const),
          closed_at: closed?.closed_at ?? null,
          closed_by: closed?.closed_by ?? null,
          note: closed?.note ?? null,
          entry_count: stat.count,
          total_amount: stat.amount,
          weekly_wage: stat.weekly_wage,
          office: stat.office,
          is_current: month_code === current,
        };
      });

    return json({
      current_month: current,
      current_closed: closedMap.has(current),
      closed: closedRows,
      months,
    });
  } catch (e) {
    return apiError(e);
  }
}
