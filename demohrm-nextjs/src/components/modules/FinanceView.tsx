"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import {
  createLiveCashbookEntry,
  deleteLiveCashbookEntry,
  fetchCashbookSummary,
  fetchLiveCashbook,
  updateLiveCashbookEntry,
} from "@/lib/live";
import type { CashbookSummary, LiveCashbookEntry } from "@/lib/live";
import {
  CASHBOOK_GROUPS,
  cashbookGroupDisplay,
  cashbookGroupTone,
  formatCashbookDate,
  isAdvanceCashbookEntry,
  monthRangeInput,
  todayInput,
  weekRangeInput,
} from "@/lib/cashbook";
import { formatVND } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { CashbookEntryModal } from "@/components/finance/CashbookEntryModal";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";
import { RowActions } from "@/components/ui/row-actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Tab = "entries" | "summary";
type GroupBy = "day" | "month";

const LIMIT = 50;

export function FinanceView() {
  const { companies } = useApp();
  const { access } = useSession();
  const canDelete = access.canDelete;
  const companyNames = [...new Set(companies.map((company) => company.short_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const [tab, setTab] = useState<Tab>("entries");
  const [range, setRange] = useState(monthRangeInput());
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<LiveCashbookEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<CashbookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LiveCashbookEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LiveCashbookEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetchLiveCashbook({
        from: range.from,
        to: range.to,
        group: group || undefined,
        q: query || undefined,
        limit: LIMIT,
        offset,
      }),
      fetchCashbookSummary({
        from: range.from,
        to: range.to,
        groupBy,
        group: group || undefined,
      }),
    ])
      .then(([page, sum]) => {
        if (!alive) return;
        setRows(page.rows);
        setTotal(page.total);
        setSummary(sum);
        setError("");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const message = e instanceof ApiError ? e.message : "Không tải được sổ chi.";
        setError(
          /cashbook|relation|schema cache|does not exist|source_type/i.test(message)
            ? "Chưa cập nhật sổ chi trên Supabase. Hãy chạy lại supabase/cashbook_entries.sql và supabase/fn_pay_advance.sql."
            : message,
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [range.from, range.to, group, query, groupBy, offset, reloadKey]);

  const reload = () => setReloadKey((value) => value + 1);

  const applyPreset = (preset: "today" | "week" | "month") => {
    setOffset(0);
    setRange(preset === "today" ? { from: todayInput(), to: todayInput() } : preset === "week" ? weekRangeInput() : monthRangeInput());
  };

  const saveEntry = async (form: {
    entry_date: string;
    content: string;
    full_name: string;
    company_name: string;
    amount: string;
    note: string;
    group_code: string;
  }) => {
    const body = {
      entry_date: form.entry_date,
      content: form.content.trim(),
      full_name: form.full_name.trim() || null,
      company_name: form.company_name.trim() || null,
      amount: Number(form.amount),
      note: form.note.trim() || null,
      group_code: form.group_code,
    };
    if (editing) {
      await updateLiveCashbookEntry(editing.id, body);
    } else {
      await createLiveCashbookEntry(body);
    }
    reload();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteLiveCashbookEntry(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Xóa khoản chi thất bại.");
    } finally {
      setDeleting(false);
    }
  };

  const totals = summary?.totals;
  const maxPages = Math.max(1, Math.ceil(total / LIMIT));
  const page = Math.floor(offset / LIMIT) + 1;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Tài chính"
        sub="Sổ chi hàng ngày: lương tuần và chi văn phòng"
        actions={
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => { setEditing(null); setModalOpen(true); }}>
            + Thêm khoản chi
          </Button>
        }
      />
      <QueryState loading={loading && rows.length === 0 && !summary} error={error && rows.length === 0 ? error : ""}>
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
          </div>

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
                  onChange={(e) => { setOffset(0); setRange((prev) => ({ ...prev, from: e.target.value })); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Đến ngày</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => { setOffset(0); setRange((prev) => ({ ...prev, to: e.target.value })); }}
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
                  onChange={(e) => { setOffset(0); setGroup(e.target.value); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
                >
                  <option value="">Tất cả</option>
                  {CASHBOOK_GROUPS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
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
                  <Button variant="outline" onClick={() => { setOffset(0); setQuery(search.trim()); }}>Tìm</Button>
                </div>
              </div>
            </div>
          </div>

          {error && rows.length > 0 && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
          )}

          {tab === "entries" ? (
            <div className="mt-4">
              <DataTable headers={["Ngày", "Nhóm", "Nội dung", "Người nhận", "Công ty", "Số tiền", "Ghi chú", "Thao tác"]}>
                {rows.map((row) => {
                  const locked = isAdvanceCashbookEntry(row);
                  return (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">{formatCashbookDate(row.entry_date)}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        <StatusPill tone={cashbookGroupTone(row.group_code)}>{cashbookGroupDisplay(row.group_code, row.group_name)}</StatusPill>
                        {locked && <StatusPill tone="neutral">Tạm ứng</StatusPill>}
                      </div>
                    </td>
                    <td className="min-w-[220px]">{row.content}</td>
                    <td>{row.full_name || "—"}</td>
                    <td>{row.company_name || "—"}</td>
                    <td className="whitespace-nowrap"><strong className="text-rose-600">{formatVND(Number(row.amount))}</strong></td>
                    <td className="max-w-[220px] truncate text-slate-500">{row.note || "—"}</td>
                    <td className="whitespace-nowrap">
                      <RowActions
                        label="Thao tác khoản chi"
                        items={
                          locked
                            ? [{ label: "Xem", onClick: () => { setEditing(row); setModalOpen(true); } }]
                            : [
                                { label: "Sửa", onClick: () => { setEditing(row); setModalOpen(true); } },
                                ...(canDelete
                                  ? [{ label: "Xóa", tone: "danger" as const, onClick: () => { setDeleteTarget(row); setDeleteError(""); } }]
                                  : []),
                              ]
                        }
                      />
                    </td>
                  </tr>
                  );
                })}
                {rows.length === 0 && <EmptyRow colSpan={8} text="Chưa có khoản chi nào trong khoảng thời gian này" />}
              </DataTable>
              <div className="mt-3 flex items-center justify-between text-[12.5px] text-slate-500">
                <span>Tổng {total} khoản chi</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>Trước</Button>
                  <span>Trang {page}/{maxPages}</span>
                  <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>Sau</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-slate-700">Tổng hợp chi theo {groupBy === "day" ? "ngày" : "tháng"}</p>
                <div className="flex gap-1">
                  <Button variant={groupBy === "day" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("day")}>Theo ngày</Button>
                  <Button variant={groupBy === "month" ? "default" : "outline"} size="sm" onClick={() => setGroupBy("month")}>Theo tháng</Button>
                </div>
              </div>
              <DataTable headers={["Kỳ", "Lương tuần", "Chi văn phòng", "Tổng chi", "Số khoản"]}>
                {(summary?.rows ?? []).map((row) => (
                  <tr key={row.period}>
                    <td className="whitespace-nowrap font-semibold">{groupBy === "day" ? formatCashbookDate(row.period) : row.period.split("-").reverse().join("/")}</td>
                    <td className="whitespace-nowrap">{formatVND(row.weekly_wage)}</td>
                    <td className="whitespace-nowrap">{formatVND(row.office)}</td>
                    <td className="whitespace-nowrap"><strong className="text-rose-600">{formatVND(row.total)}</strong></td>
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
        </div>
      </QueryState>

      <CashbookEntryModal
        open={modalOpen}
        entry={editing}
        companies={companyNames}
        onClose={() => setModalOpen(false)}
        onSave={saveEntry}
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
