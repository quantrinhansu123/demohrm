export const runtime = "nodejs";

import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import {
  applyCashbookGroupFilter,
  cashbookDate,
  normalizeCashbookGroup,
} from "@/lib/server/cashbook";

interface SummaryRow {
  period: string;
  total: number;
  weekly_wage: number;
  office: number;
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
  return { period, total: 0, weekly_wage: 0, office: 0, count: 0 };
}

const PAGE_SIZE = 1000;

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const sp = searchParams(req);
    const from = cashbookDate(sp.get("from")) ?? firstDayOfMonth();
    const to = cashbookDate(sp.get("to")) ?? today();
    const groupBy = sp.get("group_by") === "month" ? "month" : "day";
    const group = sp.get("group");

    if (from > to) return json({ error: "invalid", message: "Khoảng ngày không hợp lệ." }, 400);

    const map = new Map<string, SummaryRow>();
    let offset = 0;

    for (;;) {
      let q = getSupabase()
        .from("cashbook_entries")
        .select("entry_date,amount,group_code")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      q = applyCashbookGroupFilter(q, group);

      const { data, error } = await q;
      if (error) throw error;

      const batch = data ?? [];
      for (const row of batch) {
        const date = String(row.entry_date);
        const period = groupBy === "month" ? date.slice(0, 7) : date;
        const current = map.get(period) ?? emptyRow(period);
        const amount = Number(row.amount) || 0;
        current.total += amount;
        current.count += 1;
        if (normalizeCashbookGroup(row.group_code) === "weekly_wage") current.weekly_wage += amount;
        else current.office += amount;
        map.set(period, current);
      }

      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const rows = [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
    const totals = rows.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.weekly_wage += row.weekly_wage;
        acc.office += row.office;
        acc.count += row.count;
        return acc;
      },
      emptyRow(""),
    );

    return json({ from, to, group_by: groupBy, group: group || null, rows, totals });
  } catch (e) {
    return apiError(e);
  }
}
