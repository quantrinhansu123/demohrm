import "server-only";

import ExcelJS from "exceljs";

export const EXCEL_MONEY_FMT = "#,##0";
export const EXCEL_HEADER_FILL = "FF0052CC";
export const EXCEL_TITLE_COLOR = "FF0B4C8F";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFE2E8F0" } },
  left: { style: "thin", color: { argb: "FFE2E8F0" } },
  bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  right: { style: "thin", color: { argb: "FFE2E8F0" } },
};

const headerBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

export function excelMoney(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function excelFormatDay(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function createExcelWorkbook(sheetName: string): {
  workbook: ExcelJS.Workbook;
  sheet: ExcelJS.Worksheet;
} {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Trang Way HRM";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);
  return { workbook, sheet };
}

export function writeExcelTitle(
  sheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  columnCount: number,
): void {
  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: EXCEL_TITLE_COLOR } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, columnCount);
  const subCell = sheet.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { size: 11, color: { argb: "FF64748B" } };
}

export function writeExcelHeaderRow(
  sheet: ExcelJS.Worksheet,
  headers: string[],
  widths: number[],
  rowNumber = 3,
): void {
  const headerRow = sheet.getRow(rowNumber);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = headerBorder;
  });
  sheet.columns = widths.map((width) => ({ width }));
}

/** Style nhẹ cho dòng data — tránh eachCell trên mọi ô khi xuất hàng nghìn dòng. */
export function styleExcelDataRow(
  row: ExcelJS.Row,
  opts?: { moneyColumns?: number[]; height?: number },
): void {
  row.height = opts?.height ?? 20;
  for (const col of opts?.moneyColumns ?? []) {
    row.getCell(col).numFmt = EXCEL_MONEY_FMT;
  }
}

export function enableExcelAutoFilter(
  sheet: ExcelJS.Worksheet,
  rowCount: number,
  columnCount: number,
  headerRow = 3,
): void {
  if (rowCount <= 0) return;
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + rowCount, column: columnCount },
  };
}

export function writeExcelTotalRow(
  sheet: ExcelJS.Worksheet,
  opts: {
    rowNumber: number;
    label: string;
    labelMergeToCol: number;
    amountCol: number;
    amount: number;
    fillArgb?: string;
    amountColorArgb?: string;
  },
): void {
  sheet.mergeCells(opts.rowNumber, 1, opts.rowNumber, opts.labelMergeToCol);
  const labelCell = sheet.getCell(opts.rowNumber, 1);
  labelCell.value = opts.label;
  labelCell.font = { bold: true };
  labelCell.alignment = { horizontal: "right", vertical: "middle" };

  const amountCell = sheet.getCell(opts.rowNumber, opts.amountCol);
  amountCell.value = opts.amount;
  amountCell.numFmt = EXCEL_MONEY_FMT;
  amountCell.font = {
    bold: true,
    color: { argb: opts.amountColorArgb ?? EXCEL_HEADER_FILL },
  };
  amountCell.alignment = { horizontal: "right", vertical: "middle" };

  const fill = opts.fillArgb ?? "FFEFF6FF";
  sheet.getRow(opts.rowNumber).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.border = thinBorder;
  });
}

export async function excelFileResponse(
  workbook: ExcelJS.Workbook,
  filename: string,
): Promise<Response> {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
