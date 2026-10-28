import "server-only";

import { getSupabase } from "@/lib/server/db";
import {
  createExcelWorkbook,
  enableExcelAutoFilter,
  excelFileResponse,
  styleExcelDataRow,
  writeExcelHeaderRow,
  writeExcelTitle,
} from "@/lib/server/excel";

/** Giới hạn xuất Excel — tránh workbook / RAM quá lớn. */
export const WORKER_EXPORT_MAX_ROWS = 20_000;
export const WORKER_EXPORT_PAGE_SIZE = 500;

const EXPORT_HEADERS = ["STT", "Họ và tên", "CCCD", "Công ty", "Phụ trách"] as const;
const EXPORT_WIDTHS = [8, 28, 18, 24, 24];
const EXPORT_COLUMNS = "id,full_name,company";

export type WorkerListFilters = {
  status: string | null;
  company: string | null;
  type: string | null;
  q: string;
  recruiterId: number | null;
  managerId: number | null;
};

type PublicRow = {
  id: number;
  full_name: string;
  company: string | null;
};

type WorkerLean = {
  id: number;
  national_id: string | null;
  manager_id: number | null;
};

type FilterableQuery = {
  eq: (column: string, value: unknown) => FilterableQuery;
  or: (filters: string) => FilterableQuery;
  in: (column: string, values: readonly unknown[]) => FilterableQuery;
};

type ParsedValue = string | number;

type FilterFieldDef = {
  key: keyof WorkerListFilters;
  /** Parse từ query string; falsy → bỏ qua. */
  parse: (sp: URLSearchParams) => ParsedValue | null | "";
  /** Gắn vào PostgREST query khi có giá trị. */
  apply: (query: FilterableQuery, value: ParsedValue) => FilterableQuery;
  /** Dòng phụ đề Excel (optional). */
  subtitle?: (value: ParsedValue) => string;
};

export function safeWorkerSearch(raw: unknown): string {
  return String(raw ?? "").replace(/[%_,.()]/g, "").trim().slice(0, 80);
}

export function positiveIntParam(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Bộ filter khai báo một chỗ.
 * Thêm điều kiện mới: thêm 1 object vào mảng này (không sửa chuỗi if ở list/export).
 */
const WORKER_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "status",
    parse: (sp) => sp.get("status"),
    apply: (q, value) => q.eq("status", value),
    subtitle: (value) => `TT: ${value}`,
  },
  {
    key: "company",
    parse: (sp) => sp.get("company"),
    apply: (q, value) => q.eq("company", value),
    subtitle: (value) => `Công ty: ${value}`,
  },
  {
    key: "type",
    parse: (sp) => sp.get("type"),
    apply: (q, value) => q.eq("employment_type", value),
    subtitle: (value) => `Loại: ${value}`,
  },
  {
    key: "q",
    parse: (sp) => safeWorkerSearch(sp.get("q")),
    apply: (q, value) =>
      q.or(`full_name.ilike.%${value}%,code.ilike.%${value}%,phone.ilike.%${value}%`),
    subtitle: (value) => `Từ khóa: ${value}`,
  },
  {
    key: "recruiterId",
    parse: (sp) => positiveIntParam(sp.get("recruiter_id")),
    apply: (q, value) => q.eq("recruiter_id", value),
    subtitle: (value) => `Sale #${value}`,
  },
  {
    key: "managerId",
    parse: (sp) => positiveIntParam(sp.get("manager_id")),
    // manager_id không có trên view — resolve id ở prepare(), apply bằng .in("id", …).
    apply: (q) => q,
    subtitle: (value) => `Phụ trách #${value}`,
  },
];

function hasFilterValue(value: ParsedValue | null | "" | undefined): value is ParsedValue {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function isWorkerExportRequest(sp: URLSearchParams): boolean {
  const raw = (sp.get("export") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "xlsx" || raw === "excel";
}

/**
 * Builder filter dùng chung list JSON + Excel.
 * Thêm field → cập nhật WORKER_FILTER_FIELDS; list/export không đổi.
 */
export class WorkerListQueryBuilder {
  readonly filters: WorkerListFilters;
  private managerScopedIds: number[] | null = null;
  private emptyResult = false;
  private prepared = false;

  private constructor(filters: WorkerListFilters) {
    this.filters = filters;
  }

  static fromSearchParams(sp: URLSearchParams): WorkerListQueryBuilder {
    const filters = {
      status: null as string | null,
      company: null as string | null,
      type: null as string | null,
      q: "",
      recruiterId: null as number | null,
      managerId: null as number | null,
    };
    for (const field of WORKER_FILTER_FIELDS) {
      const parsed = field.parse(sp);
      if (!hasFilterValue(parsed)) continue;
      if (field.key === "q") filters.q = String(parsed);
      else if (field.key === "recruiterId" || field.key === "managerId") {
        filters[field.key] = Number(parsed);
      } else {
        filters[field.key] = String(parsed);
      }
    }
    return new WorkerListQueryBuilder(filters);
  }

  /** Resolve scope bất đồng bộ (vd. manager_id → danh sách worker id). Idempotent. */
  async prepare(): Promise<this> {
    if (this.prepared) return this;
    if (this.filters.managerId) {
      const matched = await getSupabase()
        .from("workers")
        .select("id")
        .eq("manager_id", this.filters.managerId);
      if (matched.error) throw matched.error;
      this.managerScopedIds = (matched.data ?? [])
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (this.managerScopedIds.length === 0) this.emptyResult = true;
    }
    this.prepared = true;
    return this;
  }

  /** true khi filter manager không khớp ai → trả list/export rỗng. */
  get isEmpty(): boolean {
    return this.emptyResult;
  }

  apply<T extends FilterableQuery>(query: T): T {
    if (!this.prepared) {
      throw new Error("WorkerListQueryBuilder.prepare() must run before apply().");
    }
    let q: FilterableQuery = query;
    for (const field of WORKER_FILTER_FIELDS) {
      if (field.key === "managerId") continue;
      const value = this.filters[field.key];
      if (!hasFilterValue(value as ParsedValue | null | "")) continue;
      q = field.apply(q, value as ParsedValue);
    }
    if (this.managerScopedIds) {
      q = q.in("id", this.managerScopedIds);
    }
    return q as T;
  }

  subtitle(prefix = `Xuất ngày ${new Date().toLocaleDateString("vi-VN")}`): string {
    const parts = [prefix];
    for (const field of WORKER_FILTER_FIELDS) {
      const value = this.filters[field.key];
      if (!hasFilterValue(value as ParsedValue | null | "") || !field.subtitle) continue;
      parts.push(field.subtitle(value as ParsedValue));
    }
    return parts.join(" · ");
  }
}

/** @deprecated Dùng WorkerListQueryBuilder.fromSearchParams — giữ alias cho chỗ cũ. */
export function parseWorkerListFilters(sp: URLSearchParams): WorkerListFilters {
  return WorkerListQueryBuilder.fromSearchParams(sp).filters;
}

function maskCccd(value: string | null | undefined, canView: boolean): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (canView) return raw;
  return raw.length >= 6 ? `${raw.slice(0, 6)}******` : "******";
}

function todayStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

/** Xuất Excel theo builder filter — phân trang DB, batch join (không N+1). */
export async function buildWorkersExcelResponse(
  builder: WorkerListQueryBuilder,
  canViewCccd: boolean,
): Promise<Response> {
  await builder.prepare();
  if (builder.isEmpty) {
    return emptyWorkersWorkbook(builder.subtitle());
  }

  const { workbook, sheet } = createExcelWorkbook("Nguoi lao dong");
  writeExcelTitle(sheet, "DANH SÁCH NGƯỜI LAO ĐỘNG", builder.subtitle(), EXPORT_HEADERS.length);
  writeExcelHeaderRow(sheet, [...EXPORT_HEADERS], EXPORT_WIDTHS);
  sheet.views = [{ state: "frozen", ySplit: 3 }];

  let offset = 0;
  let stt = 0;
  let truncated = false;

  for (;;) {
    if (stt >= WORKER_EXPORT_MAX_ROWS) {
      truncated = true;
      break;
    }

    let q = getSupabase()
      .from("v_workers_public")
      .select(EXPORT_COLUMNS)
      .order("code")
      .range(offset, offset + WORKER_EXPORT_PAGE_SIZE - 1);
    q = builder.apply(q);

    const { data, error } = await q;
    if (error) throw error;

    const page = (data ?? []) as PublicRow[];
    if (page.length === 0) break;

    const ids = page.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);

    const leanRes = await getSupabase().from("workers").select("id,national_id,manager_id").in("id", ids);
    if (leanRes.error) throw leanRes.error;

    const leanById = new Map<number, WorkerLean>();
    const managerIds = new Set<number>();
    for (const row of (leanRes.data ?? []) as WorkerLean[]) {
      const id = Number(row.id);
      leanById.set(id, row);
      const mid = row.manager_id != null ? Number(row.manager_id) : 0;
      if (mid > 0) managerIds.add(mid);
    }

    const managerNames = new Map<number, string>();
    if (managerIds.size > 0) {
      const staffRes = await getSupabase().from("staff").select("id,full_name").in("id", [...managerIds]);
      if (staffRes.error) throw staffRes.error;
      for (const person of staffRes.data ?? []) {
        managerNames.set(Number(person.id), String(person.full_name ?? ""));
      }
    }

    const room = WORKER_EXPORT_MAX_ROWS - stt;
    const slice = page.length > room ? page.slice(0, room) : page;
    if (page.length > room) truncated = true;

    for (const row of slice) {
      stt += 1;
      const lean = leanById.get(Number(row.id));
      const mid = lean?.manager_id != null ? Number(lean.manager_id) : 0;
      const excelRow = sheet.addRow([
        stt,
        String(row.full_name ?? ""),
        maskCccd(lean?.national_id, canViewCccd),
        String(row.company ?? ""),
        mid > 0 ? managerNames.get(mid) ?? "" : "",
      ]);
      styleExcelDataRow(excelRow);
    }

    if (page.length < WORKER_EXPORT_PAGE_SIZE || truncated) break;
    offset += WORKER_EXPORT_PAGE_SIZE;
  }

  enableExcelAutoFilter(sheet, stt, EXPORT_HEADERS.length);

  if (truncated) {
    sheet.addRow([]);
    const warn = sheet.addRow([`Đã cắt ở ${WORKER_EXPORT_MAX_ROWS} dòng. Thu hẹp bộ lọc để xuất đủ.`]);
    warn.getCell(1).font = { italic: true, color: { argb: "FFB45309" } };
  }

  return excelFileResponse(workbook, `nguoi-lao-dong_${todayStamp()}.xlsx`);
}

async function emptyWorkersWorkbook(subtitle: string): Promise<Response> {
  const { workbook, sheet } = createExcelWorkbook("Nguoi lao dong");
  writeExcelTitle(sheet, "DANH SÁCH NGƯỜI LAO ĐỘNG", subtitle, EXPORT_HEADERS.length);
  writeExcelHeaderRow(sheet, [...EXPORT_HEADERS], EXPORT_WIDTHS);
  return excelFileResponse(workbook, `nguoi-lao-dong_${todayStamp()}.xlsx`);
}
