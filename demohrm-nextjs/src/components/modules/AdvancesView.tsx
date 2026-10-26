"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { currentMonthCode, monthBounds, monthCodeFromDate, nextMonthCode } from "@/lib/advance-months";
import { monthRangeInput } from "@/lib/cashbook";
import {
  approveLiveAdvance,
  cancelLiveAdvance,
  closeLiveAdvanceMonth,
  deleteLiveAdvanceMonthClose,
  downloadLiveAdvancesExcel,
  fetchLiveAdvanceMonths,
  fetchLiveAdvances,
  fetchLiveWorkers,
  payLiveAdvance,
  reopenLiveAdvanceMonth,
  settleLiveAdvance,
} from "@/lib/live";
import type { AdvanceMonthRow, LiveAdvance, LiveWorkerRow } from "@/lib/live";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { formatVND } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { AdvanceModal } from "@/components/advances/AdvanceModal";
import { AdvanceMonthPreviewModal } from "@/components/advances/AdvanceMonthPreviewModal";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";
import { RowActions } from "@/components/ui/row-actions";
import type { RowActionItem } from "@/components/ui/row-actions";
import { Button } from "@/components/ui/button";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

type Tab = "entries" | "months";

const STATUS_LABEL: Record<string, string> = {
  requested: "Chờ duyệt",
  approved: "Đã duyệt",
  paid: "Đã chi",
  settled: "Đã quyết toán",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

const STATUS_TONE: Record<string, "warning" | "info" | "success" | "neutral" | "danger"> = {
  requested: "warning",
  approved: "info",
  paid: "success",
  settled: "success",
  rejected: "danger",
  cancelled: "neutral",
};

function formatAdvanceDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDayTime(row: LiveAdvance): string {
  return `${formatAdvanceDate(row.advance_date)} ${(row.advance_time || "").slice(0, 5) || "—"}`;
}

function formatMonthLabel(monthCode: string): string {
  const [year, month] = monthCode.split("-");
  if (!year || !month) return monthCode;
  return `${month}/${year}`;
}

function formatClosedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour12: false });
}

export function AdvancesView() {
  const { staff } = useApp();
  const { staff: currentStaff, access } = useSession();
  const canDelete = access.canDelete;
  const canClose = access.canClosePeriod;
  const [tab, setTab] = useState<Tab>("entries");
  /** Bộ lọc tab Kết thúc tháng — trống khi vào màn hình, chỉ fill khi đã chọn tháng (YYYY-MM). */
  const [monthsFilter, setMonthsFilter] = useState("");
  const [monthRows, setMonthRows] = useState<AdvanceMonthRow[]>([]);
  const [closedMonths, setClosedMonths] = useState<Set<string>>(new Set());
  const [range, setRange] = useState(monthRangeInput);
  const [status, setStatus] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LiveAdvance[]>([]);
  const [workers, setWorkers] = useState<LiveWorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthsLoading, setMonthsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [closingMonth, setClosingMonth] = useState<string | null>(null);
  const [reopeningMonth, setReopeningMonth] = useState<string | null>(null);
  const [deletingCloseMonth, setDeletingCloseMonth] = useState<string | null>(null);
  const [previewMonth, setPreviewMonth] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LiveAdvance | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const isRowMonthClosed = (advanceDate: string | null | undefined) => {
    const code = advanceDate ? monthCodeFromDate(advanceDate) : null;
    return Boolean(code && closedMonths.has(code));
  };

  useEffect(() => {
    let alive = true;
    fetchLiveWorkers({ limit: 500 })
      .then((page) => {
        if (alive) setWorkers(page.rows);
      })
      .catch(() => {
        if (alive) setWorkers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setMonthsLoading(true);
    fetchLiveAdvanceMonths()
      .then((data) => {
        if (!alive) return;
        const list = data.months ?? [];
        setMonthRows(list);
        setClosedMonths(new Set(list.filter((row) => row.status === "closed").map((row) => row.month_code)));
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const message = e instanceof ApiError ? e.message : "";
        if (/advance_month_closes|missing_table|does not exist|schema cache/i.test(message)) {
          setError("Chưa chạy migration chốt tháng. Hãy chạy supabase/advance_month_closes.sql.");
        }
      })
      .finally(() => {
        if (alive) setMonthsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    if (!range.from || !range.to) return;
    setLoading(true);
    fetchLiveAdvances({
      from: range.from,
      to: range.to,
      status: status || undefined,
      subjectType: subjectType === "staff" || subjectType === "worker" ? subjectType : undefined,
      q: query || undefined,
      limit: 500,
    })
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const message = e instanceof ApiError ? e.message : "Không tải được danh sách tạm ứng.";
        setError(
          /advances|subject_type|does not exist|schema cache/i.test(message)
            ? "Chưa chạy migration tạm ứng. Hãy chạy supabase/cashbook_entries.sql, supabase/advances.sql và supabase/fn_pay_advance.sql."
            : message,
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [range.from, range.to, status, subjectType, query, reloadKey]);

  const reload = () => setReloadKey((value) => value + 1);

  const totals = useMemo(() => {
    const sum = (state: string) =>
      rows.filter((row) => row.status === state).reduce((total, row) => total + Number(row.amount || 0), 0);
    return {
      requested: sum("requested"),
      approved: sum("approved"),
      paid: sum("paid"),
      settled: sum("settled"),
    };
  }, [rows]);

  const filteredMonthRows = useMemo(() => {
    if (!monthsFilter) return [] as AdvanceMonthRow[];
    const found = monthRows.find((row) => row.month_code === monthsFilter);
    if (found) return [found];
    return [
      {
        month_code: monthsFilter,
        status: closedMonths.has(monthsFilter) ? ("closed" as const) : ("open" as const),
        closed_at: null,
        closed_by: null,
        note: null,
        advance_count: 0,
        total_amount: 0,
        open_count: 0,
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

  const act = async (row: LiveAdvance, action: "approve" | "reject" | "pay" | "settle" | "cancel") => {
    const rowMonth = monthCodeFromDate(row.advance_date) ?? "";
    if (isRowMonthClosed(row.advance_date)) {
      setError(`Tháng ${rowMonth} đã đóng. Chỉ được xem.`);
      return;
    }
    const deletingSettled = action === "cancel" && row.status === "settled";
    const confirmText =
      action === "approve"
        ? `Duyệt phiếu ${row.code}?`
        : action === "reject"
          ? `Từ chối phiếu ${row.code}?`
          : action === "pay"
            ? `Chi tiền phiếu ${row.code} (${formatVND(Number(row.amount) || 0)})? Khoản chi sẽ tự ghi vào sổ chi.`
            : action === "settle"
              ? `Quyết toán phiếu ${row.code}?`
              : deletingSettled
                ? `Xóa phiếu đã quyết toán ${row.code}? Thao tác chỉ dành cho Ban giám đốc / Kỹ thuật.`
                : `Hủy phiếu ${row.code}?`;
    if (!window.confirm(confirmText)) return;

    setBusyId(row.id);
    setError("");
    try {
      if (action === "approve") await approveLiveAdvance(row.id, "approved");
      else if (action === "reject") await approveLiveAdvance(row.id, "rejected");
      else if (action === "pay") await payLiveAdvance(row.id);
      else if (action === "settle") await settleLiveAdvance(row.id);
      else await cancelLiveAdvance(row.id);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Thao tác thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportExcelRange = async () => {
    if (!range.from || !range.to) {
      setError("Chọn khoảng ngày trước khi xuất Excel.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const { blob, filename } = await downloadLiveAdvancesExcel({
        from: range.from,
        to: range.to,
        status: status || undefined,
        subjectType: subjectType === "staff" || subjectType === "worker" ? subjectType : "",
        q: query || undefined,
      });
      downloadBlob(blob, filename || `tam-ung_${range.from}_${range.to}.xlsx`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  };

  const exportExcelForMonth = async (monthCode: string) => {
    if (!monthCode) {
      setError("Chọn tháng trước khi xuất Excel.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const { blob, filename } = await downloadLiveAdvancesExcel({ month: monthCode });
      downloadBlob(blob, filename || `tam-ung_${monthCode}.xlsx`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  };

  const closeMonth = async (monthCode: string) => {
    if (!canClose || closedMonths.has(monthCode)) return;
    if (
      !window.confirm(
        `Kết thúc tháng ${monthCode}?\n\nSau khi đóng, tháng này chỉ xem. Không thêm / sửa / xóa phiếu thuộc tháng đã đóng.`,
      )
    ) {
      return;
    }
    setClosingMonth(monthCode);
    setError("");
    try {
      const result = await closeLiveAdvanceMonth(monthCode);
      const next = result.next_month || nextMonthCode(monthCode);
      if (next) {
        const bounds = monthBounds(next);
        if (bounds) setRange(bounds);
      }
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Kết thúc tháng thất bại.");
    } finally {
      setClosingMonth(null);
    }
  };

  const reopenMonth = async (monthCode: string) => {
    if (!canClose || !closedMonths.has(monthCode)) return;
    if (!window.confirm(`Mở lại tháng ${monthCode}?\n\nSau khi mở, có thể thêm / sửa / xóa phiếu trong tháng này.`)) {
      return;
    }
    setReopeningMonth(monthCode);
    setError("");
    try {
      await reopenLiveAdvanceMonth(monthCode);
      reload();
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
        `Xóa kết thúc tháng ${monthCode}?\n\nBản ghi chốt tháng sẽ bị xóa và tháng này mở lại (thêm / sửa / xóa được).`,
      )
    ) {
      return;
    }
    setDeletingCloseMonth(monthCode);
    setError("");
    try {
      await deleteLiveAdvanceMonthClose(monthCode);
      reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Xóa kết thúc tháng thất bại.");
    } finally {
      setDeletingCloseMonth(null);
    }
  };

  const openMonthPreview = (monthCode: string) => {
    setPreviewMonth(monthCode);
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Tạm ứng"
        sub="Quản lý tạm ứng cho người lao động và nhân viên"
        actions={
          tab === "entries" ? (
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
                + Tạo phiếu tạm ứng
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              disabled={exporting || !monthsFilter}
              onClick={() => void exportExcelForMonth(monthsFilter)}
            >
              {exporting ? "Đang xuất..." : monthsFilter ? `Xuất Excel ${monthsFilter}` : "Xuất Excel"}
            </Button>
          )
        }
      />
      <QueryState
        loading={tab === "entries" ? loading && rows.length === 0 : false}
        error={error && tab === "entries" && rows.length === 0 ? error : ""}
      >
        <div className="page-body">
          <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab("entries")}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition ${tab === "entries" ? "bg-[#0052cc] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              Phiếu tạm ứng
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
                    <MonthYearPicker
                      value={monthsFilter}
                      onChange={setMonthsFilter}
                      placeholder="mm/yyyy"
                    />
                  </div>
                  {monthsFilter ? (
                    <Button variant="outline" onClick={() => setMonthsFilter("")}>
                      Xóa lọc
                    </Button>
                  ) : null}
                  {monthsLoading ? (
                    <span className="pb-2 text-[12.5px] text-slate-400">Đang tải dữ liệu tháng...</span>
                  ) : null}
                </div>
                {!monthsFilter ? (
                  <p className="mt-2 text-[12.5px] text-slate-500">
                    Chọn tháng bằng picker (hiển thị mm/yyyy) để xem trạng thái mở / đóng.
                  </p>
                ) : null}
              </div>

              {monthsFilter ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <KpiCard title="THÁNG" value={<>{formatMonthLabel(monthsFilter)}</>} sub={`Tháng ${formatMonthLabel(monthsFilter)}`} />
                  <KpiCard title="ĐANG MỞ" value={<>{openMonthCount}</>} valueClassName="text-emerald-600" sub="Thêm / sửa / xóa được" />
                  <KpiCard title="ĐÃ ĐÓNG" value={<>{closedMonthCount}</>} valueClassName="text-slate-600" sub="Chỉ xem" />
                </div>
              ) : null}

              {error && monthsFilter ? (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
              ) : null}

              <div className="mt-4">
                <DataTable headers={["Tháng", "Trạng thái", "Số phiếu", "Tổng tiền", "Chưa xử lý xong", "Ngày đóng", "Thao tác"]}>
                  {filteredMonthRows.map((row) => {
                    const closing = closingMonth === row.month_code;
                    const reopening = reopeningMonth === row.month_code;
                    const deleting = deletingCloseMonth === row.month_code;
                    const busy = closing || reopening || deleting || exporting;
                    const actions: RowActionItem[] = [
                      { label: "Xem phiếu", onClick: () => openMonthPreview(row.month_code) },
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
                        <td className="whitespace-nowrap">{row.advance_count}</td>
                        <td className="whitespace-nowrap"><strong className="text-[#0052cc]">{formatVND(Number(row.total_amount) || 0)}</strong></td>
                        <td className="whitespace-nowrap">
                          {row.status === "open" ? (
                            row.open_count > 0 ? (
                              <span className="font-medium text-amber-600">{row.open_count}</span>
                            ) : (
                              "0"
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap text-[13px] text-slate-600">{formatClosedAt(row.closed_at)}</td>
                        <td className="whitespace-nowrap">
                          <RowActions items={actions} label={`Thao tác tháng ${row.month_code}`} />
                        </td>
                      </tr>
                    );
                  })}
                  {!monthsFilter ? (
                    <EmptyRow colSpan={7} text="Chọn tháng ở bộ lọc để hiển thị danh sách" />
                  ) : filteredMonthRows.length === 0 ? (
                    <EmptyRow colSpan={7} text="Không có dữ liệu tháng này" />
                  ) : null}
                </DataTable>
              </div>
              {monthsFilter ? (
                <p className="mt-2 text-[12px] text-slate-500">
                  Tháng mở: thêm / sửa / xóa phiếu. Tháng đóng: chỉ xem — có thể mở lại hoặc xóa kết thúc tháng.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <KpiCard title="CHỜ DUYỆT" value={formatVND(totals.requested)} valueClassName="text-amber-600" sub={`${rows.filter((row) => row.status === "requested").length} phiếu`} />
                <KpiCard title="ĐÃ DUYỆT" value={formatVND(totals.approved)} valueClassName="text-sky-600" sub={`${rows.filter((row) => row.status === "approved").length} phiếu`} />
                <KpiCard title="ĐÃ CHI" value={formatVND(totals.paid)} valueClassName="text-emerald-600" sub={`${rows.filter((row) => row.status === "paid").length} phiếu`} />
                <KpiCard title="ĐÃ QUYẾT TOÁN" value={formatVND(totals.settled)} valueClassName="text-slate-700" sub={`${rows.filter((row) => row.status === "settled").length} phiếu`} />
              </div>

              <div className="mt-4 rounded-xl border bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Từ ngày</span>
                    <input
                      type="date"
                      value={range.from}
                      onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Đến ngày</span>
                    <input
                      type="date"
                      value={range.to}
                      onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Trạng thái</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                    >
                      <option value="">Tất cả</option>
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Đối tượng</span>
                    <select
                      value={subjectType}
                      onChange={(e) => setSubjectType(e.target.value)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                    >
                      <option value="">Tất cả</option>
                      <option value="worker">Người lao động</option>
                      <option value="staff">Nhân viên</option>
                    </select>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Tìm kiếm</span>
                    <div className="flex gap-1">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setQuery(search.trim());
                        }}
                        placeholder="Mã phiếu, tên, lý do..."
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                      />
                      <Button variant="outline" onClick={() => setQuery(search.trim())}>Tìm</Button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[12.5px] text-slate-500">
                  Phiếu thuộc tháng đã đóng chỉ xem. Thêm / sửa / xóa chỉ áp dụng cho tháng đang mở.
                </p>
              </div>

              {error && rows.length > 0 && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
              )}

              <div className="mt-4">
                <DataTable headers={["Mã phiếu", "Ngày / giờ", "Người nhận", "Lý do", "Số tiền", "Trạng thái", "Người đưa tiền", "Bằng chứng", "Thao tác"]}>
                  {rows.map((row) => {
                    const personName = row.subject_type === "staff" ? row.staff_name : row.worker_name;
                    const personCode = row.subject_type === "staff" ? null : row.worker_code;
                    const busy = busyId === row.id;
                    const rowClosed = isRowMonthClosed(row.advance_date);
                    const actions: RowActionItem[] = [];
                    if (!rowClosed) {
                      if (row.status === "requested") {
                        actions.push(
                          { label: "Duyệt", tone: "success", disabled: busy, onClick: () => void act(row, "approve") },
                          { label: "Từ chối", tone: "danger", disabled: busy, onClick: () => void act(row, "reject") },
                          { label: "Sửa", disabled: busy, onClick: () => { setEditing(row); setModalOpen(true); } },
                        );
                      }
                      if (row.status === "approved") {
                        actions.push({ label: "Chi tiền", tone: "success", disabled: busy, onClick: () => void act(row, "pay") });
                      }
                      if (row.status === "paid") {
                        actions.push({ label: "Quyết toán", disabled: busy, onClick: () => void act(row, "settle") });
                      }
                      if (canDelete && (row.status === "requested" || row.status === "approved" || row.status === "settled")) {
                        actions.push({
                          label: row.status === "settled" ? "Xóa phiếu" : "Hủy phiếu",
                          tone: "danger",
                          disabled: busy,
                          onClick: () => void act(row, "cancel"),
                        });
                      }
                    }
                    return (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap"><code>{row.code}</code></td>
                        <td className="whitespace-nowrap">{formatDayTime(row)}</td>
                        <td>
                          <div className="font-semibold text-slate-800">{personName || "—"}</div>
                          <div className="text-[12px] text-slate-500">
                            {row.subject_type === "staff" ? "Nhân viên" : personCode || "Người lao động"}
                            {row.company_name ? ` · ${row.company_name}` : ""}
                          </div>
                        </td>
                        <td>
                          <div className="max-w-[220px] truncate text-slate-700">{row.reason || "—"}</div>
                          {row.note ? <div className="max-w-[220px] truncate text-[12px] text-slate-500">{row.note}</div> : null}
                        </td>
                        <td className="whitespace-nowrap"><strong className="text-[#0052cc]">{formatVND(Number(row.amount) || 0)}</strong></td>
                        <td><StatusPill tone={STATUS_TONE[row.status] ?? "neutral"}>{STATUS_LABEL[row.status] ?? row.status}</StatusPill></td>
                        <td>{row.giver_name || "—"}</td>
                        <td>
                          {row.evidence_url ? (
                            <a href={row.evidence_url} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-[#0052cc] hover:underline">
                              Xem ảnh
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {actions.length > 0 ? (
                            <RowActions items={actions} label="Thao tác phiếu tạm ứng" />
                          ) : (
                            <span className="text-[12px] text-slate-400">{rowClosed ? "Chỉ xem" : "—"}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <EmptyRow colSpan={9} text="Chưa có phiếu tạm ứng trong khoảng ngày này" />}
                </DataTable>
              </div>
              <p className="mt-2 text-[12px] text-slate-500">
                Đang hiển thị {rows.length} phiếu từ {range.from} đến {range.to}. Bộ lọc tối đa 500 phiếu gần nhất.
              </p>
            </>
          )}
        </div>
      </QueryState>

      <AdvanceModal
        key={`${editing?.id ?? "new"}-${modalOpen ? "open" : "closed"}`}
        open={modalOpen}
        advance={editing}
        workers={workers}
        staff={staff}
        currentStaffId={currentStaff?.id ?? null}
        closedMonths={closedMonths}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />

      <AdvanceMonthPreviewModal
        open={Boolean(previewMonth)}
        monthCode={previewMonth}
        monthClosed={previewMonth ? closedMonths.has(previewMonth) : false}
        onClose={() => setPreviewMonth(null)}
        onExport={(monthCode) => void exportExcelForMonth(monthCode)}
        exporting={exporting}
      />
    </section>
  );
}
