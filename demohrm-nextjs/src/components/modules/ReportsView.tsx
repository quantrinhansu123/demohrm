"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import {
  createDailyNote,
  deleteDailyNote,
  fetchLiveDailyReport,
  fetchLiveDailyReportWorkers,
  updateDailyNote,
} from "@/lib/live";
import type { LiveDailyReport, LiveDailyWorker } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";

function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export function ReportsView() {
  const { companies } = useApp();
  const [date, setDate] = useState(todayVN);
  const [rows, setRows] = useState<LiveDailyReport[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteFor, setNoteFor] = useState<LiveDailyReport | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<LiveDailyReport | null>(null);
  const [dailyWorkers, setDailyWorkers] = useState<LiveDailyWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [prevDate, setPrevDate] = useState(date);

  if (prevDate !== date) {
    setPrevDate(date);
    setLoading(true);
    setError("");
    setSelectedOrder(null);
    setDailyWorkers([]);
  }

  useEffect(() => {
    let alive = true;
    fetchLiveDailyReport(date)
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được báo cáo.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [date]);

  const loadWorkersForOrder = async (order: LiveDailyReport) => {
    setSelectedOrder(order);
    setLoadingWorkers(true);
    try {
      const list = await fetchLiveDailyReportWorkers(date, order.order_id);
      setDailyWorkers(list);
    } catch {
      setDailyWorkers([]);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (companyFilter && r.company !== companyFilter) return false;
      if (orderQuery) {
        const q = orderQuery.toLowerCase();
        return r.order_code.toLowerCase().includes(q) || r.order_name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, companyFilter, orderQuery]);

  const target = filteredRows.reduce((s, r) => s + r.target_qty, 0);
  const active = filteredRows.reduce((s, r) => s + r.active_qty, 0);
  const attended = filteredRows.reduce((s, r) => s + r.attended_qty, 0);
  const newJoins = filteredRows.reduce((s, r) => s + (r.new_joins || 0), 0);
  const missing = filteredRows.reduce((s, r) => s + r.missing_qty, 0);
  const rate = active > 0 ? (attended / active) * 100 : 0;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Báo cáo ngày theo đơn & nhà máy"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[13px]"
            />
          </div>
        }
      />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-3 md:grid-cols-4">
            <KpiCard
              title="ĐI LÀM / ĐANG LÀM"
              value={`${rate.toFixed(1)}%`}
              valueClassName="text-emerald-600"
              sub={`${attended} có mặt / ${active} đang làm`}
            />
            <KpiCard
              title="CHỈ TIÊU TRONG NGÀY"
              value={<>{target} <span className="text-[14px] font-medium text-slate-400">người</span></>}
              sub={`${filteredRows.length} đơn hàng`}
            />
            <KpiCard
              title="MỚI VÀO HÔM NAY"
              value={<>{newJoins} <span className="text-[14px] font-medium text-slate-400">người</span></>}
              valueClassName="text-blue-600"
              sub="NLĐ bắt đầu đợt mới"
            />
            <KpiCard
              title="CÒN THIẾU"
              value={<>{missing} <span className="text-[14px] font-medium text-slate-400">người</span></>}
              valueClassName="text-rose-600"
              sub="So với chỉ tiêu đơn"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]"
            >
              <option value="">Tất cả công ty</option>
              {companies.map((c) => (
                <option key={c.id} value={c.short_name}>{c.short_name}</option>
              ))}
            </select>
            <input
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="Tìm theo mã đơn, tên đơn..."
              className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
            <span className="ml-auto text-[13px] text-slate-500">
              Tổng số: <strong>{filteredRows.length}</strong> đơn
            </span>
          </div>

          <div className="mt-3">
            <DataTable
              headers={[
                "Đơn hàng",
                "Công ty",
                "Chỉ tiêu",
                "Đang làm",
                "Có mặt",
                "Mới vào",
                "Nghỉ/ra",
                "Chờ BG",
                "Đã nhận",
                "Thiếu",
                "Ghi chú",
                "Chi tiết",
              ]}
            >
              {filteredRows.map((r) => {
                const isSelected = selectedOrder?.order_id === r.order_id;
                return (
                  <tr key={r.order_id} className={isSelected ? "bg-blue-50/50" : undefined}>
                    <td>
                      <strong>{r.order_code}</strong> <br />
                      <span className="text-[11.5px] text-slate-500">{r.order_name}</span>
                    </td>
                    <td><span className="font-semibold text-slate-700">{r.company}</span></td>
                    <td><strong>{r.target_qty}</strong></td>
                    <td>{r.active_qty}</td>
                    <td><strong className="text-emerald-700">{r.attended_qty}</strong></td>
                    <td><span className={r.new_joins > 0 ? "font-bold text-blue-700" : "text-slate-400"}>{r.new_joins || 0}</span></td>
                    <td><span className={r.left_qty > 0 ? "font-bold text-rose-600" : "text-slate-400"}>{r.left_qty || 0}</span></td>
                    <td><span className={r.pending_handover > 0 ? "font-semibold text-amber-700" : "text-slate-400"}>{r.pending_handover || 0}</span></td>
                    <td><span className={r.received_handover > 0 ? "font-semibold text-emerald-700" : "text-slate-400"}>{r.received_handover || 0}</span></td>
                    <td><strong className={r.missing_qty > 0 ? "text-rose-600" : "text-slate-400"}>{r.missing_qty}</strong></td>
                    <td>
                      <span className="text-[12px] text-slate-600 line-clamp-1">{r.note || "—"}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant={isSelected ? "default" : "outline"}
                          className={isSelected ? "bg-[#0052cc] text-white" : undefined}
                          onClick={() => void loadWorkersForOrder(r)}
                        >
                          {isSelected ? "Đang xem" : "Xem NLĐ"}
                        </Button>
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-[#0052cc] hover:underline"
                          onClick={() => {
                            setNoteFor(r);
                            setNote(r.note ?? "");
                            setFormError("");
                          }}
                        >
                          Ghi chú
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && <EmptyRow colSpan={12} text="Không có đơn hàng trong ngày này." />}
            </DataTable>
          </div>

          {/* Bảng chi tiết Người lao động tương ứng theo ngày / đơn (Mục 9) */}
          {selectedOrder && (
            <div className="mt-6 rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">
                    Danh sách NLĐ trong ngày {date} · Đơn: <span className="text-[#0052cc]">{selectedOrder.order_code} ({selectedOrder.order_name})</span>
                  </h3>
                  <div className="text-[12px] text-slate-500">
                    Nhà máy: <strong>{selectedOrder.company}</strong> · Có mặt: <strong>{selectedOrder.attended_qty}</strong> / {selectedOrder.active_qty} đang làm
                  </div>
                </div>
                <Button size="xs" variant="outline" onClick={() => setSelectedOrder(null)}>Đóng chi tiết</Button>
              </div>

              <QueryState loading={loadingWorkers} error="">
                <DataTable headers={["Mã NLĐ", "Họ và tên", "Số ĐT", "Vị trí", "Trạng thái hôm nay", "Giờ vào", "Giờ ra", "Bàn giao", "Quản lý đón"]}>
                  {dailyWorkers.map((w, idx) => (
                    <tr key={`${w.worker_code}-${idx}`}>
                      <td><code>{w.worker_code}</code></td>
                      <td><strong>{w.full_name}</strong></td>
                      <td><code className="text-[12px]">{w.phone}</code></td>
                      <td>{w.position}</td>
                      <td>
                        <StatusPill tone={w.status_today === "present" ? "success" : w.status_today === "late" ? "warning" : "neutral"}>
                          {w.status_today === "present" ? "Có mặt" : w.status_today === "late" ? "Đi muộn" : "Vắng mặt"}
                        </StatusPill>
                      </td>
                      <td><span className="text-[12px] text-slate-600">{w.check_in_at ? new Date(w.check_in_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}</span></td>
                      <td><span className="text-[12px] text-slate-600">{w.check_out_at ? new Date(w.check_out_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}</span></td>
                      <td>
                        <StatusPill tone={w.handover_status === "received" ? "success" : w.handover_status === "handed_over" ? "info" : "warning"}>
                          {w.handover_status === "received" ? "Đã tiếp nhận" : w.handover_status === "handed_over" ? "Đã bàn giao" : "Chờ bàn giao"}
                        </StatusPill>
                      </td>
                      <td>
                        {w.supervisor_name ? (
                          <div>
                            <strong className="text-slate-800">{w.supervisor_name}</strong>
                            <div className="text-[11px] text-slate-400">{w.supervisor_phone}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {dailyWorkers.length === 0 && <EmptyRow colSpan={9} text="Không có dữ liệu NLĐ cho đơn này trong ngày." />}
                </DataTable>
              </QueryState>
            </div>
          )}
        </div>
      </QueryState>

      <Modal
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title={noteFor ? `Ghi chú phát sinh – ${noteFor.order_code}` : "Ghi chú phát sinh"}
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteFor(null)}>Hủy</Button>
            {noteFor?.note && (
              <Button
                variant="destructive"
                onClick={() => void (async () => {
                  if (!noteFor || !window.confirm("Xóa ghi chú này?")) return;
                  setBusy(true);
                  try {
                    await deleteDailyNote(date, noteFor.order_id);
                    setRows(await fetchLiveDailyReport(date));
                    setNoteFor(null);
                  } catch (e) {
                    setFormError(e instanceof ApiError ? e.message : "Xóa ghi chú thất bại.");
                  } finally {
                    setBusy(false);
                  }
                })()}
              >
                Xóa
              </Button>
            )}
            <Button
              className="bg-[#0052cc] text-white hover:bg-[#0747a6]"
              onClick={() => void (async () => {
                if (!noteFor || !note.trim()) return;
                setBusy(true);
                setFormError("");
                try {
                  const payload = { report_date: date, order_id: noteFor.order_id, note: note.trim() };
                  try {
                    await updateDailyNote(payload);
                  } catch (err) {
                    if (!(err instanceof ApiError) || err.status !== 404) throw err;
                    await createDailyNote(payload);
                  }
                  setRows(await fetchLiveDailyReport(date));
                  setNoteFor(null);
                } catch (e) {
                  setFormError(e instanceof ApiError ? e.message : "Lưu ghi chú thất bại.");
                } finally {
                  setBusy(false);
                }
              })()}
            >
              {busy ? "Đang lưu..." : "Lưu ghi chú"}
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <Field label="Nội dung ghi chú phát sinh trong ngày">
          <textarea
            className={inputClass}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi nhận vấn đề phát sinh, thiếu quân, xin nghỉ đột xuất..."
          />
        </Field>
      </Modal>
    </section>
  );
}
