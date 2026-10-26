export const runtime = "nodejs";

import ExcelJS from "exceljs";

import { monthBounds, parseMonthCode } from "@/lib/server/advance-months";
import { getAuth } from "@/lib/server/authctx";
import { getSupabase } from "@/lib/server/db";
import { apiError, json, searchParams } from "@/lib/server/http";

const MAX_ROWS = 20_000;
const MAX_DAYS = 366;

const STATUS_LABEL: Record<string, string> = {
  requested: "Chờ duyệt",
  approved: "Đã duyệt",
  paid: "Đã chi",
  settled: "Đã quyết toán",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

interface AdvanceRow {
  id: number;
  code: string;
  subject_type: "worker" | "staff";
  worker_id: number | null;
  staff_id: number | null;
  amount: number | string;
  reason: string | null;
  status: string;
  advance_date: string;
  advance_time: string;
  requested_by: number | null;
  approved_by: number | null;
  paid_at: string | null;
  settled_at: string | null;
  settled_amount: number | string | null;
  note: string | null;
}

function advanceDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}

function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function formatDay(value: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour12: false });
}

function money(value: number | string | null): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request): Promise<Response> {
  try {
    getAuth(req);
    const sp = searchParams(req);
    const month = parseMonthCode(sp.get("month"));
    const monthRange = month ? monthBounds(month) : null;
    const from = monthRange?.from ?? advanceDate(sp.get("from"));
    const to = monthRange?.to ?? advanceDate(sp.get("to"));
    if (!from || !to) {
      return json({ error: "invalid", message: "Chọn tháng hoặc khoảng ngày trước khi xuất Excel." }, 400);
    }
    if (to < from) return json({ error: "invalid", message: "Đến ngày phải sau hoặc bằng từ ngày." }, 400);
    if (dayCount(from, to) > MAX_DAYS) {
      return json({ error: "invalid", message: "Khoảng xuất tối đa 366 ngày." }, 400);
    }

    const status = sp.get("status")?.trim() ?? "";
    const subjectType = sp.get("subject_type") ?? "";
    const search = sp.get("q")?.trim() ?? "";

    let query = getSupabase()
      .from("advances")
      .select(
        "id,code,subject_type,worker_id,staff_id,amount,reason,status,advance_date,advance_time,requested_by,approved_by,paid_at,settled_at,settled_amount,note",
      )
      .gte("advance_date", from)
      .lte("advance_date", to)
      .order("advance_date", { ascending: true })
      .order("advance_time", { ascending: true })
      .order("id", { ascending: true })
      .limit(MAX_ROWS + 1);

    if (status) query = query.eq("status", status);
    if (subjectType === "worker" || subjectType === "staff") query = query.eq("subject_type", subjectType);
    if (search) {
      const [workersRes, staffRes] = await Promise.all([
        getSupabase().from("workers").select("id").or(`full_name.ilike.%${search}%,code.ilike.%${search}%`).limit(1000),
        getSupabase().from("staff").select("id").or(`full_name.ilike.%${search}%,code.ilike.%${search}%`).limit(1000),
      ]);
      if (workersRes.error) throw workersRes.error;
      if (staffRes.error) throw staffRes.error;
      const workerIds = (workersRes.data ?? []).map((row) => Number((row as { id: unknown }).id)).filter((id) => id > 0);
      const staffIds = (staffRes.data ?? []).map((row) => Number((row as { id: unknown }).id)).filter((id) => id > 0);
      const parts = [
        `code.ilike.%${search}%`,
        `reason.ilike.%${search}%`,
        `note.ilike.%${search}%`,
        ...(workerIds.length > 0 ? [`worker_id.in.(${workerIds.join(",")})`] : []),
        ...(staffIds.length > 0 ? [`staff_id.in.(${staffIds.join(",")})`] : []),
      ];
      query = query.or(parts.join(","));
    }

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as unknown as AdvanceRow[];
    if (rows.length > MAX_ROWS) {
      return json({ error: "too_many", message: "Dữ liệu vượt 20.000 phiếu. Hãy thu hẹp khoảng ngày hoặc bộ lọc." }, 400);
    }

    const workerIds = [
      ...new Set(rows.map((row) => row.worker_id).filter((id): id is number => typeof id === "number" && id > 0)),
    ];
    const staffIds = [
      ...new Set(
        rows
          .flatMap((row) => [row.staff_id, row.requested_by, row.approved_by])
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    ];

    const [workersRes, staffRes] = await Promise.all([
      workerIds.length > 0
        ? getSupabase().from("workers").select("id,code,full_name,current_company_id").in("id", workerIds)
        : Promise.resolve({ data: [], error: null }),
      staffIds.length > 0
        ? getSupabase().from("staff").select("id,code,full_name").in("id", staffIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (workersRes.error) throw workersRes.error;
    if (staffRes.error) throw staffRes.error;

    const companyIds = [
      ...new Set(
        (workersRes.data ?? [])
          .map((row) => row.current_company_id as number | null)
          .filter((id): id is number => typeof id === "number" && id > 0),
      ),
    ];
    const companiesRes =
      companyIds.length > 0
        ? await getSupabase().from("companies").select("id,short_name").in("id", companyIds)
        : { data: [], error: null };
    if (companiesRes.error) throw companiesRes.error;

    const workerMap = new Map((workersRes.data ?? []).map((row) => [Number(row.id), row]));
    const staffMap = new Map((staffRes.data ?? []).map((row) => [Number(row.id), row]));
    const companyMap = new Map((companiesRes.data ?? []).map((row) => [Number(row.id), String(row.short_name ?? "")]));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HRM";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Tam ung", {
      views: [{ state: "frozen", ySplit: 3 }],
    });

    const lastColumn = 17;
    sheet.mergeCells(1, 1, 1, lastColumn);
    const title = sheet.getCell(1, 1);
    title.value = "DANH SÁCH TẠM ỨNG";
    title.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
    title.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 26;

    sheet.mergeCells(2, 1, 2, lastColumn);
    const subtitle = sheet.getCell(2, 1);
    subtitle.value = `Từ ${formatDay(from)} đến ${formatDay(to)}${status ? ` · Trạng thái: ${STATUS_LABEL[status] ?? status}` : ""}${search ? ` · Từ khóa: ${search}` : ""}`;
    subtitle.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    subtitle.alignment = { horizontal: "center", vertical: "middle" };

    const headers = [
      "STT",
      "Mã phiếu",
      "Ngày",
      "Giờ",
      "Đối tượng",
      "Mã người nhận",
      "Tên người nhận",
      "Công ty",
      "Lý do",
      "Số tiền",
      "Trạng thái",
      "Người đưa tiền",
      "Người duyệt",
      "Ngày chi",
      "Ngày quyết toán",
      "Số quyết toán",
      "Ghi chú",
    ];
    const headerRow = sheet.getRow(3);
    headerRow.values = headers;
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0052CC" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    sheet.columns = [
      { width: 6 },
      { width: 16 },
      { width: 11 },
      { width: 8 },
      { width: 14 },
      { width: 14 },
      { width: 26 },
      { width: 22 },
      { width: 34 },
      { width: 15 },
      { width: 14 },
      { width: 22 },
      { width: 22 },
      { width: 18 },
      { width: 18 },
      { width: 15 },
      { width: 30 },
    ];

    let total = 0;
    rows.forEach((row, index) => {
      const worker = row.worker_id ? workerMap.get(row.worker_id) : null;
      const staff = row.staff_id ? staffMap.get(row.staff_id) : null;
      const companyId = worker ? Number(worker.current_company_id) : 0;
      const amount = money(row.amount);
      total += amount;
      const excelRow = sheet.addRow([
        index + 1,
        row.code,
        formatDay(row.advance_date),
        (row.advance_time || "").slice(0, 5),
        row.subject_type === "staff" ? "Nhân viên" : "Người lao động",
        row.subject_type === "staff" ? String(staff?.code ?? "") : String(worker?.code ?? ""),
        row.subject_type === "staff" ? String(staff?.full_name ?? "") : String(worker?.full_name ?? ""),
        companyId ? companyMap.get(companyId) ?? "" : "",
        row.reason ?? "",
        amount,
        STATUS_LABEL[row.status] ?? row.status,
        row.requested_by ? String(staffMap.get(row.requested_by)?.full_name ?? "") : "",
        row.approved_by ? String(staffMap.get(row.approved_by)?.full_name ?? "") : "",
        formatDateTime(row.paid_at),
        formatDateTime(row.settled_at),
        row.settled_amount === null || row.settled_amount === undefined ? "" : money(row.settled_amount),
        row.note ?? "",
      ]);
      excelRow.height = 20;
      excelRow.getCell(10).numFmt = "#,##0";
      excelRow.getCell(16).numFmt = "#,##0";
      excelRow.eachCell((cell) => {
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    if (rows.length > 0) {
      sheet.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3 + rows.length, column: lastColumn },
      };
    }

    const totalRowNumber = 4 + rows.length;
    sheet.mergeCells(totalRowNumber, 1, totalRowNumber, 9);
    const totalLabel = sheet.getCell(totalRowNumber, 1);
    totalLabel.value = `TỔNG CỘNG: ${rows.length} phiếu`;
    totalLabel.font = { bold: true };
    totalLabel.alignment = { horizontal: "right", vertical: "middle" };
    const totalCell = sheet.getCell(totalRowNumber, 10);
    totalCell.value = total;
    totalCell.numFmt = "#,##0";
    totalCell.font = { bold: true, color: { argb: "FF0052CC" } };
    totalCell.alignment = { horizontal: "right", vertical: "middle" };
    sheet.getRow(totalRowNumber).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = month ? `tam-ung_${month}.xlsx` : `tam-ung_${from}_${to}.xlsx`;
    return new Response(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
