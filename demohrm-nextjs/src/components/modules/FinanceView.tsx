"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { createLiveFinance, deleteLiveFinance, fetchFinanceCategories, fetchLiveFinance, patchLiveFinance } from "@/lib/live";
import type { LiveFinanceTx } from "@/lib/live";
import { formatVND } from "@/lib/format";
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

export function FinanceView() {
  const { companies, periodCode, periods } = useApp();
  const [rows, setRows] = useState<LiveFinanceTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ type: "expense", categoryId: "", companyId: "", amount: "", description: "", date: todayVN() });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchLiveFinance();
      setRows(page.rows);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được sổ thu chi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openForm = async (row?: LiveFinanceTx) => {
    setFormError("");
    setEditingId(row?.id ?? null);
    setOpen(true);
    try {
      const cats = await fetchFinanceCategories();
      setCategories(cats);
      const matched = row ? cats.find((c) => c.name === row.category?.name) : cats[0];
      const company = row ? companies.find((c) => c.short_name === row.company?.short_name) : companies[0];
      setForm({
        type: row?.type === "income" ? "income" : "expense",
        categoryId: matched ? String(matched.id) : "",
        companyId: company ? String(company.id) : "",
        amount: row ? String(row.amount) : "",
        description: row?.description ?? "",
        date: row?.txn_date ?? todayVN(),
      });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được danh mục.");
    }
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.categoryId || !(amount > 0)) return;
    setBusy(true);
    setFormError("");
    try {
      const payload = {
        txn_date: form.date,
        type: form.type,
        category_id: Number(form.categoryId),
        company_id: form.companyId ? Number(form.companyId) : null,
        description: form.description.trim() || null,
        amount,
      };
      if (editingId) {
        await patchLiveFinance(editingId, payload);
      } else {
        const stamp = todayVN().replaceAll("-", "").slice(2);
        const period = periods.find((p) => p.code === periodCode);
        await createLiveFinance({
          ...payload,
          code: `GD-${stamp}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
          period_id: period?.id,
          status: "completed",
        });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Ghi sổ thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount || 0), 0);
  const expense = rows.filter((r) => r.type !== "income").reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title="Tài chính thu chi" sub="Số liệu từ sổ giao dịch" actions={<Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void openForm()}>+ Thêm phiếu</Button>} />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="TỔNG THU" value={formatVND(income)} valueClassName="text-emerald-600" sub={`${rows.filter((r) => r.type === "income").length} giao dịch`} />
            <KpiCard title="TỔNG CHI" value={formatVND(expense)} valueClassName="text-rose-600" sub={`${rows.filter((r) => r.type !== "income").length} giao dịch`} />
            <KpiCard title="CHÊNH LỆCH" value={formatVND(income - expense)} valueClassName="text-[#0052cc]" sub="Trên các dòng đang hiển thị" />
          </div>
          <div className="mt-4">
            <DataTable headers={["Mã", "Ngày", "Loại", "Danh mục", "Nội dung", "Đối tác", "Số tiền", "Trạng thái", ""]}>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><code>{t.code}</code></td>
                  <td>{t.txn_date}</td>
                  <td><StatusPill tone={t.type === "income" ? "success" : "danger"}>{t.type === "income" ? "Thu" : "Chi"}</StatusPill></td>
                  <td>{t.category?.name ?? "—"}</td>
                  <td>{t.description ?? "—"}</td>
                  <td>{t.company?.short_name ?? t.worker?.full_name ?? "—"}</td>
                  <td><strong className={t.type === "income" ? "text-emerald-600" : "text-rose-600"}>{formatVND(Number(t.amount))}</strong></td>
                  <td><StatusPill tone="info">{t.status}</StatusPill></td>
                  <td>
                    <span className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => void openForm(t)}>Sửa</Button>
                      <Button variant="destructive" size="xs" onClick={() => void (async () => {
                        if (!window.confirm(`Xóa phiếu ${t.code}?`)) return;
                        try {
                          await deleteLiveFinance(t.id);
                          await load();
                        } catch (e) {
                          window.alert(e instanceof ApiError ? e.message : "Xóa phiếu thất bại.");
                        }
                      })()}>Xóa</Button>
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow colSpan={9} />}
            </DataTable>
          </div>
        </div>
      </QueryState>
      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Sửa phiếu thu chi" : "Thêm phiếu thu chi"} footer={<><Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>{busy ? "Đang lưu..." : editingId ? "Lưu" : "Ghi sổ"}</Button></>}>
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Loại">
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="income">Thu</option>
              <option value="expense">Chi</option>
            </select>
          </Field>
          <Field label="Danh mục">
            <select className={inputClass} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Ngày"><input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Số tiền *"><input className={inputClass} inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Công ty">
            <select className={inputClass} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              <option value="">—</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
          </Field>
          <Field label="Nội dung"><input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </Modal>
    </section>
  );
}
