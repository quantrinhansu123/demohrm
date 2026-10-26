export const runtime = "nodejs";

import { currentMonthCode, monthCodeFromDate, parseMonthCode } from "@/lib/server/advance-months";
import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json } from "@/lib/server/http";

interface CloseRow {
  month_code: string;
  closed_at: string;
  closed_by: number | null;
  note: string | null;
}

interface AdvanceMonthStatRow {
  advance_month?: string | null;
  advance_date?: string | null;
  status: string;
  amount: number | string;
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);

    const [closesRes, advancesRes] = await Promise.all([
      getSupabase()
        .from("advance_month_closes")
        .select("month_code,closed_at,closed_by,note")
        .order("month_code", { ascending: false }),
      getSupabase().from("advances").select("advance_month,advance_date,status,amount").limit(20000),
    ]);
    if (closesRes.error) throw closesRes.error;
    if (advancesRes.error) {
      if (/advance_month/i.test(advancesRes.error.message ?? "")) {
        return json(
          {
            error: "missing_migration",
            message: "Chưa có cột tháng tạm ứng. Hãy chạy supabase/advance_month_column.sql.",
          },
          400,
        );
      }
      throw advancesRes.error;
    }

    const closedRows = (closesRes.data ?? []) as CloseRow[];
    const closedMap = new Map(closedRows.map((row) => [String(row.month_code), row]));

    const stats = new Map<string, { count: number; amount: number; open_count: number }>();
    for (const row of (advancesRes.data ?? []) as AdvanceMonthStatRow[]) {
      const month =
        parseMonthCode(row.advance_month) ??
        monthCodeFromDate(String(row.advance_date ?? ""));
      if (!month) continue;
      const current = stats.get(month) ?? { count: 0, amount: 0, open_count: 0 };
      current.count += 1;
      current.amount += Number(row.amount) || 0;
      if (row.status === "requested" || row.status === "approved" || row.status === "paid") {
        current.open_count += 1;
      }
      stats.set(month, current);
    }

    const current = currentMonthCode();
    const codes = new Set<string>([current, ...closedMap.keys(), ...stats.keys()]);
    const months = [...codes]
      .sort((a, b) => b.localeCompare(a))
      .map((month_code) => {
        const closed = closedMap.get(month_code);
        const stat = stats.get(month_code) ?? { count: 0, amount: 0, open_count: 0 };
        return {
          month_code,
          status: closed ? ("closed" as const) : ("open" as const),
          closed_at: closed?.closed_at ?? null,
          closed_by: closed?.closed_by ?? null,
          note: closed?.note ?? null,
          advance_count: stat.count,
          total_amount: stat.amount,
          open_count: closed ? 0 : stat.open_count,
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
