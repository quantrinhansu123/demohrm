"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import type { LiveCashbookEntry, LiveStaff } from "@/lib/live";
import { currentMonthCode, monthCodeFromDate } from "@/lib/advance-months";
import { CASHBOOK_GROUPS, normalizeCashbookGroup, todayInput } from "@/lib/cashbook";
import { loadWorkerOptions } from "@/lib/worker-options";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { SuggestInput } from "@/components/ui/suggest-input";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { SearchableStaffSelect } from "@/components/ui/searchable-staff-select";
import { SearchableWorkerSelect } from "@/components/ui/searchable-worker-select";

type PayeeType = "" | "worker" | "staff";

export interface CashbookForm {
  entry_date: string;
  expense_month: string;
  content: string;
  company_name: string;
  amount: string;
  note: string;
  group_code: string;
  payee_type: PayeeType;
  worker_id: number | null;
  staff_id: number | null;
}

function emptyForm(defaultMonth?: string): CashbookForm {
  const entry_date = todayInput();
  return {
    entry_date,
    expense_month: defaultMonth || monthCodeFromDate(entry_date) || currentMonthCode(),
    content: "",
    company_name: "",
    amount: "",
    note: "",
    group_code: "office",
    payee_type: "",
    worker_id: null,
    staff_id: null,
  };
}

function formFromEntry(entry: LiveCashbookEntry): CashbookForm {
  const payee_type: PayeeType = entry.worker_id ? "worker" : entry.staff_id ? "staff" : "";
  return {
    entry_date: entry.entry_date,
    expense_month: entry.expense_month || monthCodeFromDate(entry.entry_date) || currentMonthCode(),
    content: entry.content,
    company_name: entry.company_name ?? "",
    amount: String(Math.round(Number(entry.amount) || 0)),
    note: entry.note ?? "",
    group_code: normalizeCashbookGroup(entry.group_code),
    payee_type,
    worker_id: entry.worker_id ?? null,
    staff_id: entry.staff_id ?? null,
  };
}

export function CashbookEntryModal({
  open,
  entry,
  companies,
  staff,
  defaultMonth,
  onClose,
  onSave,
}: {
  open: boolean;
  entry: LiveCashbookEntry | null;
  companies: string[];
  staff: LiveStaff[];
  defaultMonth?: string;
  onClose: () => void;
  onSave: (form: CashbookForm) => Promise<void>;
}) {
  const [form, setForm] = useState<CashbookForm>(entry ? formFromEntry(entry) : emptyForm(defaultMonth));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(entry ? formFromEntry(entry) : emptyForm(defaultMonth));
    setError("");
    // Prefetch options gọn vào cache — mở select không phải chờ tải hồ sơ đầy đủ.
    void loadWorkerOptions({ limit: 40, id: entry?.worker_id ?? null }).catch(() => undefined);
  }, [open, entry, defaultMonth]);

  const set = <K extends keyof CashbookForm>(field: K, value: CashbookForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setPayeeType = (payee_type: PayeeType) => {
    setForm((prev) => ({
      ...prev,
      payee_type,
      worker_id: payee_type === "worker" ? prev.worker_id : null,
      staff_id: payee_type === "staff" ? prev.staff_id : null,
    }));
  };

  const save = async () => {
    if (!form.expense_month) {
      setError("Chọn tháng chi.");
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
    if (form.payee_type === "worker" && !form.worker_id) {
      setError("Chọn công nhân nhận tiền.");
      return;
    }
    if (form.payee_type === "staff" && !form.staff_id) {
      setError("Chọn nhân sự nhận tiền.");
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
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tháng chi *">
          <MonthYearPicker value={form.expense_month} onChange={(v) => set("expense_month", v)} placeholder="mm/yyyy" />
        </Field>
        <Field label="Ngày chi *">
          <input type="date" className={inputClass} value={form.entry_date} onChange={(e) => set("entry_date", e.target.value)} />
        </Field>
        <Field label="Nhóm chi *">
          <select className={inputClass} value={form.group_code} onChange={(e) => set("group_code", e.target.value)}>
            {CASHBOOK_GROUPS.map((group) => (
              <option key={group.value} value={group.value}>{group.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Số tiền *">
          <input className={inputClass} inputMode="numeric" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="VD: 1110000" />
        </Field>
        <div className="col-span-2">
          <Field label="Nội dung *">
            <input className={inputClass} value={form.content} onChange={(e) => set("content", e.target.value)} placeholder="VD: Chi lương tuần, ghế văn phòng, tiền ăn trưa..." />
          </Field>
        </div>
        <Field label="Đối tượng nhận">
          <select className={inputClass} value={form.payee_type} onChange={(e) => setPayeeType(e.target.value as PayeeType)}>
            <option value="">Không chọn</option>
            <option value="worker">Công nhân</option>
            <option value="staff">Nhân sự</option>
          </select>
        </Field>
        <Field label="Họ tên người nhận">
          {form.payee_type === "worker" ? (
            <SearchableWorkerSelect
              value={form.worker_id}
              onChange={(id) => set("worker_id", id)}
              remote
              placeholder="Chọn công nhân"
              showAvatar={false}
            />
          ) : form.payee_type === "staff" ? (
            <SearchableStaffSelect
              value={form.staff_id}
              onChange={(id) => set("staff_id", id)}
              staff={staff}
              placeholder="Chọn nhân sự"
              showAvatar={false}
            />
          ) : (
            <input className={inputClass} disabled value="" placeholder="Chọn đối tượng nhận bên trái" />
          )}
        </Field>
        <Field label="Công ty">
          <SuggestInput
            value={form.company_name}
            onChange={(company) => set("company_name", company)}
            suggestions={companies}
            createLabel="Thêm mới"
            placeholder="Chọn hoặc gõ tên công ty"
          />
        </Field>
        <Field label="Ghi chú">
          <input className={inputClass} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Ghi chú thêm" />
        </Field>
      </div>
    </Modal>
  );
}
