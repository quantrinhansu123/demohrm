import "server-only";

import {
  currentMonthCode,
  monthBounds,
  monthCodeFromDate,
  nextMonthCode,
  parseMonthCode,
} from "@/lib/advance-months";
import { getSupabase } from "@/lib/server/db";

const OPEN_STATUSES = ["requested", "approved", "paid"] as const;

export {
  currentMonthCode,
  monthBounds,
  monthCodeFromDate,
  nextMonthCode,
  parseMonthCode,
};

export async function isAdvanceMonthClosed(monthCode: string): Promise<boolean> {
  const month = parseMonthCode(monthCode);
  if (!month) return false;
  const { data, error } = await getSupabase()
    .from("advance_month_closes")
    .select("month_code")
    .eq("month_code", month)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function countOpenAdvancesInMonth(monthCode: string): Promise<number> {
  const month = parseMonthCode(monthCode);
  if (!month) return 0;
  const { count, error } = await getSupabase()
    .from("advances")
    .select("id", { count: "exact", head: true })
    .eq("advance_month", month)
    .in("status", [...OPEN_STATUSES]);
  if (error) throw error;
  return count ?? 0;
}

export { OPEN_STATUSES };
