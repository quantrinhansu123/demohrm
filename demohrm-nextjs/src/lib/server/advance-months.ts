import "server-only";

import {
  currentMonthCode,
  monthBounds,
  monthCodeFromDate,
  nextMonthCode,
  parseMonthCode,
} from "@/lib/advance-months";
import { getSupabase } from "@/lib/server/db";
import { json } from "@/lib/server/http";

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

/** Trả về Response lỗi nếu tháng đã chốt; null nếu còn mở. */
export async function assertAdvanceMonthOpen(advanceDate: string): Promise<Response | null> {
  const month = monthCodeFromDate(advanceDate);
  if (!month) {
    return json({ error: "invalid", message: "Ngày tạm ứng không hợp lệ." }, 400);
  }
  if (await isAdvanceMonthClosed(month)) {
    return json(
      {
        error: "month_closed",
        message: `Tháng ${month} đã kết thúc. Chỉ xem và xuất Excel.`,
      },
      400,
    );
  }
  return null;
}

export async function countOpenAdvancesInMonth(monthCode: string): Promise<number> {
  const bounds = monthBounds(monthCode);
  if (!bounds) return 0;
  const { count, error } = await getSupabase()
    .from("advances")
    .select("id", { count: "exact", head: true })
    .gte("advance_date", bounds.from)
    .lte("advance_date", bounds.to)
    .in("status", [...OPEN_STATUSES]);
  if (error) throw error;
  return count ?? 0;
}

export { OPEN_STATUSES };
