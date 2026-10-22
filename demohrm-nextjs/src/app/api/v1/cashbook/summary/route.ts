export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import { cashbookDate } from "@/lib/server/cashbook";

interface SummaryRow {
  period: string;
  total: number;
  insurance: number;
  office: number;
  other: number;
  count: number;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function firstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function emptyRow(period: string): SummaryRow {
  return { period, total: 0, insurance: 0, office: 0, other: 0, count: 0 };
}

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const sp = searchParams(req);
    const from = cashbookDate(sp.get("from")) ?? firstDayOfMonth();
    const to = cashbookDate(sp.get("to")) ?? today();
    const groupBy = sp.get("group_by") === "month" ? "month" : "day";

    if (from > to) return json({ error: "invalid", message: "Khoảng ngày không hợp lệ." }, 400);

    const { data, error } = await getSupabase()
      .from("cashbook_entries")
      .select("entry_date,amount,group_code")
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: true })
      .limit(10000);
    if (error) throw error;

    const map = new Map<string, SummaryRow>();
    for (const row of data ?? []) {
      const date = String(row.entry_date);
      const period = groupBy === "month" ? date.slice(0, 7) : date;
      const current = map.get(period) ?? emptyRow(period);
      const amount = Number(row.amount) || 0;
      const group = String(row.group_code);
      current.total += amount;
      current.count += 1;
      if (group === "insurance") current.insurance += amount;
      else if (group === "office") current.office += amount;
      else current.other += amount;
      map.set(period, current);
    }

    const rows = [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
    const totals = rows.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.insurance += row.insurance;
        acc.office += row.office;
        acc.other += row.other;
        acc.count += row.count;
        return acc;
      },
      emptyRow(""),
    );

    return json({ from, to, group_by: groupBy, rows, totals });
  } catch (e) {
    return apiError(e);
  }
}
