"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { createLiveAdvance, updateLiveAdvance } from "@/lib/live";
import type { LiveAdvance, LiveStaff, LiveWorkerRow } from "@/lib/live";
import { formatVND } from "@/lib/format";
import { todayInput } from "@/lib/cashbook";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { SearchableStaffSelect } from "@/components/ui/searchable-staff-select";
import { SearchableWorkerSelect } from "@/components/ui/searchable-worker-select";

function currentTimeInput(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toTimeInput(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : currentTimeInput();
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

export function AdvanceModal({
  open,
  advance,
  workers,
  staff,
  currentStaffId,
  onClose,
  onSaved,
}: {
  open: boolean;
  advance: LiveAdvance | null;
  workers: LiveWorkerRow[];
  staff: LiveStaff[];
  currentStaffId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [subjectType, setSubjectType] = useState<"worker" | "staff">(advance?.subject_type === "staff" ? "staff" : "worker");
  const [workerId, setWorkerId] = useState<number | null>(advance?.worker_id ?? null);
  const [staffId, setStaffId] = useState<number | null>(advance?.staff_id ?? null);
  const [amount, setAmount] = useState(advance ? String(Math.round(Number(advance.amount) || 0)) : "");
  const [reason, setReason] = useState(advance?.reason ?? "");
  const [note, setNote] = useState(advance?.note ?? "");
  const [advanceDate, setAdvanceDate] = useState(advance?.advance_date ?? todayInput());
  const [advanceTime, setAdvanceTime] = useState(toTimeInput(advance?.advance_time));
  const [giverId, setGiverId] = useState<number | null>(advance?.requested_by ?? currentStaffId);
  const [evidence, setEvidence] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editing = Boolean(advance);

  const save = async () => {
    const value = Number(amount.replace(/\D/g, ""));
    if (!value || value <= 0) {
      setError("Nhập số tiền lớn hơn 0.");
      return;
    }
    if (!reason.trim()) {
      setError("Nhập lý do tạm ứng.");
      return;
    }
    if (subjectType === "worker" && !workerId) {
      setError("Chọn người lao động tạm ứng.");
      return;
    }
    if (subjectType === "staff" && !staffId) {
      setError("Chọn nhân viên tạm ứng.");
      return;
    }
    if (!advanceDate) {
      setError("Chọn ngày tạm ứng.");
      return;
    }
    if (!advanceTime) {
      setError("Chọn giờ tạm ứng.");
      return;
    }
    if (!giverId) {
      setError("Chọn người đưa tiền tạm ứng.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (advance) {
        await updateLiveAdvance(advance.id, {
          amount: value,
          reason: reason.trim(),
          advance_date: advanceDate,
          advance_time: `${advanceTime}:00`,
          note: note.trim() || null,
        });
      } else {
        await createLiveAdvance({
          subject_type: subjectType,
          worker_id: subjectType === "worker" ? workerId : null,
          staff_id: subjectType === "staff" ? staffId : null,
          amount: value,
          reason: reason.trim(),
          advance_date: advanceDate,
          advance_time: `${advanceTime}:00`,
          requested_by: giverId,
          note: note.trim() || null,
          evidence: evidence || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lưu phiếu tạm ứng thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={advance ? `Sửa phiếu tạm ứng ${advance.code}` : "Tạo phiếu tạm ứng"}
      wide
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" disabled={saving} onClick={() => void save()}>
            {saving ? "Đang lưu..." : "Lưu phiếu"}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}

      <div className="mb-4">
        <span className="mb-1 block text-[11.5px] font-medium text-slate-500">Đối tượng</span>
        <div className="flex gap-1">
          <Button
            variant={subjectType === "worker" ? "default" : "outline"}
            size="sm"
            disabled={editing}
            onClick={() => setSubjectType("worker")}
          >
            Người lao động
          </Button>
          <Button
            variant={subjectType === "staff" ? "default" : "outline"}
            size="sm"
            disabled={editing}
            onClick={() => setSubjectType("staff")}
          >
            Nhân viên
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {subjectType === "worker" ? (
          <div className="col-span-2">
            <Field label="Người lao động *">
              <SearchableWorkerSelect
                value={workerId}
                onChange={setWorkerId}
                workers={workers}
                placeholder="Chọn người lao động"
                disabled={editing}
              />
            </Field>
          </div>
        ) : (
          <div className="col-span-2">
            <Field label="Nhân viên *">
              <SearchableStaffSelect
                value={staffId}
                onChange={setStaffId}
                staff={staff}
                placeholder="Chọn nhân viên"
                disabled={editing}
              />
            </Field>
          </div>
        )}

        <Field label="Số tiền *">
          <input
            className={inputClass}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="VD: 2000000"
          />
        </Field>
        <Field label="Ngày tạm ứng *">
          <input
            type="date"
            className={inputClass}
            value={advanceDate}
            onChange={(e) => setAdvanceDate(e.target.value)}
          />
        </Field>

        <Field label="Giờ tạm ứng *">
          <input
            type="time"
            className={inputClass}
            value={advanceTime}
            onChange={(e) => setAdvanceTime(e.target.value)}
          />
        </Field>
        <Field label="Người đưa tiền *">
          <SearchableStaffSelect
            value={giverId}
            onChange={setGiverId}
            staff={staff}
            placeholder="Chọn người đưa tiền"
          />
        </Field>

        <div className="col-span-2">
          <Field label="Lý do tạm ứng *">
            <input
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Ứng tiền ăn, ứng tiền thuê trọ..."
            />
          </Field>
        </div>

        <div className="col-span-2">
          <Field label="Ghi chú">
            <input
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm"
            />
          </Field>
        </div>

        {!editing && (
          <div className="col-span-2">
            <span className="mb-1 block text-[12.5px] font-medium text-slate-600">
              Ảnh bằng chứng (không bắt buộc)
            </span>
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
                    void readImageFile(file).then(setEvidence).catch(() => setError("Không đọc được ảnh."));
                  }}
                />
              </label>
              <span className="text-[12px] text-slate-500">Dùng camera điện thoại để chụp bằng chứng.</span>
            </div>
            {evidence && (
              <div className="relative mt-2 w-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={evidence} alt="Ảnh bằng chứng tạm ứng" className="h-28 w-40 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setEvidence("")}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/80 text-white"
                  aria-label="Xóa ảnh"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        {editing && advance?.evidence_url && (
          <div className="col-span-2">
            <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh bằng chứng hiện tại</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={advance.evidence_url} alt="Ảnh bằng chứng tạm ứng" className="h-28 w-40 rounded-lg object-cover" />
          </div>
        )}

        {advance && (
          <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
            Phiếu hiện tại: <strong>{advance.code}</strong> · {formatVND(Number(advance.amount) || 0)}
          </div>
        )}
      </div>
    </Modal>
  );
}
