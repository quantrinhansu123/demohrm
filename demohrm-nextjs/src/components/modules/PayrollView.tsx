"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import {
  approveLiveAdvance,
  createLiveSalaryEntry,
  fetchLiveAdvances,
  fetchLiveAssignments,
  fetchLivePayroll,
  fetchLivePlacementPay,
  fetchLiveSalaryEntries,
  fetchLiveSalaryEntryHistory,
  fetchLiveWorkers,
  generateLivePayroll,
  patchLiveSalaryEntry,
} from "@/lib/live";
import type {
  LiveAdvance,
  LiveAssignmentRow,
  LivePayrollRow,
  LivePlacementPayRow,
  LiveSalaryEntry,
  LiveSalaryEntryHistory,
} from "@/lib/live";
import { formatVND, initialsOf } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Modal, getInputClass, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import { SalaryEntrySchema, formatZodErrors } from "@/lib/validation";

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function workerLabel(w: LiveAdvance["worker"]): string {
  const row = Array.isArray(w) ? w[0] : w;
  return row ? `${row.code} ${row.full_name}` : "—";
}

const primaryBtn = "bg-[#0052cc] text-white hover:bg-[#0747a6]";

export function PayrollView() {
  const { periodCode, periods } = useApp();
  const { access, staff } = useSession();
  const period = periods.find((p) => p.code === periodCode);
  const [rows, setRows] = useState<LivePayrollRow[]>([]);
  const [advances, setAdvances] = useState<LiveAdvance[]>([]);
  const [entries, setEntries] = useState<LiveSalaryEntry[]>([]);
  const [placementPays, setPlacementPays] = useState<LivePlacementPayRow[]>([]);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [selectedPlacementWorker, setSelectedPlacementWorker] = useState<{
    worker: LivePayrollRow;
    placements: LivePlacementPayRow[];
  } | null>(null);

  // History modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<LiveSalaryEntry | null>(null);
  const [historyList, setHistoryList] = useState<LiveSalaryEntryHistory[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
  const [workers, setWorkers] = useState<Array<{ id: number; label: string }>>([]);
  const [workerAssignments, setWorkerAssignments] = useState<LiveAssignmentRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    workerId: "",
    placementId: "",
    type: "supplement",
    days: "",
    rate: "",
    amount: "",
    content: "",
    entryDate: "",
    reason: "",
  });
  const [entryTab, setEntryTab] = useState<"all" | "auto" | "supplement" | "voided">("all");

  const periodName = period?.name ?? periodCode;
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  const load = useCallback(async () => {
    if (!periodCode || !period) return;
    setLoading(true);
    try {
      const [pay, adv, ents, plmPay] = await Promise.all([
        fetchLivePayroll(periodCode),
        fetchLiveAdvances(period.id),
        fetchLiveSalaryEntries(period.id),
        fetchLivePlacementPay(periodCode).catch(() => [] as LivePlacementPayRow[]),
      ]);
      setRows(pay);
      setAdvances(adv);
      setEntries(ents);
      setPlacementPays(plmPay);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được bảng lương.");
    } finally {
      setLoading(false);
    }
  }, [periodCode, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    if (!periodCode || !window.confirm(`Sinh bảng lương kỳ ${periodCode}?`)) return;
    setBusy(true);
    setError("");
    try {
      await generateLivePayroll(periodCode);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Sinh lương thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: number, status: "approved" | "paid" | "rejected") => {
    setError("");
    try {
      await approveLiveAdvance(id, status);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Duyệt tạm ứng thất bại.");
    }
  };

  const toggleExpand = (workerCode: string) => {
    setExpandedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerCode)) next.delete(workerCode);
      else next.add(workerCode);
      return next;
    });
  };

  const openPlacementModal = (w: LivePayrollRow, plms: LivePlacementPayRow[]) => {
    setSelectedPlacementWorker({ worker: w, placements: plms });
  };

  const loadAssignmentsForWorker = async (workerIdStr: string) => {
    if (!workerIdStr) {
      setWorkerAssignments([]);
      return;
    }
    try {
      const list = await fetchLiveAssignments(Number(workerIdStr));
      setWorkerAssignments(list);
      if (list.length > 0) {
        setForm((prev) => {
          if (!prev.placementId || !list.some((a) => String(a.placement_id) === prev.placementId)) {
            return { ...prev, placementId: String(list[0].placement_id) };
          }
          return prev;
        });
      }
    } catch {
      setWorkerAssignments([]);
    }
  };

  const handleWorkerChange = (workerIdStr: string) => {
    setForm((prev) => ({ ...prev, workerId: workerIdStr, placementId: "" }));
    setEntryErrors((prev) => {
      const next = { ...prev };
      delete next.workerId;
      return next;
    });
    void loadAssignmentsForWorker(workerIdStr);
  };

  const handleDaysOrRateChange = (daysVal: string, rateVal: string) => {
    const d = Number(daysVal);
    const r = Number(rateVal);
    let autoAmount = form.amount;
    if (daysVal && rateVal && Number.isFinite(d) && Number.isFinite(r) && d > 0 && r > 0) {
      autoAmount = String(Math.round(d * r));
    }
    setForm((prev) => ({
      ...prev,
      days: daysVal,
      rate: rateVal,
      amount: autoAmount,
    }));
    setEntryErrors((prev) => {
      const next = { ...prev };
      delete next.days;
      delete next.rate;
      if (autoAmount) delete next.amount;
      return next;
    });
  };

  const openEntry = async () => {
    setEditingId(null);
    setFormError("");
    setEntryErrors({});
    setOpen(true);
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    try {
      const page = await fetchLiveWorkers({ statusEn: "working", limit: 100 });
      const opts = page.rows.map((w) => ({ id: w.id, label: `${w.code} - ${w.full_name}` }));
      setWorkers(opts);
      const firstId = opts[0] ? String(opts[0].id) : "";
      setForm({
        workerId: firstId,
        placementId: "",
        type: "supplement",
        days: "",
        rate: "",
        amount: "",
        content: "",
        entryDate: todayStr,
        reason: "",
      });
      if (firstId) {
        void loadAssignmentsForWorker(firstId);
      }
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được NLĐ.");
    }
  };

  const openEditEntry = (e: LiveSalaryEntry) => {
    setEditingId(e.id);
    setFormError("");
    setEntryErrors({});
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    setForm({
      workerId: String(e.worker_id),
      placementId: e.placement_id ? String(e.placement_id) : "",
      type: e.entry_type ?? "supplement",
      days: e.work_days == null ? "" : String(e.work_days),
      rate: e.daily_rate == null ? "" : String(e.daily_rate),
      amount: e.amount == null ? "" : String(e.amount),
      content: e.content ?? "",
      entryDate: e.entry_date ?? todayStr,
      reason: "",
    });
    setOpen(true);
    if (e.worker_id) {
      void loadAssignmentsForWorker(String(e.worker_id));
    }
  };

  const openHistory = async (e: LiveSalaryEntry) => {
    setHistoryTarget(e);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const history = await fetchLiveSalaryEntryHistory(e.id);
      setHistoryList(history);
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveEntry = async () => {
    if (!period) return;
    setFormError("");
    const parsed = SalaryEntrySchema.safeParse(form);
    if (!parsed.success) {
      setEntryErrors(formatZodErrors(parsed.error));
      return;
    }
    setEntryErrors({});

    setBusy(true);
    try {
      if (editingId) {
        if (!form.reason.trim()) {
          setEntryErrors({ reason: "Vui lòng nhập lý do chỉnh sửa dòng lương" });
          setBusy(false);
          return;
        }
        await patchLiveSalaryEntry(editingId, {
          placement_id: form.placementId ? Number(form.placementId) : null,
          entry_type: form.type,
          entry_date: form.entryDate || undefined,
          work_days: form.days ? Number(form.days) : null,
          daily_rate: form.rate ? Number(form.rate) : null,
          amount: Number(form.amount),
          content: form.content.trim() || null,
          reason: form.reason.trim(),
        });
        setOpen(false);
        await load();
        return;
      }
      await createLiveSalaryEntry({
        worker_id: Number(form.workerId),
        placement_id: form.placementId ? Number(form.placementId) : null,
        period_id: period.id,
        entry_type: form.type,
        work_days: form.days ? Number(form.days) : null,
        daily_rate: form.rate ? Number(form.rate) : null,
        amount: Number(form.amount),
        content: form.content.trim() || null,
        entry_date: form.entryDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()),
      });
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Nhập lương thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const voidEntry = async (id: number) => {
    const reason = window.prompt("Lý do hủy dòng lương:");
    if (!reason) return;
    setError("");
    try {
      await patchLiveSalaryEntry(id, { voided_at: new Date().toISOString(), void_reason: reason });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Hủy dòng thất bại.");
    }
  };

  const pending = advances.filter((a) => a.status === "requested" || a.status === "approved");

  // Tính tổng của kỳ và phân loại dòng lương
  const activeEntries = entries.filter((e) => !e.voided_at);
  const totalWage = activeEntries
    .filter((e) => e.entry_type === "wage")
    .reduce((s, e) => s + num(e.amount), 0);
  const totalSupplement = activeEntries
    .filter((e) => e.entry_type === "supplement")
    .reduce((s, e) => s + num(e.amount), 0);
  const totalAllowanceBonus = activeEntries
    .filter((e) => e.entry_type === "allowance" || e.entry_type === "bonus" || e.entry_type === "extra")
    .reduce((s, e) => s + num(e.amount), 0);
  const totalDeduction = activeEntries
    .filter((e) => e.entry_type === "deduction")
    .reduce((s, e) => s + num(e.amount), 0);
  const netEntryTotal = totalWage + totalSupplement + totalAllowanceBonus - totalDeduction;
  const autoCount = activeEntries.filter((e) => Boolean(e.is_auto)).length;
  const manualCount = activeEntries.filter((e) => !e.is_auto).length;
  const voidedCount = entries.filter((e) => Boolean(e.voided_at)).length;

  const displayedEntries = entries.filter((e) => {
    if (entryTab === "auto") return Boolean(e.is_auto) && !e.voided_at;
    if (entryTab === "supplement") return !e.is_auto && !e.voided_at;
    if (entryTab === "voided") return Boolean(e.voided_at);
    return true;
  });

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Lương & tạm ứng"
        sub={periodName}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => void openEntry()}>+ Nhập dòng</Button>
            {access.canClosePeriod && (
              <Button size="sm" className={primaryBtn} onClick={() => void generate()}>{busy ? "Đang sinh..." : "Sinh bảng lương"}</Button>
            )}
          </>
        }
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body flex flex-col gap-4">
          {pending.length > 0 && (
            <div>
              <div className="mb-2 text-[13px] font-semibold text-slate-800">Yêu cầu tạm ứng đang chờ xử lý</div>
              <DataTable headers={["Tạm ứng", "Người lao động", "Số tiền", "Lý do", "Trạng thái", ""]}>
                {pending.map((a) => (
                  <tr key={a.id}>
                    <td><code>{a.code}</code></td>
                    <td>{workerLabel(a.worker)}</td>
                    <td>{formatVND(num(a.amount))}</td>
                    <td>{a.reason ?? "—"}</td>
                    <td><StatusPill tone="warning">{a.status}</StatusPill></td>
                    <td>
                      {access.canViewFinance && (
                        <span className="flex gap-2">
                          {a.status === "requested" && <button type="button" className="text-[12px] font-semibold text-[#0052cc]" onClick={() => void decide(a.id, "approved")}>Duyệt</button>}
                          {a.status !== "paid" && <button type="button" className="text-[12px] font-semibold text-emerald-700" onClick={() => void decide(a.id, "paid")}>Đã chi</button>}
                          <button type="button" className="text-[12px] font-semibold text-rose-600" onClick={() => void decide(a.id, "rejected")}>Từ chối</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-slate-800">
                Bảng tính lương tổng hợp ({rows.length} người lao động)
              </span>
              <span className="text-[12px] text-slate-500">
                Nhấp nút xem đợt để xem phân chia lương từng công ty/đơn hàng
              </span>
            </div>
            <DataTable headers={["Họ tên & Mã", "Công ty", "Ngày công", "Lương", "Phụ cấp", "Khấu trừ", "Tạm ứng", "Thực lĩnh", "Đợt làm việc"]}>
              {rows.map((w, i) => {
                const plms = placementPays.filter(
                  (p) => (w.worker_id && p.worker_id === w.worker_id) || (p as unknown as { worker_code?: string }).worker_code === w.code,
                );
                const isExpanded = expandedWorkers.has(w.code);

                return (
                  <Fragment key={`${w.code}-${i}`}>
                    <tr className={isExpanded ? "bg-blue-50/40" : undefined}>
                      <td>
                        <span className="flex items-center gap-2">
                          <Avatar tone="avatar-blue" size="sm">{initialsOf(w.full_name)}</Avatar>
                          <div>
                            <strong className="block text-slate-800">{w.full_name}</strong>
                            <span className="font-mono text-[11px] text-slate-500">{w.code}</span>
                          </div>
                        </span>
                      </td>
                      <td>{w.companies ?? "—"}</td>
                      <td><strong>{num(w.work_days)}</strong></td>
                      <td>{formatVND(num(w.wage_amount))}</td>
                      <td>{formatVND(num(w.extra_amount))}</td>
                      <td>{formatVND(num(w.deduction))}</td>
                      <td>{formatVND(num(w.advance_amount))}</td>
                      <td><strong className="text-emerald-600">{formatVND(num(w.net_amount))}</strong></td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(w.code)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
                            title="Xem chi tiết các đợt làm việc"
                          >
                            <span>{plms.length > 0 ? `${plms.length} đợt` : "Chi tiết"}</span>
                            <span>{isExpanded ? "▲" : "▼"}</span>
                          </button>
                          {plms.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openPlacementModal(w, plms)}
                              className="text-[11.5px] font-semibold text-[#0052cc] hover:underline"
                            >
                              Popup
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={9} className="p-3">
                          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                              <span className="text-[12.5px] font-semibold text-slate-800">
                                Chi tiết phân chia lương theo từng đợt làm việc trong kỳ của {w.full_name} ({w.code})
                              </span>
                              <span className="text-[11.5px] text-slate-500">
                                Tổng: {plms.length} đợt làm việc
                              </span>
                            </div>
                            {plms.length === 0 ? (
                              <p className="py-2 text-[12px] italic text-slate-400">
                                Chưa có phân bổ đợt làm việc phát sinh ngày công trong kỳ này.
                              </p>
                            ) : (
                              <table className="w-full text-[12px]">
                                <thead>
                                  <tr className="border-b border-slate-200 text-left text-slate-500">
                                    <th className="py-1">Công ty</th>
                                    <th className="py-1">Đơn hàng</th>
                                    <th className="py-1">Vị trí</th>
                                    <th className="py-1">Thời gian đợt</th>
                                    <th className="py-1 text-right">Ngày công</th>
                                    <th className="py-1 text-right">Đơn giá ngày</th>
                                    <th className="py-1 text-right">Lương của đợt</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {plms.map((p) => (
                                    <tr key={p.placement_id}>
                                      <td className="py-1.5 font-medium text-slate-800">{p.company}</td>
                                      <td className="py-1.5 font-mono text-[11px] text-[#0052cc]">{p.order_code}</td>
                                      <td className="py-1.5 text-slate-600">{p.position}</td>
                                      <td className="py-1.5 text-slate-500">
                                        {p.first_day || p.start_date} ~ {p.last_day || p.end_date || "nay"}
                                      </td>
                                      <td className="py-1.5 text-right font-semibold text-slate-800">{num(p.work_days)}</td>
                                      <td className="py-1.5 text-right text-slate-600">{formatVND(num(p.daily_rate))}</td>
                                      <td className="py-1.5 text-right font-bold text-emerald-600">{formatVND(num(p.amount))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && <EmptyRow colSpan={9} text="Chưa có dòng lương trong kỳ này" />}
            </DataTable>
          </div>

          <div className="flex flex-col gap-3">
            {/* Tổng của kỳ và phân loại dòng lương */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900">
                    Tổng hợp các dòng lương trong kỳ {periodName}
                  </h3>
                  <p className="text-[12px] text-slate-500">
                    Xem từng lần nhập, phân biệt tự sinh từ chấm công vs lần bổ sung ghi riêng
                  </p>
                </div>
                <div className="text-[12px] font-medium text-slate-600">
                  Hiệu lực: <strong className="text-emerald-700">{activeEntries.length}</strong> dòng · Đã hủy: <strong className="text-rose-600">{voidedCount}</strong> dòng
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 text-[12.5px]">
                <div className="rounded-lg bg-blue-50/70 p-2.5">
                  <div className="text-[11px] font-medium text-blue-700">Lương theo công (tự sinh)</div>
                  <div className="text-[14px] font-bold text-blue-950">{formatVND(totalWage)}</div>
                  <div className="text-[10.5px] text-blue-600">{autoCount} dòng tự sinh</div>
                </div>

                <div className="rounded-lg bg-cyan-50/70 p-2.5">
                  <div className="text-[11px] font-medium text-cyan-800">Lương bổ sung</div>
                  <div className="text-[14px] font-bold text-cyan-950">{formatVND(totalSupplement)}</div>
                  <div className="text-[10.5px] text-cyan-700">Ghi nhận bổ sung riêng</div>
                </div>

                <div className="rounded-lg bg-emerald-50/70 p-2.5">
                  <div className="text-[11px] font-medium text-emerald-700">Phụ cấp & Thưởng</div>
                  <div className="text-[14px] font-bold text-emerald-950">{formatVND(totalAllowanceBonus)}</div>
                  <div className="text-[10.5px] text-emerald-600">Chuyên cần, thưởng ca...</div>
                </div>

                <div className="rounded-lg bg-rose-50/70 p-2.5">
                  <div className="text-[11px] font-medium text-rose-700">Tổng khấu trừ</div>
                  <div className="text-[14px] font-bold text-rose-950">-{formatVND(totalDeduction)}</div>
                  <div className="text-[10.5px] text-rose-600">Thẻ, đồng phục...</div>
                </div>

                <div className="rounded-lg bg-emerald-100/70 p-2.5 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-medium text-emerald-800">Tổng thực lĩnh các dòng</div>
                  <div className="text-[15px] font-bold text-emerald-950">{formatVND(netEntryTotal)}</div>
                  <div className="text-[10.5px] text-emerald-700">Không cộng trùng khi sửa</div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEntryTab("all")}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      entryTab === "all"
                        ? "bg-[#0052cc] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Tất cả ({entries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryTab("auto")}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      entryTab === "auto"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    Tự sinh từ công ({autoCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryTab("supplement")}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      entryTab === "supplement"
                        ? "bg-cyan-700 text-white"
                        : "bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                    }`}
                  >
                    Lần bổ sung / Thủ công ({manualCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryTab("voided")}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      entryTab === "voided"
                        ? "bg-rose-600 text-white"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                  >
                    Đã hủy ({voidedCount})
                  </button>
                </div>

                <Button size="sm" variant="outline" onClick={() => void openEntry()}>
                  + Nhập dòng bổ sung
                </Button>
              </div>
            </div>

            <DataTable headers={["Mã dòng", "Người lao động", "Công ty / Đợt làm", "Loại", "Ngày công", "Đơn giá", "Số tiền", "Nội dung", "Người nhập", "Ngày nhập", "Phiên bản", "Thao tác"]}>
              {displayedEntries.map((e) => {
                const w = Array.isArray(e.workers) ? e.workers[0] : e.workers;
                const workerText = w ? `${w.code} - ${w.full_name}` : `NLĐ #${e.worker_id}`;
                const st = Array.isArray(e.staff) ? e.staff[0] : e.staff;
                const staffText = st?.full_name ?? "—";
                const dateText = e.entry_date ?? (e.created_at ? e.created_at.slice(0, 10) : "—");
                const placementText = e.company
                  ? `${e.company}${e.order_code ? ` · ${e.order_code}` : ""}`
                  : "—";

                return (
                  <tr key={e.id} className={e.voided_at ? "bg-rose-50/30 text-slate-400" : undefined}>
                    <td><code>{e.code ?? e.id}</code></td>
                    <td className="font-medium text-slate-800">{workerText}</td>
                    <td className="text-slate-600 text-[12px]">{placementText}</td>
                    <td>
                      <StatusPill
                        tone={
                          e.is_auto
                            ? "info"
                            : e.entry_type === "wage"
                              ? "info"
                              : e.entry_type === "supplement"
                                ? "neutral"
                                : e.entry_type === "allowance" || e.entry_type === "extra"
                                  ? "success"
                                  : e.entry_type === "bonus"
                                    ? "warning"
                                    : "danger"
                        }
                      >
                        {e.is_auto
                          ? "Lương tự sinh"
                          : e.entry_type === "wage"
                            ? "Lương theo công"
                            : e.entry_type === "supplement"
                              ? "Lương bổ sung"
                              : e.entry_type === "allowance" || e.entry_type === "extra"
                                ? "Phụ cấp"
                                : e.entry_type === "bonus"
                                  ? "Thưởng"
                                  : e.entry_type === "deduction"
                                    ? "Khấu trừ"
                                    : (e.entry_type ?? "—")}
                      </StatusPill>
                    </td>
                    <td>{e.work_days != null ? num(e.work_days) : "—"}</td>
                    <td>{e.daily_rate != null ? formatVND(num(e.daily_rate)) : "—"}</td>
                    <td className="font-semibold text-slate-800">
                      {e.entry_type === "deduction" ? `-${formatVND(num(e.amount))}` : formatVND(num(e.amount))}
                    </td>
                    <td>
                      {e.voided_at ? (
                        <span className="text-rose-600 font-medium">Đã hủy: {e.void_reason || "Hủy dòng"}</span>
                      ) : (
                        e.content ?? "—"
                      )}
                    </td>
                    <td className="text-slate-600">{staffText}</td>
                    <td className="text-slate-500 text-[12px]">{dateText}</td>
                    <td>
                      {num(e.revision_no) > 1 ? (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                          Đã sửa #{e.revision_no}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Bản #1</span>
                      )}
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-indigo-600 hover:underline"
                          onClick={() => void openHistory(e)}
                          title="Xem lịch sử sửa đổi"
                        >
                          Lịch sử
                        </button>
                        {!e.voided_at && (
                          <>
                            <button
                              type="button"
                              className="text-[12px] font-semibold text-[#0052cc] hover:underline"
                              onClick={() => openEditEntry(e)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="text-[12px] font-semibold text-rose-600 hover:underline"
                              onClick={() => void voidEntry(e.id)}
                            >
                              Hủy
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {displayedEntries.length === 0 && <EmptyRow colSpan={12} text="Không có dòng lương nào phù hợp điều kiện lọc." />}
            </DataTable>
          </div>
        </div>
      </QueryState>

      {/* Modal chi tiết phân chia đợt làm việc theo NLĐ */}
      <Modal
        open={Boolean(selectedPlacementWorker)}
        onClose={() => setSelectedPlacementWorker(null)}
        title={`Chi tiết phân chia lương theo đợt: ${selectedPlacementWorker?.worker.full_name} (${selectedPlacementWorker?.worker.code})`}
        footer={<Button variant="outline" onClick={() => setSelectedPlacementWorker(null)}>Đóng</Button>}
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-blue-50/60 p-3 text-[12.5px] text-blue-900">
            <div><strong>Kỳ tính lương:</strong> {periodName}</div>
            <div><strong>Tổng ngày công trong kỳ:</strong> {num(selectedPlacementWorker?.worker.work_days)} công</div>
            <div><strong>Tổng thực lĩnh:</strong> {formatVND(num(selectedPlacementWorker?.worker.net_amount))}</div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12.5px]">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="p-2.5">Công ty</th>
                  <th className="p-2.5">Đơn hàng</th>
                  <th className="p-2.5">Vị trí</th>
                  <th className="p-2.5">Thời gian đợt</th>
                  <th className="p-2.5 text-right">Ngày công</th>
                  <th className="p-2.5 text-right">Đơn giá ngày</th>
                  <th className="p-2.5 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(selectedPlacementWorker?.placements ?? []).map((p) => (
                  <tr key={p.placement_id}>
                    <td className="p-2.5 font-medium text-slate-800">{p.company}</td>
                    <td className="p-2.5 font-mono text-[11px] text-[#0052cc]">{p.order_code}</td>
                    <td className="p-2.5 text-slate-600">{p.position}</td>
                    <td className="p-2.5 text-slate-500">
                      {p.first_day || p.start_date} ~ {p.last_day || p.end_date || "nay"}
                    </td>
                    <td className="p-2.5 text-right font-semibold text-slate-800">{num(p.work_days)}</td>
                    <td className="p-2.5 text-right text-slate-600">{formatVND(num(p.daily_rate))}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-600">{formatVND(num(p.amount))}</td>
                  </tr>
                ))}
                {(selectedPlacementWorker?.placements ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                      Chưa có dữ liệu phân chia đợt làm việc
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Modal Lịch sử sửa đổi dòng lương */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Lịch sử chỉnh sửa dòng lương: ${historyTarget?.code ?? historyTarget?.id}`}
        footer={<Button variant="outline" onClick={() => setHistoryOpen(false)}>Đóng</Button>}
      >
        <div className="flex flex-col gap-3">
          <div className="text-[12.5px] text-slate-600">
            Dòng lương của: <strong>{(() => {
              const w = Array.isArray(historyTarget?.workers) ? historyTarget?.workers[0] : historyTarget?.workers;
              return w ? `${w.code} - ${w.full_name}` : `NLĐ #${historyTarget?.worker_id}`;
            })()}</strong>
          </div>
          {historyLoading ? (
            <p className="py-6 text-center text-[13px] text-slate-400">Đang tải lịch sử sửa đổi...</p>
          ) : historyList.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-[12.5px] text-slate-500">
              Dòng lương này chưa có lần chỉnh sửa nào (giữ nguyên dữ liệu ban đầu từ lúc tạo).
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr className="border-b border-slate-200">
                    <th className="p-2">Lần</th>
                    <th className="p-2">Người sửa</th>
                    <th className="p-2">Thời gian</th>
                    <th className="p-2">Ngày công</th>
                    <th className="p-2">Đơn giá</th>
                    <th className="p-2">Số tiền</th>
                    <th className="p-2">Nội dung</th>
                    <th className="p-2">Lý do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyList.map((h) => (
                    <tr key={h.id}>
                      <td className="p-2 font-semibold">#{h.revision_no}</td>
                      <td className="p-2 font-medium text-slate-800">{h.changed_by_staff?.full_name ?? (h.changed_by ? `ID: ${h.changed_by}` : "Hệ thống")}</td>
                      <td className="p-2 text-slate-500">{new Date(h.changed_at).toLocaleString("vi-VN")}</td>
                      <td className="p-2">
                        {h.work_days_old != null || h.work_days_new != null ? (
                          <span>{h.work_days_old ?? "—"} ➔ <strong className="text-slate-800">{h.work_days_new ?? "—"}</strong></span>
                        ) : "—"}
                      </td>
                      <td className="p-2">
                        {h.daily_rate_old != null || h.daily_rate_new != null ? (
                          <span>{h.daily_rate_old ? formatVND(num(h.daily_rate_old)) : "—"} ➔ <strong className="text-slate-800">{h.daily_rate_new ? formatVND(num(h.daily_rate_new)) : "—"}</strong></span>
                        ) : "—"}
                      </td>
                      <td className="p-2">
                        {h.amount_old != null || h.amount_new != null ? (
                          <span>{h.amount_old ? formatVND(num(h.amount_old)) : "—"} ➔ <strong className="text-emerald-700">{h.amount_new ? formatVND(num(h.amount_new)) : "—"}</strong></span>
                        ) : "—"}
                      </td>
                      <td className="p-2 text-slate-600">
                        {h.content_old !== h.content_new ? (
                          <span>{h.content_old ?? "—"} ➔ <strong className="text-slate-800">{h.content_new ?? "—"}</strong></span>
                        ) : (h.content_new ?? "—")}
                      </td>
                      <td className="p-2 text-slate-500 italic">{h.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Thêm/Sửa dòng lương */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? `Sửa dòng lương: ${entries.find((e) => e.id === editingId)?.code ?? `#${editingId}`}` : "Nhập dòng lương"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button className={primaryBtn} onClick={() => void saveEntry()}>{busy ? "Đang lưu..." : "Lưu"}</Button>
          </>
        }
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Người lao động */}
          {editingId ? (
            <Field label="Người lao động">
              <input
                className={inputClass}
                disabled
                value={(() => {
                  const ed = entries.find((e) => e.id === editingId);
                  const w = Array.isArray(ed?.workers) ? ed?.workers[0] : ed?.workers;
                  return w ? `${w.code} - ${w.full_name}` : (workers.find((x) => String(x.id) === form.workerId)?.label || `NLĐ #${form.workerId}`);
                })()}
              />
            </Field>
          ) : (
            <Field label="Người lao động *" error={entryErrors.workerId}>
              <select
                className={getInputClass(entryErrors.workerId)}
                value={form.workerId}
                onChange={(e) => handleWorkerChange(e.target.value)}
              >
                {workers.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </Field>
          )}

          {/* Kỳ lương */}
          <Field label="Kỳ lương">
            <input className={inputClass} disabled value={periodName} />
          </Field>

          {/* Đợt làm việc / Công ty */}
          <Field label="Đợt làm việc / Công ty">
            <select
              className={inputClass}
              value={form.placementId}
              onChange={(e) => setForm({ ...form, placementId: e.target.value })}
            >
              <option value="">— Không chọn đợt (Nhập chung) —</option>
              {workerAssignments.map((a) => (
                <option key={a.placement_id} value={a.placement_id}>
                  [{a.company}] {a.order_code} - {a.position} ({a.start_date}{a.end_date ? ` ~ ${a.end_date}` : ""})
                </option>
              ))}
            </select>
          </Field>

          {/* Loại dòng lương */}
          <Field label="Loại dòng lương *">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="supplement">Lương bổ sung</option>
              <option value="wage">Lương theo ngày công</option>
              <option value="allowance">Phụ cấp</option>
              <option value="bonus">Thưởng</option>
              <option value="deduction">Khấu trừ</option>
            </select>
          </Field>

          {/* Ngày nhập */}
          <Field label="Ngày nhập *">
            <input
              type="date"
              className={inputClass}
              value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            />
          </Field>

          {/* Người nhập / Người thực hiện */}
          <Field label={editingId ? "Người sửa" : "Người nhập"}>
            <input
              className={inputClass}
              disabled
              value={staff?.full_name ? `${staff.full_name} (${staff.code})` : "Giám đốc / Quản trị viên"}
            />
          </Field>

          {/* Ngày công */}
          <Field label="Ngày công" error={entryErrors.days}>
            <input
              className={getInputClass(entryErrors.days)}
              inputMode="decimal"
              placeholder="VD: 24 (nếu tính theo công)"
              value={form.days}
              onChange={(e) => handleDaysOrRateChange(e.target.value, form.rate)}
            />
          </Field>

          {/* Đơn giá ngày */}
          <Field label="Đơn giá ngày (VNĐ)" error={entryErrors.rate}>
            <input
              className={getInputClass(entryErrors.rate)}
              inputMode="numeric"
              placeholder="VD: 250000"
              value={form.rate}
              onChange={(e) => handleDaysOrRateChange(form.days, e.target.value)}
            />
          </Field>

          {/* Số tiền */}
          <Field label="Số tiền *" error={entryErrors.amount}>
            <input
              className={getInputClass(entryErrors.amount)}
              inputMode="numeric"
              placeholder="VD: 6000000"
              value={form.amount}
              onChange={(e) => {
                const val = e.target.value;
                setForm({ ...form, amount: val });
                if (entryErrors.amount) {
                  setEntryErrors((prev) => {
                    const next = { ...prev };
                    delete next.amount;
                    return next;
                  });
                }
              }}
            />
          </Field>

          {/* Nội dung */}
          <Field label="Nội dung / Diễn giải">
            <input
              className={inputClass}
              placeholder="VD: Bổ sung công, phụ cấp trách nhiệm, thưởng chuyên cần..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </Field>

          {/* Lý do chỉnh sửa */}
          {editingId && (
            <div className="sm:col-span-2">
              <Field label="Lý do chỉnh sửa *" error={entryErrors.reason}>
                <input
                  className={getInputClass(entryErrors.reason)}
                  placeholder="VD: Điều chỉnh theo thỏa thuận, nhập sai số công..."
                  value={form.reason}
                  onChange={(e) => {
                    setForm({ ...form, reason: e.target.value });
                    if (entryErrors.reason) {
                      setEntryErrors((prev) => {
                        const next = { ...prev };
                        delete next.reason;
                        return next;
                      });
                    }
                  }}
                />
              </Field>
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}

