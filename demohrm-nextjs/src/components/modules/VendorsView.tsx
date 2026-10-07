"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { createLiveReconciliation, createLiveVendor, createLiveVendorQuota, deleteLiveVendor, deleteLiveVendorQuota, fetchLiveVendorQuotas, fetchLiveVendors, patchLiveVendor, patchLiveVendorQuota } from "@/lib/live";
import type { LiveVendor, LiveVendorQuota } from "@/lib/live";
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

export function VendorsView() {
  const { companies, periods, periodCode } = useApp();
  const period = periods.find((p) => p.code === periodCode);
  const [vendors, setVendors] = useState<LiveVendor[]>([]);
  const [quotas, setQuotas] = useState<LiveVendorQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"quota" | "reconcile" | "vendor" | null>(null);
  const [editingVendor, setEditingVendor] = useState<LiveVendor | null>(null);
  const [editingQuota, setEditingQuota] = useState<LiveVendorQuota | null>(null);
  const [vendorForm, setVendorForm] = useState({ code: "", name: "", shortName: "", representative: "", phone: "", fee: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ vendorId: "", companyId: "", qty: "10", sla: "85", deadline: "", actual: "", note: "", date: todayVN() });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, q] = await Promise.all([fetchLiveVendors(), fetchLiveVendorQuotas()]);
      setVendors(v);
      setQuotas(q);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được vendor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openVendor = (row?: LiveVendor) => {
    setFormError("");
    setEditingVendor(row ?? null);
    setVendorForm({
      code: row?.code ?? "",
      name: row?.name ?? "",
      shortName: row?.short_name ?? "",
      representative: row?.representative ?? "",
      phone: row?.phone ?? "",
      fee: row?.fee_per_worker_day != null ? String(row.fee_per_worker_day) : "",
    });
    setMode("vendor");
  };

  const open = (next: "quota" | "reconcile", quota?: LiveVendorQuota) => {
    setEditingQuota(quota ?? null);
    setFormError("");
    setForm({
      vendorId: vendors[0] ? String(vendors[0].id) : "",
      companyId: companies[0] ? String(companies[0].id) : "",
      qty: quota ? String(quota.quota_qty) : "10",
      sla: quota?.sla_target_pct != null ? String(quota.sla_target_pct) : "85",
      deadline: quota?.handover_deadline ?? period?.end_date ?? "",
      actual: "",
      note: "",
      date: todayVN(),
    });
    setMode(next);
  };

  const save = async () => {
    if (mode === "vendor") {
      if (!vendorForm.code.trim() || !vendorForm.name.trim()) return;
      setBusy(true);
      setFormError("");
      try {
        const payload = {
          code: vendorForm.code.trim(),
          name: vendorForm.name.trim(),
          short_name: vendorForm.shortName.trim() || null,
          representative: vendorForm.representative.trim() || null,
          phone: vendorForm.phone.trim() || null,
          fee_per_worker_day: vendorForm.fee ? Number(vendorForm.fee) : null,
          contract_active: true,
        };
        if (editingVendor) await patchLiveVendor(editingVendor.id, payload);
        else await createLiveVendor({ ...payload, type: "external", status: "good" });
        setMode(null);
        await load();
      } catch (e) {
        setFormError(e instanceof ApiError ? e.message : "Lưu vendor thất bại.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!form.vendorId || !form.companyId || !period) return;
    setBusy(true);
    setFormError("");
    try {
      if (mode === "quota" && editingQuota) {
        await patchLiveVendorQuota(editingQuota.id, {
          quota_qty: Number(form.qty) || 0,
          sla_target_pct: Number(form.sla) || null,
          handover_deadline: form.deadline || null,
        });
      } else if (mode === "quota") {
        await createLiveVendorQuota({
          vendor_id: Number(form.vendorId),
          company_id: Number(form.companyId),
          period_id: period.id,
          quota_qty: Number(form.qty) || 0,
          sla_target_pct: Number(form.sla) || null,
          handover_deadline: form.deadline || null,
        });
      } else {
        await createLiveReconciliation({
          vendor_id: Number(form.vendorId),
          company_id: Number(form.companyId),
          period_id: period.id,
          work_date: form.date,
          quota_qty: Number(form.qty) || 0,
          actual_qty: Number(form.actual) || 0,
          note: form.note.trim() || null,
        });
      }
      setMode(null);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Lưu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const quotaSum = quotas.reduce((s, q) => s + q.quota_qty, 0);
  const active = vendors.filter((v) => v.contract_active).length;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Vendor và hạn mức"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => open("reconcile")}>Đối soát</Button>
            <Button size="sm" variant="outline" onClick={() => open("quota")}>+ Hạn mức</Button>
            <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => openVendor()}>+ Đối tác</Button>
          </>
        }
      />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="ĐỐI TÁC" value={<>{vendors.length}</>} sub={`${active} hợp đồng hiệu lực`} />
            <KpiCard title="HẠN MỨC ĐÃ CẤP" value={<>{quotaSum}</>} sub={`${quotas.length} dòng hạn mức`} />
            <KpiCard title="SLA TRUNG BÌNH" value={`${quotas.length ? Math.round(quotas.reduce((s, q) => s + (q.sla_target_pct ?? 0), 0) / quotas.length) : 0}%`} sub="Mục tiêu trên hạn mức" />
          </div>
          <div className="mt-4">
            <DataTable headers={["Vendor", "Nhà máy", "Hạn mức", "SLA", "Hạn bàn giao", "Phụ trách", "SĐT", "Trạng thái", ""]}>
              {quotas.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.vendor?.short_name ?? q.vendor?.name ?? "—"}</strong></td>
                  <td>{q.company?.short_name ?? "—"}</td>
                  <td>{q.quota_qty}</td>
                  <td>{q.sla_target_pct ?? "—"}%</td>
                  <td>{q.handover_deadline ?? "—"}</td>
                  <td>{q.vendor?.representative ?? "—"}</td>
                  <td><code>{q.vendor?.phone ?? "—"}</code></td>
                  <td><StatusPill tone="info">{q.vendor?.status ?? "—"}</StatusPill></td>
                  <td>
                    <span className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => open("quota", q)}>Sửa</Button>
                      <Button variant="destructive" size="xs" onClick={() => void (async () => {
                        if (!window.confirm("Xóa hạn mức này?")) return;
                        try {
                          await deleteLiveVendorQuota(q.id);
                          await load();
                        } catch (e) {
                          window.alert(e instanceof ApiError ? e.message : "Xóa hạn mức thất bại.");
                        }
                      })()}>Xóa</Button>
                    </span>
                  </td>
                </tr>
              ))}
              {quotas.length === 0 && <EmptyRow colSpan={9} />}
            </DataTable>
          </div>
          <div className="mt-4">
        <DataTable headers={["Mã", "Đối tác", "Phụ trách", "SĐT", "Phí/ngày", ""]}>
          {vendors.map((v) => (
            <tr key={v.id}>
              <td><code>{v.code}</code></td>
              <td><strong>{v.short_name ?? v.name}</strong></td>
              <td>{v.representative ?? "—"}</td>
              <td><code>{v.phone ?? "—"}</code></td>
              <td>{v.fee_per_worker_day ?? "—"}</td>
              <td>
                <span className="flex gap-1">
                  <Button variant="outline" size="xs" onClick={() => openVendor(v)}>Sửa</Button>
                  <Button variant="destructive" size="xs" onClick={() => void (async () => {
                    if (!window.confirm(`Xóa vendor ${v.short_name ?? v.name}?`)) return;
                    try {
                      await deleteLiveVendor(v.id);
                      await load();
                    } catch (e) {
                      window.alert(e instanceof ApiError ? e.message : "Xóa vendor thất bại.");
                    }
                  })()}>Xóa</Button>
                </span>
              </td>
            </tr>
          ))}
          {vendors.length === 0 && <EmptyRow colSpan={6} />}
        </DataTable>
          </div>
        </div>
      </QueryState>
      <Modal open={mode !== null} onClose={() => setMode(null)} title={mode === "vendor" ? (editingVendor ? "Sửa đối tác" : "Thêm đối tác") : mode === "quota" ? (editingQuota ? "Sửa hạn mức" : "Cấp hạn mức vendor") : "Đối soát ca"} footer={<><Button variant="outline" onClick={() => setMode(null)}>Hủy</Button><Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>{busy ? "Đang lưu..." : "Lưu"}</Button></>}>
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        {mode === "vendor" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mã *"><input className={inputClass} value={vendorForm.code} onChange={(e) => setVendorForm({ ...vendorForm, code: e.target.value })} /></Field>
            <Field label="Tên *"><input className={inputClass} value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} /></Field>
            <Field label="Tên ngắn"><input className={inputClass} value={vendorForm.shortName} onChange={(e) => setVendorForm({ ...vendorForm, shortName: e.target.value })} /></Field>
            <Field label="Phụ trách"><input className={inputClass} value={vendorForm.representative} onChange={(e) => setVendorForm({ ...vendorForm, representative: e.target.value })} /></Field>
            <Field label="SĐT"><input className={inputClass} value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} /></Field>
            <Field label="Phí/ngày"><input className={inputClass} inputMode="numeric" value={vendorForm.fee} onChange={(e) => setVendorForm({ ...vendorForm, fee: e.target.value })} /></Field>
          </div>
        ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Vendor">
            <select className={inputClass} value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.short_name ?? v.name}</option>)}
            </select>
          </Field>
          <Field label="Nhà máy">
            <select className={inputClass} value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
          </Field>
          <Field label="Hạn mức"><input className={inputClass} inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
          {mode === "quota" ? (
            <>
              <Field label="SLA %"><input className={inputClass} inputMode="numeric" value={form.sla} onChange={(e) => setForm({ ...form, sla: e.target.value })} /></Field>
              <Field label="Hạn bàn giao"><input type="date" className={inputClass} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
            </>
          ) : (
            <>
              <Field label="Thực tế"><input className={inputClass} inputMode="numeric" value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} /></Field>
              <Field label="Ngày"><input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Ghi chú"><input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            </>
          )}
        </div>
        )}
      </Modal>
    </section>
  );
}
