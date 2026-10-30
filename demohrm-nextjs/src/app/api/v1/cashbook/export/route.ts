export const runtime = "nodejs";

import { daysBetween, formatMonthLabel } from "@/lib/advance-months";
import { cashbookGroupDisplay } from "@/lib/cashbook";
import { getAuth, requireRole } from "@/lib/server/authctx";
import {
  applyCashbookCompanyFilter,
  applyCashbookGroupFilter,
  cashbookCompanyFilters,
  cashbookDate,
  cashbookMonth,
  cashbookSearchTerm,
} from "@/lib/server/cashbook";
import { CASHBOOK_MIGRATION_MESSAGE, isCashbookSchemaError } from "@/lib/server/cashbook-errors";
import { getSupabase } from "@/lib/server/db";
import {
  createExcelWorkbook,
  enableExcelAutoFilter,
  excelFileResponse,
  excelFormatDay,
  excelMoney,
  styleExcelDataRow,
  writeExcelHeaderRow,
  writeExcelTitle,
  writeExcelTotalRow,
} from "@/lib/server/excel";
import { apiError, json, searchParams } from "@/lib/server/http";
import { ROLE } from "@/lib/server/roles";

const MAX_ROWS = 20_000;
const MAX_DAYS = 400;

/** Chỉ cột cần cho Excel — giảm payload DB. */
const EXPORT_COLUMNS =
  "id,entry_date,expense_month,content,full_name,company_name,worker_id,staff_id,amount,note,group_code,group_name";

interface CashbookExportRow {
  id: number;
  entry_date: string;
  expense_month: string | null;
  content: string;
  full_name: string | null;
  company_name: string | null;
  worker_id: number | null;
  staff_id: number | null;
  amount: number | string;
  note: string | null;
  group_code: string;
  group_name: string | null;
}

const HEADERS = [
  "STT",
  "Tháng chi",
  "Ngày chi",
  "Nhóm",
  "Nội dung",
  "Đối tượng",
  "Người nhận",
  "Công ty",
  "Số tiền",
  "Ghi chú",
] as const;

const WIDTHS = [6, 12, 12, 18, 36, 12, 24, 20, 14, 28];

function monthLabel(expenseMonth: string | null | undefined, entryDate: string): string {
  const code = expenseMonth || entryDate.slice(0, 7);
  return formatMonthLabel(code);
}

function payeeType(row: CashbookExportRow): string {
  if (row.worker_id) return "Công nhân";
  if (row.staff_id) return "Nhân sự";
  return "";
}

export async function GET(req: Request): Promise<Response> {
  try {
    const auth = getAuth(req);
    requireRole(auth, ...ROLE.finance);
    const sp = searchParams(req);
    const month = cashbookMonth(sp.get("month"));
    const from = cashbookDate(sp.get("from"));
    const to = cashbookDate(sp.get("to"));

    if (!month && (!from || !to)) {
      return json({ error: "invalid", message: "Chọn tháng chi hoặc khoảng ngày trước khi xuất Excel." }, 400);
    }
    if (!month && from && to) {
      if (to < from) return json({ error: "invalid", message: "Đến ngày phải sau hoặc bằng từ ngày." }, 400);
      const span = daysBetween(from, to);
      if (span == null || span > MAX_DAYS) {
        return json({ error: "invalid", message: `Khoảng xuất tối đa ${MAX_DAYS} ngày.` }, 400);
      }
    }

    const search = cashbookSearchTerm(sp.get("q"));
    const companies = cashbookCompanyFilters(sp);
    let query = getSupabase()
      .from("cashbook_entries")
      .select(EXPORT_COLUMNS)
      .order("entry_date", { ascending: true })
      .order("id", { ascending: true })
      .limit(MAX_ROWS + 1);

    if (month) query = query.eq("expense_month", month);
    else query = query.gte("entry_date", from!).lte("entry_date", to!);

    query = applyCashbookGroupFilter(query, sp.get("group"));
    query = applyCashbookCompanyFilter(query, companies);
    if (search) {
      query = query.or(
        `content.ilike.%${search}%,full_name.ilike.%${search}%,company_name.ilike.%${search}%,note.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;
    if (error) {
      if (isCashbookSchemaError(error.message)) {
        return json({ error: "missing_migration", message: CASHBOOK_MIGRATION_MESSAGE }, 400);
      }
      throw error;
    }

    const rows = (data ?? []) as CashbookExportRow[];
    if (rows.length > MAX_ROWS) {
      return json({ error: "too_large", message: `Quá ${MAX_ROWS} dòng. Hãy thu hẹp bộ lọc.` }, 400);
    }

    const { workbook, sheet } = createExcelWorkbook("Sổ chi");
    const title = month
      ? `SỔ CHI THÁNG ${formatMonthLabel(month)}`
      : `SỔ CHI TỪ ${excelFormatDay(from)} ĐẾN ${excelFormatDay(to)}`;
    writeExcelTitle(
      sheet,
      title,
      `Xuất lúc ${new Date().toLocaleString("vi-VN", { hour12: false })} · ${rows.length} khoản chi`,
      HEADERS.length,
    );
    writeExcelHeaderRow(sheet, [...HEADERS], WIDTHS);

    let total = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      const amount = excelMoney(row.amount);
      total += amount;
      const excelRow = sheet.addRow([
        index + 1,
        monthLabel(row.expense_month, row.entry_date),
        excelFormatDay(row.entry_date),
        cashbookGroupDisplay(row.group_code, row.group_name),
        row.content,
        payeeType(row),
        row.full_name ?? "",
        row.company_name ?? "",
        amount,
        row.note ?? "",
      ]);
      styleExcelDataRow(excelRow, { moneyColumns: [9] });
    }

    enableExcelAutoFilter(sheet, rows.length, HEADERS.length);
    writeExcelTotalRow(sheet, {
      rowNumber: 4 + rows.length,
      label: `TỔNG CỘNG: ${rows.length} khoản chi`,
      labelMergeToCol: 8,
      amountCol: 9,
      amount: total,
      fillArgb: "FFFEF2F2",
      amountColorArgb: "FFDC2626",
    });

    const filename = month ? `so-chi_${month}.xlsx` : `so-chi_${from}_${to}.xlsx`;
    return excelFileResponse(workbook, filename);
  } catch (e) {
    return apiError(e);
  }
}
