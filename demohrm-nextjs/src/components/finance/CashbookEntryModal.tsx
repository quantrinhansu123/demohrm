"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import type { LiveCashbookEntry } from "@/lib/live";
import { CASHBOOK_GROUPS, isAdvanceCashbookEntry, normalizeCashbookGroup, todayInput } from "@/lib/cashbook";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { SuggestInput } from "@/components/ui/suggest-input";

interface CashbookForm {
  entry_date: string;
  content: string;
  full_name: string;
  company_name: string;
  amount: string;
  note: string;
  group_code: string;
}

function emptyForm(): CashbookForm {
  return {
    entry_date: todayInput(),
    content: "",
    full_name: "",
    company_name: "",
    amount: "",
    note: "",
    group_code: "office",
  };
}

function formFromEntry(entry: LiveCashbookEntry): CashbookForm {
  return {
    entry_date: entry.entry_date,
    content: entry.content,
    full_name: entry.full_name ?? "",
    company_name: entry.company_name ?? "",
    amount: String(Math.round(Number(entry.amount) || 0)),
    note: entry.note ?? "",
    group_code: normalizeCashbookGroup(entry.group_code),
  };
}

export function CashbookEntryModal({
  open,
  entry,
  companies,
  onClose,
  onSave,
}: {
  open: boolean;
  entry: LiveCashbookEntry | null;
  companies: string[];
  onClose: () => void;
  onSave: (form: CashbookForm) => Promise<void>;
}) {
  const [form, setForm] = useState<CashbookForm>(entry ? formFromEntry(entry) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const locked = Boolean(entry && isAdvanceCashbookEntry(entry));

  useEffect(() => {
    if (!open) return;
    setForm(entry ? formFromEntry(entry) : emptyForm());
    setError("");
  }, [open, entry]);

  const set = <K extends keyof CashbookForm>(field: K, value: CashbookForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const save = async () => {
    if (locked) {
      setError("Khoản chi từ tạm ứng không được sửa trên sổ chi.");
      return;
    }
    if (!form.entry_date) {
      setError("Chọn ngày chi.");
      return;
    }
    if (!form.content.trim()) {
      setError("Nhập nội dung chi.");
      return;
    }
    const amount = Number(form.amount.replace(/[^\d]/g, ""));
    if (!amount || amount <= 0) {
      setError("Nhập số tiền lớn hơn 0.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, amount: String(amount) });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lưu khoản chi thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? `Sửa khoản chi #${entry.id}` : "Thêm khoản chi"}
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{locked ? "Đóng" : "Hủy"}</Button>
          {!locked && (
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          )}
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {locked && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Đây là khoản chi tự sinh từ tạm ứng — chỉ xem trên sổ chi. Chỉnh sửa/hủy trên màn Tạm ứng.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày chi *">
          <input type="date" className={inputClass} value={form.entry_date} disabled={locked} onChange={(e) => set("entry_date", e.target.value)} />
        </Field>
        <Field label="Nhóm chi *">
          <select
            className={inputClass}
            value={form.group_code}
            disabled={locked}
            onChange={(e) => set("group_code", e.target.value)}
          >
            {CASHBOOK_GROUPS.map((group) => (
              <option key={group.value} value={group.value}>{group.label}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="Nội dung *">
            <input className={inputClass} value={form.content} disabled={locked} onChange={(e) => set("content", e.target.value)} placeholder="VD: Chi lương tuần, ghế văn phòng, tiền ăn trưa..." />
          </Field>
        </div>
        <Field label="Họ tên người nhận">
          <input className={inputClass} value={form.full_name} disabled={locked} onChange={(e) => set("full_name", e.target.value)} placeholder="VD: Dương Văn Hải" />
        </Field>
        <Field label="Công ty">
          <SuggestInput
            value={form.company_name}
            onChange={(company) => set("company_name", company)}
            suggestions={companies}
            createLabel="Thêm mới"
            placeholder="Chọn hoặc gõ tên công ty"
            disabled={locked}
          />
        </Field>
        <Field label="Số tiền *">
          <input className={inputClass} inputMode="numeric" value={form.amount} disabled={locked} onChange={(e) => set("amount", e.target.value)} placeholder="VD: 1110000" />
        </Field>
        <Field label="Ghi chú">
          <input className={inputClass} value={form.note} disabled={locked} onChange={(e) => set("note", e.target.value)} placeholder="Ghi chú thêm" />
        </Field>
      </div>
    </Modal>
  );
}
