"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { currentMonthCode, formatClosedAt, formatMonthLabel } from "@/lib/advance-months";
import {
  closeLiveCashbookMonth,
  createLiveCashbookEntry,
  deleteLiveCashbookEntry,
  deleteLiveCashbookMonthClose,
  downloadLiveCashbookExcel,
  fetchCashbookSummary,
  fetchLiveCashbook,
  fetchLiveCashbookMonths,
  reopenLiveCashbookMonth,
  updateLiveCashbookEntry,
} from "@/lib/live";
import type { CashbookMonthRow, CashbookSummary, LiveCashbookEntry } from "@/lib/live";
import {
  CASHBOOK_GROUPS,
  cashbookGroupDisplay,
  cashbookGroupTone,
  formatCashbookDate,
  monthRangeInput,
  todayInput,
  weekRangeInput,
} from "@/lib/cashbook";
import { downloadBlob } from "@/lib/download";
import { formatVND } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { CashbookEntryModal } from "@/components/finance/CashbookEntryModal";
import type { CashbookForm } from "@/components/finance/CashbookEntryModal";
import { CashbookMonthPreviewModal } from "@/components/finance/CashbookMonthPreviewModal";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";
import { RowActions } from "@/components/ui/row-actions";
import type { RowActionItem } from "@/components/ui/row-actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

type Tab = "entries" | "summary" | "months";
type GroupBy = "day" | "month";

const LIMIT = 50;
const MIGRATION_HINT = "Chưa chạy migration sổ chi. Hãy chạy supabase/cashbook_expense_month.sql.";

function mapCashbookError(e: unknown, fallback: string): string {
  const message = e instanceof ApiError ? e.message : fallback;
  if (/expense_month|missing_migration|cashbook_month|fn_cashbook_month_stats/i.test(message)) return MIGRATION_HINT;
  if (/cashbook|relation|schema cache|does not exist/i.test(message)) {
    return "Chưa cập nhật sổ chi trên Supabase. Hãy chạy supabase/cashbook_entries.sql và supabase/cashbook_expense_month.sql.";
  }
  return message;
}

export function FinanceView() {
  const { companies } = useApp();
  const { access } = useSession();
  const canDelete = access.canDelete;
  const canClose = access.canClosePeriod;
  const companyNames = useMemo(
    () => [...new Set(companies.map((company) => company.short_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [companies],
  );

  const [tab, setTab] = useState<Tab>("entries");
  const [range, setRange] = useState(monthRangeInput());
  const [monthsFilter, setMonthsFilter] = useState("");
  const [group, setGroup] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<LiveCashbookEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<CashbookSummary | null>(null);
  const [monthRows, setMonthRows] = useState<CashbookMonthRow[]>([]);
  const [closedMonths, setClosedMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [monthsLoading, setMonthsLoading] = useState(false);
  const [error, setError] = useState("");
  const [listReloadKey, setListReloadKey] = useState(0);
  const [monthsReloadKey, setMonthsReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LiveCashbookEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LiveCashbookEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [previewMonth, setPreviewMonth] = useState<string | null>(null);
  const [closingMonth, setClosingMonth] = useState<string | null>(null);
  const [reopeningMonth, setReopeningMonth] = useState<string | null>(null);
  const [deletingCloseMonth, setDeletingCloseMonth] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Sổ chi + KPI/tổng hợp: chỉ khi đang ở tab entries/summary.
  useEffect(() => {
    if (tab === "months") return;
    let alive = true;
    setLoading(true);
    const listPromise = fetchLiveCashbook({
      from: range.from,
      to: range.to,
      group: group || undefined,
      companies: companyFilter.length > 0 ? companyFilter : undefined,
      q: query || undefined,
      limit: LIMIT,
      offset,
    });
    const summaryPromise = fetchCashbookSummary({
      from: range.from,
      to: range.to,
      groupBy: tab === "summary" ? groupBy : "day",
      group: group || undefined,
      companies: companyFilter.length > 0 ? companyFilter : undefined,
    });
    Promise.all([listPromise, summaryPromise])
      .then(([page, sum]) => {
        if (!alive) return;
        setRows(page.rows);
        setTotal(page.total);
        setSummary(sum);
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(mapCashbookError(e, "Không tải được sổ chi."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, range.from, range.to, group, companyFilter, query, groupBy, offset, listReloadKey]);

  // Kết thúc tháng: chỉ fetch khi mở tab (tránh RPC stats mỗi lần đổi filter ngày).
  useEffect(() => {
    if (tab !== "months") return;
    let alive = true;
    setMonthsLoading(true);
    fetchLiveCashbookMonths()
      .then((data) => {
        if (!alive) return;
        const list = data.months ?? [];
        setMonthRows(list);
        setClosedMonths(new Set(list.filter((row) => row.status === "closed").map((row) => row.month_code)));
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(mapCashbookError(e, "Không tải được dữ liệu tháng."));
      })
      .finally(() => {
        if (alive) setMonthsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tab, monthsReloadKey]);

  const reloadList = () => setListReloadKey((value) => value + 1);
  const reloadMonths = () => setMonthsReloadKey((value) => value + 1);

  const applyPreset = (preset: "today" | "week" | "month") => {
    setOffset(0);
    setRange(preset === "today" ? { from: todayInput(), to: todayInput() } : preset === "week" ? weekRangeInput() : monthRangeInput());
  };

  const runCashbookExport = async (
    filter: { month?: string; from?: string; to?: string },
    fallbackName: string,
  ) => {
    setExporting(true);
    setError("");
    try {
      const { blob, filename } = await downloadLiveCashbookExcel({
        ...filter,
        group: filter.month ? undefined : group || undefined,
        companies: filter.month ? undefined : companyFilter.length > 0 ? companyFilter : undefined,
        q: filter.month ? undefined : query || undefined,
      });
      downloadBlob(blob, filename || fallbackName);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  };

  const exportExcelRange = async () => {
    if (!range.from || !range.to) {
      setError("Chọn từ ngày / đến ngày trước khi xuất Excel.");
      return;
    }
    await runCashbookExport(
      { from: range.from, to: range.to },
      `so-chi_${range.from}_${range.to}.xlsx`,
    );
  };

  const exportExcelForMonth = async (monthCode: string) => {
    if (!monthCode) {
      setError("Chọn tháng trước khi xuất Excel.");
      return;
    }
    await runCashbookExport({ month: monthCode }, `so-chi_${monthCode}.xlsx`);
  };

  const filteredMonthRows = useMemo(() => {
    if (!monthsFilter) return [] as CashbookMonthRow[];
    const found = monthRows.find((row) => row.month_code === monthsFilter);
    if (found) return [found];
    return [
      {
        month_code: monthsFilter,
        status: closedMonths.has(monthsFilter) ? ("closed" as const) : ("open" as const),
        closed_at: null,
        closed_by: null,
        note: null,
        entry_count: 0,
        total_amount: 0,
        weekly_wage: 0,
        office: 0,
        is_current: monthsFilter === currentMonthCode(),
      },
    ];
  }, [monthsFilter, monthRows, closedMonths]);

  const openMonthCount = useMemo(
    () => filteredMonthRows.filter((row) => row.status === "open").length,
    [filteredMonthRows],
  );
  const closedMonthCount = useMemo(
    () => filteredMonthRows.filter((row) => row.status === "closed").length,
    [filteredMonthRows],
  );

  const saveEntry = async (form: CashbookForm) => {
    const body = {
      entry_date: form.entry_date,
      expense_month: form.expense_month,
      content: form.content.trim(),
      company_name: form.company_name.trim() || null,
      amount: Number(form.amount),
      note: form.note.trim() || null,
      group_code: form.group_code,
      worker_id: form.worker_id,
      staff_id: null as number | null,
      full_name: null as string | null,
    };
    if (editing) {
      await updateLiveCashbookEntry(editing.id, body);
    } else {
      await createLiveCashbookEntry(body);
    }
    reloadList();
    if (tab === "months") reloadMonths();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteLiveCashbookEntry(deleteTarget.id);
      setDeleteTarget(null);
      reloadList();
      if (tab === "months") reloadMonths();
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Xóa khoản chi thất bại.");
    } finally {
      setDeleting(false);
    }
  };

  const closeMonth = async (monthCode: string) => {
    if (!canClose || closedMonths.has(monthCode)) return;
    if (
      !window.confirm(
        `Kết thúc tháng ${formatMonthLabel(monthCode)}?\n\nĐánh dấu tháng đã chốt để theo dõi. Vẫn có thể thêm / sửa / xóa phiếu chi nếu cần.`,
      )
    ) {
      return;
    }
    setClosingMonth(monthCode);
    setError("");
    try {
      await closeLiveCashbookMonth(monthCode);
      reloadMonths();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Kết thúc tháng thất bại.");
    } finally {
      setClosingMonth(null);
    }
  };

  const reopenMonth = async (monthCode: string) => {
    if (!canClose || !closedMonths.has(monthCode)) return;
    if (!window.confirm(`Mở lại tháng ${formatMonthLabel(monthCode)}?`)) return;
    setReopeningMonth(monthCode);
    setError("");
    try {
      await reopenLiveCashbookMonth(monthCode);
      reloadMonths();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Mở lại tháng thất bại.");
    } finally {
      setReopeningMonth(null);
    }
  };

  const deleteMonthClose = async (monthCode: string) => {
    if (!canClose || !closedMonths.has(monthCode)) return;
    if (
      !window.confirm(
        `Xóa kết thúc tháng ${formatMonthLabel(monthCode)}?\n\nBản ghi chốt tháng sẽ bị xóa và tháng này mở lại.`,
      )
    ) {
      return;
    }
    setDeletingCloseMonth(monthCode);
    setError("");
    try {
      await deleteLiveCashbookMonthClose(monthCode);
      reloadMonths();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Xóa kết thúc tháng thất bại.");
    } finally {
      setDeletingCloseMonth(null);
    }
  };

  const totals = summary?.totals;
  const maxPages = Math.max(1, Math.ceil(total / LIMIT));
  const page = Math.floor(offset / LIMIT) + 1;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Tài chính"
        sub="Sổ chi: lương tuần và chi văn phòng"
        actions={
          tab === "months" ? (
            <Button
              variant="outline"
              disabled={exporting || !monthsFilter}
              onClick={() => void exportExcelForMonth(monthsFilter)}
            >
              {exporting ? "Đang xuất..." : monthsFilter ? `Xuất Excel ${formatMonthLabel(monthsFilter)}` : "Xuất Excel"}
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={exporting} onClick={() => void exportExcelRange()}>
                {exporting ? "Đang xuất..." : "Xuất Excel"}
              </Button>
              <Button
                className="bg-[#0052cc] text-white hover:bg-[#0747a6]"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                + Thêm khoản chi
              </Button>
            </div>
          )
        }
      />
      <QueryState loading={loading && rows.length === 0 && !summary && tab !== "months"} error={error && rows.length === 0 && tab === "entries" ? error : ""}>
        <div className="page-body">
          <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab("entries")}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition ${tab === "entries" ? "bg-[#0052cc] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Sổ chi
            </button>
            <button
              type="button"
              onClick={() => setTab("summary")}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition ${tab === "summary" ? "bg-[#0052cc] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Tổng hợp
            </button>
            <button
              type="button"
              onClick={() => setTab("months")}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition ${tab === "months" ? "bg-[#0052cc] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Kết thúc tháng
            </button>
          </div>

          {tab === "months" ? (
            <>
              <div className="mb-4 rounded-xl border bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Lọc theo tháng</span>
                    <MonthYearPicker value={monthsFilter} onChange={setMonthsFilter} placeholder="mm/yyyy" />
                  </div>
                  {monthsFilter ? (
                    <Button variant="outline" onClick={() => setMonthsFilter("")}>Xóa lọc</Button>
                  ) : null}
                  {monthsLoading ? (
                    <span className="pb-2 text-[12.5px] text-slate-400">Đang tải dữ liệu tháng...</span>
                  ) : null}
                </div>
                {!monthsFilter ? (
                  <p className="mt-2 text-[12.5px] text-slate-500">
                    Chọn tháng để xem trạng thái mở / đóng và thao tác kết thúc tháng.
                  </p>
                ) : null}
              </div>

              {monthsFilter ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <KpiCard title="THÁNG" value={<>{formatMonthLabel(monthsFilter)}</>} sub={`Tháng ${formatMonthLabel(monthsFilter)}`} />
                  <KpiCard title="ĐANG MỞ" value={<>{openMonthCount}</>} valueClassName="text-emerald-600" sub="Chưa chốt tháng" />
                  <KpiCard title="ĐÃ ĐÓNG" value={<>{closedMonthCount}</>} valueClassName="text-slate-600" sub="Đã chốt (vẫn sửa được)" />
                </div>
              ) : null}

              {error && monthsFilter ? (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
              ) : null}

              <div className="mt-4">
                <DataTable headers={["Tháng", "Trạng thái", "Số phiếu", "Lương tuần", "Văn phòng", "Tổng chi", "Ngày đóng", "Thao tác"]}>
                  {filteredMonthRows.map((row) => {
                    const closing = closingMonth === row.month_code;
                    const reopening = reopeningMonth === row.month_code;
                    const deleting = deletingCloseMonth === row.month_code;
                    const busy = closing || reopening || deleting || exporting;
                    const actions: RowActionItem[] = [
                      { label: "Xem phiếu", onClick: () => setPreviewMonth(row.month_code) },
                      {
                        label: exporting ? "Đang xuất..." : "Xuất Excel",
                        disabled: exporting,
                        onClick: () => void exportExcelForMonth(row.month_code),
                      },
                    ];
                    if (canClose && row.status === "open") {
                      actions.push({
                        label: closing ? "Đang chốt..." : "Kết thúc tháng",
                        tone: "danger",
                        disabled: busy,
                        onClick: () => void closeMonth(row.month_code),
                      });
                    }
                    if (canClose && row.status === "closed") {
                      actions.push({
                        label: reopening ? "Đang mở..." : "Mở lại tháng",
                        tone: "success",
                        disabled: busy,
                        onClick: () => void reopenMonth(row.month_code),
                      });
                      actions.push({
                        label: deleting ? "Đang xóa..." : "Xóa kết thúc tháng",
                        tone: "danger",
                        disabled: busy,
                        onClick: () => void deleteMonthClose(row.month_code),
                      });
                    }
                    return (
                      <tr key={row.month_code}>
                        <td className="whitespace-nowrap">
                          <div className="font-semibold text-slate-800">{formatMonthLabel(row.month_code)}</div>
                          <div className="text-[12px] text-slate-500">
                            {row.month_code}
                            {row.is_current ? " · Tháng hiện tại" : ""}
                          </div>
                        </td>
                        <td>
                          <StatusPill tone={row.status === "closed" ? "neutral" : "success"}>
                            {row.status === "closed" ? "Đóng" : "Mở"}
                          </StatusPill>
                        </td>
                        <td className="whitespace-nowrap">{row.entry_count}</td>
                        <td className="whitespace-nowrap">{formatVND(Number(row.weekly_wage) || 0)}</td>
                        <td className="whitespace-nowrap">{formatVND(Number(row.office) || 0)}</td>
                        <td className="whitespace-nowrap">
                          <strong className="text-rose-600">{formatVND(Number(row.total_amount) || 0)}</strong>
                        </td>
                        <td className="whitespace-nowrap text-[13px] text-slate-600">{formatClosedAt(row.closed_at)}</td>
                        <td className="whitespace-nowrap">
                          <RowActions items={actions} label={`Thao tác tháng ${row.month_code}`} />
                        </td>
                      </tr>
                    );
                  })}
                  {!monthsFilter ? (
                    <EmptyRow colSpan={8} text="Chọn tháng ở bộ lọc để hiển thị danh sách" />
                  ) : filteredMonthRows.length === 0 ? (
                    <EmptyRow colSpan={8} text="Không có dữ liệu tháng này" />
                  ) : null}
                </DataTable>
              </div>
              {monthsFilter ? (
                <p className="mt-2 text-[12px] text-slate-500">
                  Chốt tháng để theo dõi. Vẫn thêm / sửa / xóa phiếu theo cột Tháng chi khi cần.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard title="TỔNG CHI" value={formatVND(totals?.total ?? 0)} valueClassName="text-rose-600" sub={`${totals?.count ?? 0} khoản chi`} />
                <KpiCard title="LƯƠNG TUẦN" value={formatVND(totals?.weekly_wage ?? 0)} valueClassName="text-sky-600" sub="Chi lương tuần" />
                <KpiCard title="CHI VĂN PHÒNG" value={formatVND(totals?.office ?? 0)} valueClassName="text-amber-600" sub="Chi phí văn phòng" />
              </div>

              <div className="mt-4 rounded-xl border bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Từ ngày</span>
                    <input
                      type="date"
                      value={range.from}
                      onChange={(e) => {
                        setOffset(0);
                        setRange((prev) => ({ ...prev, from: e.target.value }));
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Đến ngày</span>
                    <input
                      type="date"
                      value={range.to}
                      onChange={(e) => {
                        setOffset(0);
                        setRange((prev) => ({ ...prev, to: e.target.value }));
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                    />
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => applyPreset("today")}>Hôm nay</Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset("week")}>Tuần này</Button>
                    <Button variant="outline" size="sm" onClick={() => applyPreset("month")}>Tháng này</Button>
                  </div>
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Nhóm chi</span>
                    <select
                      value={group}
                      onChange={(e) => {
                        setOffset(0);
                        setGroup(e.target.value);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                    >
                      <option value="">Tất cả</option>
                      {CASHBOOK_GROUPS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[200px]">
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Công ty</span>
                    <SearchableMultiSelect
                      values={companyFilter}
                      onChange={(next) => {
                        setOffset(0);
                        setCompanyFilter(next);
                      }}
                      options={companyNames}
                      placeholder="Tất cả công ty"
                      emptyLabel="Tất cả công ty"
                      className="min-h-[38px] px-3 py-2"
                    />
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Tìm kiếm</span>
                    <div className="flex gap-1">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setOffset(0);
                            setQuery(search.trim());
                          }
                        }}
                        placeholder="Nội dung, người nhận, công ty..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOffset(0);
                          setQuery(search.trim());
                        }}
                      >
                        Tìm
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {error && rows.length > 0 && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
              )}

              {tab === "entries" ? (
                <div className="mt-4">
                  <DataTable headers={["Tháng", "Ngày chi", "Nhóm", "Nội dung", "Người nhận", "Công ty", "Số tiền", "Ghi chú", "Thao tác"]}>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap font-medium text-slate-700">
                          {formatMonthLabel(row.expense_month || row.entry_date.slice(0, 7))}
                        </td>
                        <td className="whitespace-nowrap">{formatCashbookDate(row.entry_date)}</td>
                        <td>
                          <StatusPill tone={cashbookGroupTone(row.group_code)}>
                            {cashbookGroupDisplay(row.group_code, row.group_name)}
                          </StatusPill>
                        </td>
                        <td className="min-w-[220px]">{row.content}</td>
                        <td>{row.full_name || "—"}</td>
                        <td>{row.company_name || "—"}</td>
                        <td className="whitespace-nowrap">
                          <strong className="text-rose-600">{formatVND(Number(row.amount))}</strong>
                        </td>
                        <td className="max-w-[220px] truncate text-slate-500">{row.note || "—"}</td>
                        <td className="whitespace-nowrap">
                          <RowActions
                            label="Thao tác khoản chi"
                            items={[
                              {
                                label: "Sửa",
                                onClick: () => {
                                  setEditing(row);
                                  setModalOpen(true);
                                },
                              },
                              ...(canDelete
                                ? [
                                    {
                                      label: "Xóa",
                                      tone: "danger" as const,
                                      onClick: () => {
                                        setDeleteTarget(row);
                                        setDeleteError("");
                                      },
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && <EmptyRow colSpan={9} text="Chưa có khoản chi nào trong tháng này" />}
                  </DataTable>
                  <div className="mt-3 flex items-center justify-between text-[12.5px] text-slate-500">
                    <span>Tổng {total} khoản chi</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
                        Trước
                      </Button>
                      <span>
                        Trang {page}/{maxPages}
                      </span>
                      <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>
                        Sau
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-slate-700">
                      Tổng hợp chi theo {groupBy === "day" ? "ngày" : "tháng"}
                    </p>
                    <div className="flex gap-1">
                      <Button variant={groupBy === "day" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("day")}>
                        Theo ngày
                      </Button>
                      <Button variant={groupBy === "month" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("month")}>
                        Theo tháng
                      </Button>
                    </div>
                  </div>
                  <DataTable headers={["Kỳ", "Lương tuần", "Chi văn phòng", "Tổng chi", "Số khoản"]}>
                    {(summary?.rows ?? []).map((row) => (
                      <tr key={row.period}>
                        <td className="whitespace-nowrap font-semibold">
                          {groupBy === "day"
                            ? formatCashbookDate(row.period)
                            : row.period.split("-").reverse().join("/")}
                        </td>
                        <td className="whitespace-nowrap">{formatVND(row.weekly_wage)}</td>
                        <td className="whitespace-nowrap">{formatVND(row.office)}</td>
                        <td className="whitespace-nowrap">
                          <strong className="text-rose-600">{formatVND(row.total)}</strong>
                        </td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                    {(summary?.rows ?? []).length === 0 && <EmptyRow colSpan={5} text="Chưa có dữ liệu tổng hợp" />}
                    {summary && summary.rows.length > 0 && (
                      <tr className="bg-slate-50 font-semibold">
                        <td>TỔNG CỘNG</td>
                        <td className="whitespace-nowrap">{formatVND(summary.totals.weekly_wage)}</td>
                        <td className="whitespace-nowrap">{formatVND(summary.totals.office)}</td>
                        <td className="whitespace-nowrap text-rose-600">{formatVND(summary.totals.total)}</td>
                        <td>{summary.totals.count}</td>
                      </tr>
                    )}
                  </DataTable>
                </div>
              )}
            </>
          )}
        </div>
      </QueryState>

      <CashbookEntryModal
        open={modalOpen}
        entry={editing}
        companies={companyNames}
        defaultMonth={currentMonthCode()}
        onClose={() => setModalOpen(false)}
        onSave={saveEntry}
      />

      <CashbookMonthPreviewModal
        open={Boolean(previewMonth)}
        monthCode={previewMonth}
        monthClosed={previewMonth ? closedMonths.has(previewMonth) : false}
        onClose={() => setPreviewMonth(null)}
        onExport={(monthCode) => void exportExcelForMonth(monthCode)}
        exporting={exporting}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Xóa khoản chi"
        closeOnBackdrop={false}
        closeOnEscape={false}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Đang xóa..." : "Xóa"}
            </Button>
          </>
        }
      >
        {deleteError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{deleteError}</p>}
        <p className="text-[13.5px] text-slate-700">
          Xóa khoản chi <strong>{deleteTarget?.content}</strong> với số tiền{" "}
          <strong className="text-rose-600">{formatVND(Number(deleteTarget?.amount ?? 0))}</strong>?
        </p>
        <p className="mt-1 text-[12.5px] text-slate-500">Thao tác này không thể hoàn tác.</p>
      </Modal>
    </section>
  );
}
