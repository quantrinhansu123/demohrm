"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import {
  addLivePlacement,
  closeLivePlacement,
  createLiveAdvance,
  fetchLiveAdvances,
  fetchLiveAssignments,
  toWorkAssignment,
} from "@/lib/live";
import type { LiveAdvance, LiveAssignmentRow } from "@/lib/live";
import { formatVND, maskCitizenId } from "@/lib/format";
import { currentMonthCode } from "@/lib/advance-months";
import { todayInput } from "@/lib/cashbook";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill, statusToneForWorker } from "@/components/ui/badge";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { SuggestInput } from "@/components/ui/suggest-input";
import { HandoverInvite } from "@/components/workers/HandoverInvite";
import { SearchableStaffSelect } from "@/components/ui/searchable-staff-select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Worker } from "@/types/hrm";

interface ProfileDraft {
  name: string;
  phone: string;
  citizenId: string;
  hometown: string;
  address: string;
  introducer: string;
  manager: string;
  sourceKind: "" | "Vendor" | "CTV";
  sourceName: string;
  note: string;
  images: string[];
}

function profileKey(code: string): string {
  return `tw-worker-profile:${code}`;
}

function loadProfile(worker: Worker, canViewCccd: boolean): ProfileDraft {
  const base: ProfileDraft = {
    name: worker.name,
    phone: worker.phone,
    citizenId: canViewCccd ? worker.citizenId : maskCitizenId(worker.citizenId, false),
    hometown: worker.hometown,
    address: worker.hometown ? `${worker.hometown}, Việt Nam` : "",
    introducer: worker.introducer,
    manager: worker.manager,
    sourceKind: "",
    sourceName: "",
    note: "",
    images: [],
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(profileKey(worker.code));
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<ProfileDraft>;
    const sourceKind = saved.sourceKind === "Vendor" || saved.sourceKind === "CTV" ? saved.sourceKind : "";
    return { ...base, ...saved, sourceKind, sourceName: saved.sourceName ?? "", images: saved.images ?? [] };
  } catch {
    return base;
  }
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Không đọc được ảnh."));
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Không xử lý được ảnh."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function WorkerProfilePane({ worker, canViewCccd }: { worker: Worker; canViewCccd: boolean }) {
  const { companies } = useApp();
  const canViewPhone = !worker.phoneHidden;
  const sourceOptions = ["Trangway", ...companies.map((company) => company.short_name).filter((name) => name && name.toLowerCase() !== "trangway")];
  const [form, setForm] = useState<ProfileDraft>(() => loadProfile(worker, canViewCccd));
  const [hint, setHint] = useState("");
  const [prevCode, setPrevCode] = useState(worker.code);
  if (worker.code !== prevCode) {
    setPrevCode(worker.code);
    setForm(loadProfile(worker, canViewCccd));
    setHint("");
  }

  const save = (next: ProfileDraft) => {
    setForm(next);
    localStorage.setItem(profileKey(worker.code), JSON.stringify(next));
  };

  const addImages = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    const urls = await Promise.all(images.map((file) => readImageFile(file)));
    save({ ...form, images: [...form.images, ...urls] });
    setHint(`Đã thêm ${urls.length} ảnh.`);
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      void addImages(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h4 className="text-[13px] font-bold text-slate-800">Nội dung hồ sơ</h4>
        <Field label="Họ và tên"><input className={inputClass} value={form.name} onChange={(e) => save({ ...form, name: e.target.value })} /></Field>
        <Field label="Số điện thoại">
          <input
            className={inputClass}
            value={form.phone}
            readOnly={!canViewPhone}
            onChange={(e) => {
              if (!canViewPhone) return;
              save({ ...form, phone: e.target.value });
            }}
          />
        </Field>
        <Field label="Số CCCD">
          <input className={inputClass} value={form.citizenId} onChange={(e) => save({ ...form, citizenId: e.target.value })} readOnly={!canViewCccd} />
        </Field>
        <Field label="Quê quán"><input className={inputClass} value={form.hometown} onChange={(e) => save({ ...form, hometown: e.target.value })} /></Field>
        <Field label="Địa chỉ thường trú"><input className={inputClass} value={form.address} onChange={(e) => save({ ...form, address: e.target.value })} /></Field>
        <Field label="Người giới thiệu"><input className={inputClass} value={form.introducer} onChange={(e) => save({ ...form, introducer: e.target.value })} placeholder="Tên người giới thiệu" /></Field>
        <Field label="Người quản lý"><input className={inputClass} value={form.manager} onChange={(e) => save({ ...form, manager: e.target.value })} placeholder="Tên người quản lý" /></Field>
        <Field label="Nguồn">
          <SuggestInput
            value={form.sourceName || form.sourceKind}
            onChange={(sourceName) => save({ ...form, sourceName, sourceKind: "" })}
            suggestions={sourceOptions}
            createLabel="Thêm mã nguồn"
            placeholder="Mã tên công ty, ví dụ Trangway"
          />
        </Field>
        <Field label="Ghi chú">
          <textarea className={inputClass} rows={4} value={form.note} onChange={(e) => save({ ...form, note: e.target.value })} placeholder="Gõ nội dung hồ sơ..." />
        </Field>
        {!canViewPhone && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">Số điện thoại đang bị che — chỉ người nhập hồ sơ, người phụ trách, HCNS hoặc ban lãnh đạo/kỹ thuật được xem.</p>
        )}
        {!canViewCccd && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">Số CCCD đang bị che vì tài khoản không có quyền xem.</p>
        )}
      </div>

      <div
        className="flex min-h-[280px] flex-col rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 outline-none focus:border-[#0052cc]"
        tabIndex={0}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
          if (files.length === 0) return;
          event.preventDefault();
          event.stopPropagation();
          void addImages(files);
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-[13px] font-bold text-slate-800">Ảnh hồ sơ</h4>
          <label className="cursor-pointer rounded-lg bg-[#0052cc] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[#0747a6]">
            Tải ảnh từ máy
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void addImages(files);
              }}
            />
          </label>
        </div>
        <p className="text-[12px] text-slate-500">Bấm vào cột này rồi nhấn Ctrl+V để dán ảnh, hoặc tải từ máy tính.</p>
        {hint && <p className="mt-1 text-[12px] font-medium text-emerald-700">{hint}</p>}
        {form.images.length === 0 ? (
          <div className="mt-3 grid flex-1 place-items-center rounded-lg border border-dashed border-slate-200 bg-white text-[13px] text-slate-400">
            Chưa có ảnh
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {form.images.map((src, index) => (
              <div key={`${index}-${src.slice(0, 24)}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-36 w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => save({ ...form, images: form.images.filter((_, i) => i !== index) })}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/80 text-white"
                  aria-label="Xóa ảnh"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function currentTimeInput(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatAdvanceWhen(row: LiveAdvance): string {
  const [year, month, day] = (row.advance_date || "").slice(0, 10).split("-");
  const date = year && month && day ? `${day}/${month}/${year}` : row.advance_date || "—";
  return `${date} ${(row.advance_time || "").slice(0, 5) || "—"}`;
}

export function WorkerDetailModal({
  worker,
  onClose,
}: {
  worker: Worker | null;
  onClose: () => void;
}) {
  const { access } = useSession();
  const canEditWorker = access.canEditWorker;
  const { staff } = useApp();
  const [tab, setTab] = useState<"personal" | "job" | "payroll">("personal");
  const [showAddDot, setShowAddDot] = useState(false);
  const [newDot, setNewDot] = useState({ orderCode: "", position: "", startDate: new Date().toISOString().slice(0, 10) });
  const [advDate, setAdvDate] = useState(todayInput);
  const [advMonth, setAdvMonth] = useState(currentMonthCode);
  const [advTime, setAdvTime] = useState(currentTimeInput);
  const [advAmount, setAdvAmount] = useState("");
  const [advReason, setAdvReason] = useState("");
  const [advStaffId, setAdvStaffId] = useState<number | null>(null);
  const [advPhoto, setAdvPhoto] = useState("");
  const [advances, setAdvances] = useState<LiveAdvance[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [liveDots, setLiveDots] = useState<LiveAssignmentRow[] | null>(null);

  const workerId = worker?.id ?? 0;

  const reloadDots = async () => {
    if (!workerId) return;
    try {
      setLiveDots(await fetchLiveAssignments(workerId));
    } catch {
      setLiveDots(null);
    }
  };

  useEffect(() => {
    if (tab === "job") void reloadDots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, workerId]);

  useEffect(() => {
    if (tab !== "payroll" || !workerId) return;
    let alive = true;
    fetchLiveAdvances(workerId)
      .then((rows) => {
        if (alive) setAdvances(rows);
      })
      .catch(() => {
        if (alive) setAdvances([]);
      });
    return () => {
      alive = false;
    };
  }, [tab, workerId]);

  if (!worker) return null;
  const assignments = (liveDots ?? []).map(toWorkAssignment);

  const saveDot = async () => {
    if (!newDot.orderCode.trim() || !newDot.startDate) return;
    setBusy(true);
    setError("");
    try {
      await addLivePlacement({
        worker_id: worker.id,
        order_code: newDot.orderCode.trim(),
        position: newDot.position.trim() || undefined,
        start_date: newDot.startDate,
      });
      setShowAddDot(false);
      setNewDot({ orderCode: "", position: "", startDate: new Date().toISOString().slice(0, 10) });
      await reloadDots();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Thêm đợt thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const closeDot = async (placementId: number, startDate: string) => {
    const end = window.prompt("Nhập ngày kết thúc đợt (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
    if (!end) return;
    if (end < startDate) {
      window.alert("Ngày kết thúc không được trước ngày vào.");
      return;
    }
    setError("");
    try {
      await closeLivePlacement(placementId, end, "Kết thúc đợt");
      await reloadDots();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Kết thúc đợt thất bại.");
    }
  };

  const saveAdvance = async () => {
    const amount = Number(advAmount.replace(/\D/g, ""));
    if (!amount || amount <= 0) {
      setError("Nhập số tiền tạm ứng.");
      return;
    }
    if (!advMonth) {
      setError("Chọn tháng tạm ứng.");
      return;
    }
    if (!advDate) {
      setError("Chọn ngày tạm ứng.");
      return;
    }
    if (!advTime) {
      setError("Chọn giờ tạm ứng.");
      return;
    }
    if (!advReason.trim()) {
      setError("Nhập lý do.");
      return;
    }
    if (!advStaffId) {
      setError("Chọn người tạm ứng.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createLiveAdvance({
        worker_id: worker.id,
        amount,
        reason: advReason.trim(),
        advance_date: advDate,
        advance_month: advMonth,
        advance_time: `${advTime}:00`,
        requested_by: advStaffId,
        evidence: advPhoto || undefined,
      });
      setAdvAmount("");
      setAdvReason("");
      setAdvPhoto("");
      setAdvDate(todayInput());
      setAdvMonth(currentMonthCode());
      setAdvTime(currentTimeInput());
      setAdvances(await fetchLiveAdvances(worker.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Tạo tạm ứng thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Hồ Sơ Chi Tiết Người Lao Động"
      badge={<StatusPill tone="info">{worker.code}</StatusPill>}
      footer={<Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={onClose}>Đóng</Button>}
    >
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#0b4c8f] to-[#0052cc] p-4 text-white">
        <Avatar tone={worker.avatarColor} size="lg">{worker.initials}</Avatar>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[18px] font-bold">{worker.name}</h2>
            <StatusPill tone={statusToneForWorker(worker.status)}>{worker.status}</StatusPill>
            <StatusPill tone={worker.type === "Thời vụ" ? "warning" : "info"}>{worker.type}</StatusPill>
          </div>
          <div className="mt-0.5 text-[12.5px] text-blue-100">
            Doanh nghiệp: <strong>{worker.company} Việt Nam</strong> · Vị trí: {worker.position} · Sale: {worker.recruiter || "—"} · Phụ trách: {worker.manager || "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
        {([["personal", "1. Hồ Sơ & Ảnh CCCD"], ["job", "2. Điều Phối & Công Việc"], ["payroll", "3. Tạm ứng"]] as const).map(([id, label]) => (
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
        <WorkerProfilePane worker={worker} canViewCccd={access.canViewCccd} />
      )}

      {tab === "job" && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[14px] font-bold text-slate-900">Lịch sử các đợt làm việc ({assignments.length || 1})</h4>
            {canEditWorker ? (
              <Button size="sm" variant="outline" onClick={() => setShowAddDot((v) => !v)}>+ Thêm đợt (chuyển / quay lại)</Button>
            ) : null}
          </div>
          {canEditWorker && showAddDot && (
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              <Field label="Mã đơn hàng *"><input suppressHydrationWarning className={inputClass} value={newDot.orderCode} onChange={(e) => setNewDot({ ...newDot, orderCode: e.target.value })} placeholder="VD: DH-2610-OJTEK" /></Field>
              <Field label="Vị trí (để trống = vị trí đầu của đơn)"><input suppressHydrationWarning className={inputClass} value={newDot.position} onChange={(e) => setNewDot({ ...newDot, position: e.target.value })} placeholder="VD: QC ngoại quan" /></Field>
              <Field label="Ngày vào *"><input suppressHydrationWarning type="date" className={inputClass} value={newDot.startDate} onChange={(e) => setNewDot({ ...newDot, startDate: e.target.value })} /></Field>
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
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-3 text-[13px]">
                  <span className="font-bold text-[#0052cc]">Đợt {assignments.length - i}</span>
                  <strong>{a.company}</strong>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px]">{a.orderCode}</code>
                  <span className="text-slate-500">{a.position}</span>
                  <span className="text-slate-500">Vào: <strong className="text-slate-700">{a.startDate}</strong></span>
                  <span className="text-slate-500">Kết thúc: <strong className="text-slate-700">{a.endDate ?? "— đang làm —"}</strong></span>
                  {full?.supervisor_name && (
                    <span className="text-slate-500">Đón: <strong className="text-slate-700">{full.supervisor_name} ({full.supervisor_phone})</strong></span>
                  )}
                  {full?.handover_status && full.handover_status !== "received" && (
                    <StatusPill tone="warning">Bàn giao: {full.handover_status}</StatusPill>
                  )}
                  {a.endDate === null ? (
                    <span className="ml-auto flex items-center gap-2">
                      <StatusPill tone="success">Đang làm</StatusPill>
                      {canEditWorker ? <HandoverInvite placementId={Number(a.id)} /> : null}
                      {canEditWorker ? (
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-rose-600 hover:underline"
                          onClick={() => void closeDot(Number(a.id), a.startDate)}
                        >
                          Kết thúc đợt
                        </button>
                      ) : null}
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
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tháng tạm ứng *">
              <MonthYearPicker value={advMonth} onChange={setAdvMonth} placeholder="mm/yyyy" />
            </Field>
            <Field label="Ngày chi / tạm ứng *">
              <input suppressHydrationWarning type="date" className={inputClass} value={advDate} onChange={(e) => setAdvDate(e.target.value)} />
            </Field>
            <Field label="Giờ tạm ứng *">
              <input suppressHydrationWarning type="time" className={inputClass} value={advTime} onChange={(e) => setAdvTime(e.target.value)} />
            </Field>
            <Field label="Số tiền *">
              <input suppressHydrationWarning value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} inputMode="numeric" placeholder="Ví dụ: 500000" className={inputClass} />
            </Field>
            <Field label="Lý do *">
              <input suppressHydrationWarning value={advReason} onChange={(e) => setAdvReason(e.target.value)} placeholder="Ví dụ: Ứng tiền ăn" className={inputClass} />
            </Field>
            <Field label="Người tạm ứng *">
              <SearchableStaffSelect value={advStaffId} onChange={setAdvStaffId} staff={staff} placeholder="Chọn nhân sự" />
            </Field>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh bằng chứng (không bắt buộc)</span>
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg bg-[#0052cc] px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#0747a6]">
                  Chụp ảnh
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      void readImageFile(file).then(setAdvPhoto).catch(() => setError("Không đọc được ảnh."));
                    }}
                  />
                </label>
                <span className="text-[12px] text-slate-500">Mở camera điện thoại để chụp bằng chứng.</span>
              </div>
              {advPhoto && (
                <div className="relative mt-2 w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={advPhoto} alt="Ảnh bằng chứng tạm ứng" className="h-28 w-40 rounded-lg object-cover" />
                  <button type="button" onClick={() => setAdvPhoto("")} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/80 text-white" aria-label="Xóa ảnh">×</button>
                </div>
              )}
            </div>
          </div>
          <div>
            <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void saveAdvance()}>
              {busy ? "Đang lưu..." : "Lưu tạm ứng"}
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {advances.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[13px] text-slate-400">Chưa có tạm ứng.</p>
            ) : advances.map((row) => (
              <article key={row.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-100 p-3">
                {row.evidence_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.evidence_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-[11px] text-slate-400">Không ảnh</div>
                )}
                <div className="min-w-0 flex-1 text-[13px]">
                  <div className="font-semibold text-slate-900">{formatAdvanceWhen(row)} · {formatVND(Number(row.amount) || 0)}</div>
                  <div className="text-slate-600">{row.reason || "—"}</div>
                  <div className="text-[12px] text-slate-500">Người đưa tiền: {row.giver_name || "—"} · {row.status}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
