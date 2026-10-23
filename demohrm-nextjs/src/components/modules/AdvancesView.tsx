"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  approveLiveAdvance,
  cancelLiveAdvance,
  downloadLiveAdvancesExcel,
  fetchLiveAdvances,
  fetchLiveWorkers,
  payLiveAdvance,
  settleLiveAdvance,
} from "@/lib/live";
import type { LiveAdvance, LiveWorkerRow } from "@/lib/live";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { formatVND } from "@/lib/format";
import { monthRangeInput } from "@/lib/cashbook";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { AdvanceModal } from "@/components/advances/AdvanceModal";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";
import { RowActions } from "@/components/ui/row-actions";
import type { RowActionItem } from "@/components/ui/row-actions";
import { Button } from "@/components/ui/button";

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

export function AdvancesView() {
  const { staff } = useApp();
  const { staff: currentStaff, access } = useSession();
  const canDelete = access.canDelete;
  const [range, setRange] = useState(monthRangeInput());
  const [status, setStatus] = useState("");
  const [subjectType, setSubjectType] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<LiveAdvance[]>([]);
  const [workers, setWorkers] = useState<LiveWorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LiveAdvance | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

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

  const act = async (row: LiveAdvance, action: "approve" | "reject" | "pay" | "settle" | "cancel") => {
    const confirmText =
      action === "approve"
        ? `Duyệt phiếu ${row.code}?`
        : action === "reject"
          ? `Từ chối phiếu ${row.code}?`
          : action === "pay"
            ? `Chi tiền phiếu ${row.code} (${formatVND(Number(row.amount) || 0)})? Khoản chi sẽ tự ghi vào sổ chi.`
            : action === "settle"
              ? `Quyết toán phiếu ${row.code}?`
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

  const exportExcel = async () => {
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
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Tạm ứng"
        sub="Quản lý tạm ứng cho người lao động và nhân viên"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled={exporting} onClick={() => void exportExcel()}>
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
        }
      />
      <QueryState loading={loading && rows.length === 0} error={error && rows.length === 0 ? error : ""}>
        <div className="page-body">
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
                const actions: RowActionItem[] = [];
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
                if (canDelete && (row.status === "requested" || row.status === "approved")) {
                  actions.push({ label: "Hủy phiếu", tone: "danger", disabled: busy, onClick: () => void act(row, "cancel") });
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
                      <RowActions items={actions} label="Thao tác phiếu tạm ứng" />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <EmptyRow colSpan={9} text="Chưa có phiếu tạm ứng trong khoảng thời gian này" />}
            </DataTable>
          </div>
          <p className="mt-2 text-[12px] text-slate-500">
            Đang hiển thị {rows.length} phiếu. Bộ lọc tối đa 500 phiếu gần nhất.
          </p>
        </div>
      </QueryState>

      <AdvanceModal
        key={`${editing?.id ?? "new"}-${modalOpen ? "open" : "closed"}`}
        open={modalOpen}
        advance={editing}
        workers={workers}
        staff={staff}
        currentStaffId={currentStaff?.id ?? null}
        onClose={() => setModalOpen(false)}
        onSaved={reload}
      />
    </section>
  );
}
