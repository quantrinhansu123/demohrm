"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import {
  approveLiveAdvance,
  createLiveSalaryEntry,
  fetchLiveAdvances,
  fetchLivePayroll,
  fetchLiveSalaryEntries,
  fetchLiveWorkers,
  generateLivePayroll,
  patchLiveSalaryEntry,
} from "@/lib/live";
import type { LiveAdvance, LivePayrollRow, LiveSalaryEntry } from "@/lib/live";
import { formatVND, initialsOf } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";

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
  const { access } = useSession();
  const period = periods.find((p) => p.code === periodCode);
  const [rows, setRows] = useState<LivePayrollRow[]>([]);
  const [advances, setAdvances] = useState<LiveAdvance[]>([]);
  const [entries, setEntries] = useState<LiveSalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [workers, setWorkers] = useState<Array<{ id: number; label: string }>>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ workerId: "", type: "extra", days: "", rate: "", amount: "", content: "" });
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
      const [pay, adv, ents] = await Promise.all([
        fetchLivePayroll(periodCode),
        fetchLiveAdvances(period.id),
        fetchLiveSalaryEntries(period.id),
      ]);
      setRows(pay);
      setAdvances(adv);
      setEntries(ents);
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

  const openEntry = async () => {
    setEditingId(null);
    setFormError("");
    setOpen(true);
    try {
      const page = await fetchLiveWorkers({ statusEn: "working", limit: 100 });
      const opts = page.rows.map((w) => ({ id: w.id, label: `${w.code} - ${w.full_name}` }));
      setWorkers(opts);
      setForm({ workerId: opts[0] ? String(opts[0].id) : "", type: "extra", days: "", rate: "", amount: "", content: "" });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được NLĐ.");
    }
  };

  const openEditEntry = (e: LiveSalaryEntry) => {
    setEditingId(e.id);
    setFormError("");
    setForm({
      workerId: String(e.worker_id),
      type: e.entry_type ?? "extra",
      days: e.work_days == null ? "" : String(e.work_days),
      rate: e.daily_rate == null ? "" : String(e.daily_rate),
      amount: e.amount == null ? "" : String(e.amount),
      content: e.content ?? "",
    });
    setOpen(true);
  };

  const saveEntry = async () => {
    if (!period || !form.amount || (!editingId && !form.workerId)) return;
    setBusy(true);
    setFormError("");
    try {
      if (editingId) {
        await patchLiveSalaryEntry(editingId, {
          work_days: form.days ? Number(form.days) : null,
          daily_rate: form.rate ? Number(form.rate) : null,
          amount: Number(form.amount),
          content: form.content.trim() || null,
        });
        setOpen(false);
        await load();
        return;
      }
      await createLiveSalaryEntry({
        worker_id: Number(form.workerId),
        period_id: period.id,
        entry_type: form.type,
        work_days: form.days ? Number(form.days) : null,
        daily_rate: form.rate ? Number(form.rate) : null,
        amount: Number(form.amount),
        content: form.content.trim() || null,
        entry_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()),
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
          )}
          <DataTable headers={["Họ tên", "Công ty", "Ngày công", "Lương", "Phụ cấp", "Khấu trừ", "Tạm ứng", "Thực lĩnh"]}>
            {rows.map((w, i) => (
              <tr key={`${w.code}-${i}`}>
                <td>
                  <span className="flex items-center gap-2">
                    <Avatar tone="avatar-blue" size="sm">{initialsOf(w.full_name)}</Avatar>
                    <strong>{w.full_name}</strong>
                  </span>
                </td>
                <td>{w.companies ?? "—"}</td>
                <td><strong>{num(w.work_days)}</strong></td>
                <td>{formatVND(num(w.wage_amount))}</td>
                <td>{formatVND(num(w.extra_amount))}</td>
                <td>{formatVND(num(w.deduction))}</td>
                <td>{formatVND(num(w.advance_amount))}</td>
                <td><strong className="text-emerald-600">{formatVND(num(w.net_amount))}</strong></td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} text="Chưa có dòng lương trong kỳ này" />}
          </DataTable>
          {entries.length > 0 && (
            <DataTable headers={["Mã dòng", "NLĐ", "Loại", "Số tiền", "Nội dung", ""]}>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td><code>{e.code ?? e.id}</code></td>
                  <td>{e.worker_id}</td>
                  <td>{e.entry_type ?? "—"}</td>
                  <td>{formatVND(num(e.amount))}</td>
                  <td>{e.voided_at ? "Đã hủy" : (e.content ?? "—")}</td>
                  <td>{!e.voided_at && <span className="flex gap-2"><button type="button" className="text-[12px] font-semibold text-[#0052cc]" onClick={() => openEditEntry(e)}>Sửa</button><button type="button" className="text-[12px] font-semibold text-rose-600" onClick={() => void voidEntry(e.id)}>Hủy</button></span>}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      </QueryState>
      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Sửa dòng lương" : "Nhập dòng lương"} footer={<><Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button className={primaryBtn} onClick={() => void saveEntry()}>{busy ? "Đang lưu..." : "Lưu"}</Button></>}>
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {!editingId && (
            <>
              <Field label="Người lao động">
                <select className={inputClass} value={form.workerId} onChange={(e) => setForm({ ...form, workerId: e.target.value })}>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </Field>
              <Field label="Loại">
                <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="wage">Lương</option>
                  <option value="extra">Phụ cấp</option>
                  <option value="deduction">Khấu trừ</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Ngày công"><input className={inputClass} inputMode="decimal" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></Field>
          <Field label="Đơn giá ngày"><input className={inputClass} inputMode="numeric" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></Field>
          <Field label="Số tiền *"><input className={inputClass} inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Nội dung"><input className={inputClass} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
        </div>
      </Modal>
    </section>
  );
}
