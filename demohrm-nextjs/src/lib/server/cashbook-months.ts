import "server-only";

import {
  currentMonthCode,
  monthBounds,
  monthCodeFromDate,
  nextMonthCode,
  parseMonthCode,
} from "@/lib/advance-months";
import { getSupabase } from "@/lib/server/db";

export {
  currentMonthCode,
  monthBounds,
  monthCodeFromDate,
  nextMonthCode,
  parseMonthCode,
};

export async function isCashbookMonthClosed(monthCode: string): Promise<boolean> {
  const month = parseMonthCode(monthCode);
  if (!month) return false;
  const { data, error } = await getSupabase()
    .from("cashbook_month_closes")
    .select("month_code")
    .eq("month_code", month)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
