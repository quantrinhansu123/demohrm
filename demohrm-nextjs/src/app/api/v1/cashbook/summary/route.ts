export const runtime = "nodejs";

import { daysBetween } from "@/lib/advance-months";
import { getAuth, requireRole } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";
import {
  applyCashbookGroupFilter,
  cashbookDate,
  cashbookMonth,
  normalizeCashbookGroup,
} from "@/lib/server/cashbook";
import { CASHBOOK_MIGRATION_MESSAGE, isCashbookSchemaError } from "@/lib/server/cashbook-errors";
import { monthBounds } from "@/lib/server/cashbook-months";
import { monthRangeInput, todayInput } from "@/lib/cashbook";

interface SummaryRow {
  period: string;
  total: number;
  weekly_wage: number;
  office: number;
  count: number;
}

function emptyRow(period: string): SummaryRow {
  return { period, total: 0, weekly_wage: 0, office: 0, count: 0 };
}

const PAGE_SIZE = 1000;
/** Giới hạn khoảng tổng hợp để tránh quét quá lớn. */
const MAX_SUMMARY_DAYS = 400;

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const sp = searchParams(req);
    const month = cashbookMonth(sp.get("month"));
    const bounds = month ? monthBounds(month) : null;
    const defaults = monthRangeInput();
    const from = bounds?.from ?? cashbookDate(sp.get("from")) ?? defaults.from;
    const to = bounds?.to ?? cashbookDate(sp.get("to")) ?? todayInput();
    const groupBy = sp.get("group_by") === "month" ? "month" : "day";
    const group = sp.get("group");

    if (from > to) return json({ error: "invalid", message: "Khoảng ngày không hợp lệ." }, 400);

    if (!month) {
      const span = daysBetween(from, to);
      if (span == null || span > MAX_SUMMARY_DAYS) {
        return json(
          {
            error: "invalid",
            message: `Khoảng tổng hợp tối đa ${MAX_SUMMARY_DAYS} ngày. Hãy thu hẹp từ ngày / đến ngày.`,
          },
          400,
        );
      }
    }

    const map = new Map<string, SummaryRow>();
    let offset = 0;

    for (;;) {
      let q = getSupabase()
        .from("cashbook_entries")
        .select("entry_date,expense_month,amount,group_code")
        .order("entry_date", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (month) {
        q = q.eq("expense_month", month);
      } else {
        q = q.gte("entry_date", from).lte("entry_date", to);
      }

      q = applyCashbookGroupFilter(q, group);

      const { data, error } = await q;
      if (error) {
        if (isCashbookSchemaError(error.message)) {
          return json({ error: "missing_migration", message: CASHBOOK_MIGRATION_MESSAGE }, 400);
        }
        throw error;
      }

      const batch = data ?? [];
      for (const row of batch) {
        const date = String(row.entry_date);
        const expenseMonth = String(row.expense_month ?? date.slice(0, 7));
        const period = groupBy === "month" ? expenseMonth : date;
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
    const totals = emptyRow("");
    for (const row of rows) {
      totals.total += row.total;
      totals.weekly_wage += row.weekly_wage;
      totals.office += row.office;
      totals.count += row.count;
    }

    return json({
      from,
      to,
      month: month || null,
      group_by: groupBy,
      group: group || null,
      rows,
      totals,
    });
  } catch (e) {
    return apiError(e);
  }
}
