"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import {
  addLivePlacement,
  closeLivePlacement,
  deleteLivePlacement,
  createLiveAdvance,
  fetchLiveAssignments,
  fetchLiveOrders,
  fetchLivePayroll,
  fetchLivePlacementPay,
  fetchLivePositions,
  fetchLiveSupervisors,
  handoverAction,
  setPlacementStage,
  toWorkAssignment,
  fetchLiveWorkers,
  toWorker,
} from "@/lib/live";
import type {
  LiveAssignmentRow,
  LiveOrderRow,
  LivePayrollRow,
  LivePlacementPayRow,
  LivePositionRow,
  LiveSupervisor,
} from "@/lib/live";
import { formatVND, maskCitizenId } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill, statusToneForWorker } from "@/components/ui/badge";
import { Field, Modal, getInputClass, inputClass } from "@/components/ui/modal";
import { HandoverInvite } from "@/components/workers/HandoverInvite";
import { WorkerDocuments } from "@/components/workers/WorkerDocuments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Worker } from "@/types/hrm";
import { AddPlacementSchema, ClosePlacementSchema, formatZodErrors } from "@/lib/validation";
import { EditWorkerModal } from "@/components/workers/WorkersView";

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function WorkerDetailModal({
  worker,
  onClose,
}: {
  worker: Worker | null;
  onClose: () => void;
}) {
  const { access } = useSession();
  const { periodCode, periods, companies, staff } = useApp();
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(worker);
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    setCurrentWorker(worker);
  }, [worker]);

  const [tab, setTab] = useState<"personal" | "job" | "payroll">("personal");
  const [showAddDot, setShowAddDot] = useState(false);
  const [newDot, setNewDot] = useState({
    orderCode: "",
    position: "",
    supervisorId: "",
    recruiterId: worker?.recruiterId ? String(worker.recruiterId) : "",
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [dotErrors, setDotErrors] = useState<Record<string, string>>({});
  const [advAmount, setAdvAmount] = useState("500000");
  const [advError, setAdvError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [liveDots, setLiveDots] = useState<LiveAssignmentRow[] | null>(null);
  const [livePay, setLivePay] = useState<LivePayrollRow | null>(null);
  const [placementPay, setPlacementPay] = useState<LivePlacementPayRow[]>([]);
  const [availableOrders, setAvailableOrders] = useState<LiveOrderRow[]>([]);
  const [availablePositions, setAvailablePositions] = useState<LivePositionRow[]>([]);
  const [availableSupervisors, setAvailableSupervisors] = useState<LiveSupervisor[]>([]);
  const [closingDot, setClosingDot] = useState<{
    placementId: number;
    startDate: string;
    company: string;
    position: string;
  } | null>(null);
  const [closeForm, setCloseForm] = useState({
    endDate: new Date().toISOString().slice(0, 10),
    endReason: "Kết thúc đợt",
  });
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({});
  const [closeError, setCloseError] = useState("");

  const workerId = worker?.id ?? 0;
  const workerCode = worker?.code ?? "";

  const reloadDots = async () => {
    if (!workerId) return;
    try {
      setLiveDots(await fetchLiveAssignments(workerId));
    } catch {
      setLiveDots(null);
    }
  };

  useEffect(() => {
    void reloadDots();
  }, [workerId]);

  useEffect(() => {
    if (tab === "job") {
      void reloadDots();
      void fetchLiveOrders(periodCode || "2026-10")
        .then((orders) => {
          setAvailableOrders(orders);
          if (orders[0] && !newDot.orderCode) {
            setNewDot((d) => ({ ...d, orderCode: orders[0].code }));
          }
        })
        .catch(() => {});
      void fetchLivePositions().then(setAvailablePositions).catch(() => {});
      void fetchLiveSupervisors().then(setAvailableSupervisors).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, workerId, periodCode]);

  useEffect(() => {
    if (tab !== "payroll" || !workerCode || !periodCode) return;
    let alive = true;
    (async () => {
      try {
        const [rows, pPay] = await Promise.all([
          fetchLivePayroll(periodCode, workerCode),
          fetchLivePlacementPay(periodCode, workerId),
        ]);
        if (alive) {
          setLivePay(rows[0] ?? null);
          setPlacementPay(pPay);
        }
      } catch {
        if (alive) {
          setLivePay(null);
          setPlacementPay([]);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab, workerCode, workerId, periodCode]);

  if (!worker) return null;
  const activeWorker = currentWorker ?? worker;
  const assignments = (liveDots ?? []).map(toWorkAssignment);

  const selectedOrder = availableOrders.find((o) => o.code === newDot.orderCode);
  const currentPositions = selectedOrder
    ? availablePositions.filter((p) => p.order_id === selectedOrder.order_id)
    : [];
  const currentCompany = companies.find((c) => c.short_name === selectedOrder?.company);
  const currentSupervisors = currentCompany
    ? availableSupervisors.filter((s) => s.company_id === currentCompany.id)
    : availableSupervisors;

  const saveDot = async () => {
    setError("");
    const parsed = AddPlacementSchema.safeParse(newDot);
    if (!parsed.success) {
      setDotErrors(formatZodErrors(parsed.error));
      return;
    }
    setDotErrors({});

    setBusy(true);
    try {
      await addLivePlacement({
        worker_id: worker.id,
        order_code: newDot.orderCode.trim(),
        position: newDot.position.trim() || undefined,
        recruiter_id: newDot.recruiterId ? Number(newDot.recruiterId) : (worker.recruiterId ?? undefined),
        supervisor_id: newDot.supervisorId ? Number(newDot.supervisorId) : undefined,
        start_date: newDot.startDate,
      });
      setShowAddDot(false);
      setNewDot({
        orderCode: availableOrders[0]?.code ?? "",
        position: "",
        supervisorId: "",
        recruiterId: worker?.recruiterId ? String(worker.recruiterId) : "",
        startDate: new Date().toISOString().slice(0, 10),
      });
      setDotErrors({});
      await reloadDots();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Thêm đợt thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const openCloseDot = (placementId: number, startDate: string, company: string, position: string) => {
    setClosingDot({ placementId, startDate, company, position });
    const today = new Date().toISOString().slice(0, 10);
    const defaultEnd = today >= startDate ? today : startDate;
    setCloseForm({ endDate: defaultEnd, endReason: "Kết thúc đợt" });
    setCloseErrors({});
    setCloseError("");
  };

  const submitCloseDot = async () => {
    if (!closingDot) return;
    setCloseError("");
    const parsed = ClosePlacementSchema.safeParse({
      startDate: closingDot.startDate,
      endDate: closeForm.endDate,
      endReason: closeForm.endReason,
    });
    if (!parsed.success) {
      setCloseErrors(formatZodErrors(parsed.error));
      return;
    }
    setCloseErrors({});
    setBusy(true);
    try {
      await closeLivePlacement(closingDot.placementId, closeForm.endDate, closeForm.endReason);
      setClosingDot(null);
      await reloadDots();
    } catch (e) {
      setCloseError(e instanceof ApiError ? e.message : "Kết thúc đợt thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const handleHandover = async (placementId: number, action: "hand-over" | "receive") => {
    setError("");
    try {
      const full = (liveDots ?? []).find((d) => d.placement_id === placementId);
      const actionName = action === "hand-over" ? "bàn giao" : "tiếp nhận";
      const receiverName = window.prompt(`Nhập tên người ${actionName}:`, full?.supervisor_name || worker.name);
      if (!receiverName) return;
      await handoverAction(placementId, action, { received_by_name: receiverName });
      await reloadDots();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Thao tác bàn giao thất bại.");
    }
  };

  const saveAdvance = async () => {
    const amount = parseInt(advAmount, 10);
    if (!amount || amount <= 0) {
      setAdvError("Số tiền tạm ứng phải lớn hơn 0");
      return;
    }
    setAdvError("");
    const period = periods.find((p) => p.code === periodCode);
    if (!period) {
      setError("Chưa chọn kỳ lương.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createLiveAdvance({ worker_id: worker.id, period_id: period.id, amount, reason: `Tạm ứng cho ${worker.name}` });
      setAdvAmount("");
      setAdvError("");
      const rows = await fetchLivePayroll(period.code, worker.code);
      setLivePay(rows[0] ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Tạo tạm ứng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
      open
      onClose={onClose}
      wide
      title="Hồ Sơ Chi Tiết Người Lao Động"
      badge={<StatusPill tone="info">{activeWorker.code}</StatusPill>}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="outline" onClick={() => setEditingProfile(true)}>
            Chỉnh sửa hồ sơ
          </Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#0b4c8f] to-[#0052cc] p-4 text-white">
        <Avatar tone={activeWorker.avatarColor} size="lg">{activeWorker.initials}</Avatar>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-bold">{activeWorker.name}</h2>
            <StatusPill tone={statusToneForWorker(activeWorker.status)}>{activeWorker.status}</StatusPill>
            <StatusPill tone={activeWorker.type === "Thời vụ" ? "warning" : "info"}>{activeWorker.type}</StatusPill>
          </div>
          <div className="mt-0.5 text-[12.5px] text-blue-100">
            Doanh nghiệp: <strong>{activeWorker.company} Việt Nam</strong> · Vị trí: {activeWorker.position} · Phụ trách: {activeWorker.recruiter}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
        {([["personal", "1. Hồ Sơ & Ảnh CCCD"], ["job", "2. Điều Phối & Công Việc"], ["payroll", "3. Chấm Công & Tạm Ứng"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn("flex-1 rounded-md px-3 py-1.5 text-[13px] font-semibold", tab === id ? "bg-white text-[#0052cc] shadow" : "text-slate-500 hover:text-slate-800")}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}

      {tab === "personal" && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[13.5px] sm:grid-cols-3">
          {[
            ["Họ và tên", activeWorker.name],
            ["Mã NLĐ", activeWorker.code],
            ["Số điện thoại", activeWorker.phone],
            ["Số CCCD (12 số)", maskCitizenId(activeWorker.citizenId, access.canViewCccd)],
            ["Quê quán", activeWorker.hometown],
            ["Địa chỉ thường trú", `${activeWorker.hometown}, Việt Nam`],
            ["Người tuyển dụng", activeWorker.recruiter || "—"],
            ["Người nhập hồ sơ", activeWorker.creator || "Hệ thống"],
            ["Thời gian nhập", activeWorker.createdAt ? new Date(activeWorker.createdAt).toLocaleDateString("vi-VN") : "—"],
            ["Quản lý đón hiện tại", activeWorker.supervisorName ? `${activeWorker.supervisorName} (${activeWorker.supervisorPhone})` : "Chưa phân công"],
            ["Đầu mối liên hệ nhà máy", currentCompany?.contact_name ? `${currentCompany.contact_name} (${currentCompany.hotline || currentCompany.contact_phone || "—"})` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
              <div className="text-[11.5px] text-slate-500">{k}:</div>
              <div className="font-semibold text-slate-900">{v}</div>
            </div>
          ))}
          {!access.canViewCccd && (
            <div className="col-span-full rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              Chế độ xem bảo mật: vai trò hiện tại bị giới hạn quyền CCCD_VIEW, số định danh đã che mờ.
            </div>
          )}
          {access.canViewCccd && <WorkerDocuments workerId={worker.id} />}
        </div>
      )}

      {tab === "job" && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[14px] font-bold text-slate-900">Lịch sử các đợt làm việc ({assignments.length || 1})</h4>
            <Button size="sm" variant="outline" onClick={() => setShowAddDot((v) => !v)}>+ Thêm đợt (chuyển / quay lại)</Button>
          </div>
          {showAddDot && (
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <Field label="Đơn hàng *" error={dotErrors.orderCode}>
                <select
                  className={getInputClass(dotErrors.orderCode)}
                  value={newDot.orderCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    const ord = availableOrders.find((o) => o.code === code);
                    const pos = availablePositions.find((p) => p.order_id === ord?.order_id);
                    setNewDot((d) => ({ ...d, orderCode: code, position: pos?.title || "" }));
                    setDotErrors((prev) => {
                      const next = { ...prev };
                      delete next.orderCode;
                      return next;
                    });
                  }}
                >
                  <option value="">— Chọn đơn hàng —</option>
                  {availableOrders.map((o) => (
                    <option key={o.order_id} value={o.code}>
                      {o.code} · {o.company} – {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vị trí tuyển dụng">
                {currentPositions.length > 0 ? (
                  <select
                    className={inputClass}
                    value={newDot.position}
                    onChange={(e) => setNewDot((d) => ({ ...d, position: e.target.value }))}
                  >
                    <option value="">— Vị trí theo đơn —</option>
                    {currentPositions.map((p, idx) => (
                      <option key={`${p.order_id}-${idx}`} value={p.title}>
                        {p.title} (chỉ tiêu: {p.target_qty})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={newDot.position}
                    onChange={(e) => setNewDot((d) => ({ ...d, position: e.target.value }))}
                    placeholder="VD: Công nhân lắp ráp"
                  />
                )}
              </Field>
              <Field label="Người tuyển dụng đợt này">
                <select
                  className={inputClass}
                  value={newDot.recruiterId}
                  onChange={(e) => setNewDot((d) => ({ ...d, recruiterId: e.target.value }))}
                >
                  <option value="">— Mặc định theo hồ sơ —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quản lý trực tiếp đón NLĐ">
                <select
                  className={inputClass}
                  value={newDot.supervisorId}
                  onChange={(e) => setNewDot((d) => ({ ...d, supervisorId: e.target.value }))}
                >
                  <option value="">— Chọn người đón tại nhà máy —</option>
                  {currentSupervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} · {s.phone} {s.title ? `(${s.title})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ngày vào *" error={dotErrors.startDate}>
                <input
                  type="date"
                  className={getInputClass(dotErrors.startDate)}
                  value={newDot.startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewDot((d) => ({ ...d, startDate: val }));
                    setDotErrors((prev) => {
                      const next = { ...prev };
                      delete next.startDate;
                      return next;
                    });
                  }}
                />
              </Field>
              {currentCompany && (
                <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-[12px] text-blue-900">
                  <span className="font-semibold">Đầu mối liên hệ nhà máy ({currentCompany.short_name}):</span>{" "}
                  {currentCompany.contact_name ? (
                    <>
                      <strong>{currentCompany.contact_name}</strong> · SĐT/Hotline: <strong>{currentCompany.contact_phone || currentCompany.hotline || "—"}</strong>
                    </>
                  ) : (
                    <span>Chưa cập nhật thông tin đầu mối liên hệ</span>
                  )}
                </div>
              )}
              <div className="col-span-2">
                <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void saveDot()}>
                  {busy ? "Đang lưu..." : "Lưu đợt mới (tự kết thúc đợt đang làm)"}
                </Button>
              </div>
            </div>
          )}
          {liveDots !== null && liveDots.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[13px] text-slate-400">
              Chưa có đợt làm việc nào trong hệ thống.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {assignments.map((a, i) => {
              const full = (liveDots ?? []).find((d) => String(d.placement_id) === a.id);
              const hStatus = full?.handover_status;
              const comp = companies.find((c) => c.short_name === a.company);
              const compContact = full?.company_contact || comp?.contact_name;
              const compPhone = full?.company_contact_phone || comp?.contact_phone || comp?.hotline;
              const recName = full?.recruiter || a.recruiter || activeWorker.recruiter;
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-3 text-[13px]">
                  <span className="font-bold text-[#0052cc]">Đợt {assignments.length - i}</span>
                  <strong>{a.company}</strong>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">{a.orderCode}</code>
                  <span className="text-slate-500">{a.position}</span>
                  <span className="text-slate-500">Vào: <strong className="text-slate-700">{a.startDate}</strong></span>
                  <span className="text-slate-500">
                    Kết thúc: {a.endDate ? (
                      <strong className="text-slate-700">{a.endDate}</strong>
                    ) : (
                      <span className="text-slate-400 italic">(để trống)</span>
                    )}
                  </span>
                  {full?.end_reason && (
                    <span className="text-[11.5px] text-slate-500">({full.end_reason})</span>
                  )}
                  {recName && (
                    <span className="rounded-md bg-purple-50 px-2 py-0.5 text-purple-700">
                      Tuyển dụng: <strong>{recName}</strong>
                    </span>
                  )}
                  {full?.supervisor_name && (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">
                      Người đón: <strong>{full.supervisor_name} ({full.supervisor_phone})</strong>
                    </span>
                  )}
                  {(compContact || compPhone) && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                      Đầu mối NM: <strong>{compContact || "—"} ({compPhone || "—"})</strong>
                    </span>
                  )}
                  {hStatus === "pending" && (
                    <span className="flex items-center gap-1">
                      <StatusPill tone="warning">Chờ bàn giao</StatusPill>
                      <button
                        type="button"
                        onClick={() => void handleHandover(Number(a.id), "hand-over")}
                        className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200"
                      >
                        Bàn giao ngay
                      </button>
                    </span>
                  )}
                  {hStatus === "handed_over" && (
                    <span className="flex items-center gap-1">
                      <StatusPill tone="info">Đã bàn giao</StatusPill>
                      <button
                        type="button"
                        onClick={() => void handleHandover(Number(a.id), "receive")}
                        className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-200"
                      >
                        Xác nhận nhận
                      </button>
                    </span>
                  )}
                  {hStatus === "received" && (
                    <StatusPill tone="success">Đã tiếp nhận</StatusPill>
                  )}
                  {full && (
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[12px]"
                      value={full.stage}
                      onChange={(e) => void (async () => {
                        setError("");
                        try {
                          await setPlacementStage(full.placement_id, e.target.value);
                          await reloadDots();
                        } catch (err) {
                          setError(err instanceof ApiError ? err.message : "Đổi bước thất bại.");
                        }
                      })()}
                    >
                      <option value="applied">Mới ứng tuyển</option>
                      <option value="interview">Hẹn phỏng vấn</option>
                      <option value="waiting_start">Chờ đi làm</option>
                      <option value="working">Đang làm</option>
                    </select>
                  )}
                  {a.endDate === null ? (
                    <span className="ml-auto flex items-center gap-2">
                      <StatusPill tone="success">Đang làm</StatusPill>
                      <HandoverInvite placementId={Number(a.id)} />
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-rose-600 hover:underline"
                        onClick={() => openCloseDot(Number(a.id), a.startDate, a.company, a.position)}
                      >
                        Kết thúc đợt
                      </button>
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-rose-600 hover:underline"
                        onClick={() => void (async () => {
                          if (!window.confirm("Xóa đợt làm việc này?")) return;
                          setError("");
                          try {
                            await deleteLivePlacement(Number(a.id));
                            await reloadDots();
                          } catch (err) {
                            setError(err instanceof ApiError ? err.message : "Xóa đợt thất bại.");
                          }
                        })()}
                      >
                        Xóa đợt
                      </button>
                    </span>
                  ) : (
                    <StatusPill tone="neutral" className="ml-auto">Đã kết thúc</StatusPill>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "payroll" && (
        <div className="mt-3 flex flex-col gap-4">
          {livePay ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [`SỐ NGÀY CÔNG (${periodCode || "kỳ"})`, `${num(livePay.work_days)} ngày`, "Từ bảng lương"],
                ["LƯƠNG THEO CÔNG", formatVND(num(livePay.wage_amount)), `Phụ cấp: ${formatVND(num(livePay.extra_amount))} · Trừ: ${formatVND(num(livePay.deduction))}`],
                ["ĐÃ TẠM ỨNG", formatVND(num(livePay.advance_amount)), "Đã giải ngân"],
                ["THỰC NHẬN", formatVND(num(livePay.net_amount)), livePay.has_variance ? "⚠ Lệch với chấm công" : "Khớp chấm công"],
              ].map(([k, v, s]) => (
                <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="text-[11px] font-semibold text-slate-500">{k}</div>
                  <div className="text-[16px] font-bold text-slate-900">{v}</div>
                  <div className="text-[11.5px] text-slate-400">{s}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[13px] text-slate-400">Chưa có dòng lương cho kỳ {periodCode || "đang chọn"}.</p>
          )}

          {placementPay.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h5 className="mb-2 text-[13px] font-bold text-slate-800">
                Lương theo từng đợt làm việc trong kỳ ({placementPay.length} đợt)
              </h5>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b bg-slate-50 text-[11.5px] text-slate-500">
                      <th className="p-2">Công ty</th>
                      <th className="p-2">Đơn & Vị trí</th>
                      <th className="p-2">Giai đoạn</th>
                      <th className="p-2">Số ngày làm</th>
                      <th className="p-2">Đơn giá/ngày</th>
                      <th className="p-2 text-right">Tiền lương đợt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placementPay.map((p, idx) => (
                      <tr key={`${p.placement_id}-${idx}`} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="p-2 font-semibold text-slate-800">{p.company}</td>
                        <td className="p-2"><code>{p.order_code}</code> · {p.position}</td>
                        <td className="p-2 text-slate-600">{p.first_day} → {p.last_day}</td>
                        <td className="p-2 font-bold text-blue-700">{num(p.work_days)} ngày</td>
                        <td className="p-2">{formatVND(num(p.daily_rate))}</td>
                        <td className="p-2 text-right font-bold text-emerald-600">{formatVND(num(p.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 p-3">
              <input
                suppressHydrationWarning
                value={advAmount}
                onChange={(e) => {
                  setAdvAmount(e.target.value);
                  setAdvError("");
                }}
                inputMode="numeric"
                placeholder="Số tiền tạm ứng"
                className={cn(
                  "w-44 rounded-lg px-3 py-1.5 text-[13px] outline-none transition-colors",
                  advError
                    ? "border border-rose-500 ring-2 ring-rose-500/20"
                    : "border border-slate-200 focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/20",
                )}
              />
              <Button size="sm" variant="outline" onClick={() => void saveAdvance()}>
                {busy ? "Đang lưu..." : "+ Tạo tạm ứng"}
              </Button>
            </div>
            {advError && <p className="mt-1 px-3 text-[11.5px] font-medium text-rose-600">{advError}</p>}
          </div>
        </div>
      )}
      </Modal>
      {editingProfile && activeWorker && (
        <EditWorkerModal
          worker={activeWorker}
          onClose={() => setEditingProfile(false)}
          onSaved={() => {
            setEditingProfile(false);
            void fetchLiveWorkers({ q: activeWorker.code, limit: 1 })
              .then((res) => {
                const found = res.rows.find((r) => r.id === activeWorker.id) ?? res.rows[0];
                if (found) setCurrentWorker(toWorker(found));
              })
              .catch(() => {});
          }}
        />
      )}
      {closingDot && (
        <Modal
          open
          onClose={() => setClosingDot(null)}
          title="Kết Thúc Đợt Làm Việc"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setClosingDot(null)}>
                Hủy bỏ
              </Button>
              <Button
                className="bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => void submitCloseDot()}
              >
                {busy ? "Đang xử lý..." : "Xác nhận kết thúc đợt"}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[13px] leading-relaxed">
              <div>Doanh nghiệp: <strong>{closingDot.company}</strong></div>
              <div>Vị trí: <strong>{closingDot.position}</strong></div>
              <div>Ngày vào làm việc: <strong className="text-blue-700">{closingDot.startDate}</strong></div>
              <p className="mt-1 text-[11.5px] text-slate-500">
                * Đợt đang làm trước đó để trống ngày kết thúc. Khi kết thúc đợt, ngày kết thúc bắt buộc không được trước ngày vào ({closingDot.startDate}).
              </p>
            </div>

            <Field label="Ngày kết thúc *" error={closeErrors.endDate}>
              <input
                type="date"
                min={closingDot.startDate}
                className={getInputClass(closeErrors.endDate)}
                value={closeForm.endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setCloseForm((f) => ({ ...f, endDate: val }));
                  setCloseErrors((prev) => {
                    const next = { ...prev };
                    delete next.endDate;
                    return next;
                  });
                }}
              />
            </Field>

            <Field label="Lý do kết thúc">
              <select
                className={inputClass}
                value={closeForm.endReason}
                onChange={(e) => setCloseForm((f) => ({ ...f, endReason: e.target.value }))}
              >
                <option value="Kết thúc đợt">Kết thúc đợt</option>
                <option value="Hết hạn hợp đồng đơn hàng">Hết hạn hợp đồng đơn hàng</option>
                <option value="Tự xin nghỉ việc">Tự xin nghỉ việc</option>
                <option value="Chuyển sang công ty khác">Chuyển sang công ty khác</option>
                <option value="Công ty cắt giảm / cho nghỉ">Công ty cắt giảm / cho nghỉ</option>
                <option value="Lý do cá nhân / gia đình">Lý do cá nhân / gia đình</option>
              </select>
            </Field>

            {closeError && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">
                {closeError}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
