"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { createLiveVendor, deleteLiveVendor, fetchLiveVendorQuotas, fetchLiveVendors, updateLiveVendor } from "@/lib/live";
import type { LiveVendor, LiveVendorQuota, VendorWriteBody } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";

const TYPES = [{ value: "internal", label: "Nội bộ" }];

const STATUSES = [
  { value: "good", label: "Tốt" },
  { value: "suspended", label: "Tạm ngưng" },
];

function typeLabel(type: string | null): string {
  return TYPES.find((t) => t.value === type)?.label ?? type ?? "—";
}

function statusLabel(status: string | null): string {
  return STATUSES.find((s) => s.value === status)?.label ?? status ?? "—";
}

function statusTone(status: string | null): "success" | "warning" | "info" {
  if (status === "good") return "success";
  if (status === "suspended") return "warning";
  return "info";
}

function money(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(value);
}

interface VendorForm {
  code: string;
  name: string;
  short_name: string;
  type: string;
  representative: string;
  phone: string;
  fee_per_worker_day: string;
  contract_active: boolean;
  status: string;
}

function emptyForm(): VendorForm {
  return {
    code: "",
    name: "",
    short_name: "",
    type: "internal",
    representative: "",
    phone: "",
    fee_per_worker_day: "",
    contract_active: true,
    status: "good",
  };
}

function formFromVendor(vendor: LiveVendor): VendorForm {
  return {
    code: vendor.code,
    name: vendor.name,
    short_name: vendor.short_name ?? "",
    type: vendor.type ?? "",
    representative: vendor.representative ?? "",
    phone: vendor.phone ?? "",
    fee_per_worker_day: vendor.fee_per_worker_day == null ? "" : String(vendor.fee_per_worker_day),
    contract_active: vendor.contract_active !== false,
    status: vendor.status ?? "good",
  };
}

function toBody(form: VendorForm): VendorWriteBody {
  const fee = form.fee_per_worker_day.trim();
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    short_name: form.short_name.trim() || null,
    type: form.type.trim() || null,
    representative: form.representative.trim() || null,
    phone: form.phone.trim() || null,
    contract_active: form.contract_active,
    fee_per_worker_day: fee === "" ? null : Number(fee),
    status: form.status,
  };
}

export function VendorsView() {
  const [vendors, setVendors] = useState<LiveVendor[]>([]);
  const [quotas, setQuotas] = useState<LiveVendorQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LiveVendor | null>(null);
  const [viewing, setViewing] = useState<LiveVendor | null>(null);

  const reload = useCallback(async () => {
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
    void reload();
  }, [reload]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vendors;
    return vendors.filter((v) =>
      [v.code, v.name, v.short_name, v.representative, v.phone, v.type].some((field) =>
        (field ?? "").toLowerCase().includes(needle),
      ),
    );
  }, [query, vendors]);

  const handleDelete = async (vendor: LiveVendor) => {
    if (!window.confirm(`Xóa vendor ${vendor.name} (${vendor.code})?`)) return;
    try {
      await deleteLiveVendor(vendor.id);
      if (viewing?.id === vendor.id) setViewing(null);
      await reload();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Xóa thất bại.");
    }
  };

  const quotaSum = quotas.reduce((s, q) => s + q.quota_qty, 0);
  const active = vendors.filter((v) => v.contract_active).length;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Vendor và hạn mức"
        sub="Thêm, xem, sửa và xóa đối tác cung ứng"
        actions={
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mã, tên, SĐT..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
            <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => setCreating(true)}>
              + Thêm vendor
            </Button>
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
          <h2 className="mb-2 mt-5 text-[14px] font-bold text-slate-800">Danh sách vendor</h2>
          <DataTable headers={["Mã", "Tên", "Loại", "Phụ trách", "SĐT", "Phí/ngày", "Hợp đồng", "Trạng thái", "Thao tác"]}>
            {visible.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.code}</strong></td>
                <td>{v.short_name ? `${v.short_name} · ${v.name}` : v.name}</td>
                <td>{typeLabel(v.type)}</td>
                <td>{v.representative ?? "—"}</td>
                <td><code>{v.phone ?? "—"}</code></td>
                <td>{money(v.fee_per_worker_day)}</td>
                <td>
                  <StatusPill tone={v.contract_active ? "success" : "warning"}>
                    {v.contract_active ? "Hiệu lực" : "Hết hiệu lực"}
                  </StatusPill>
                </td>
                <td><StatusPill tone={statusTone(v.status)}>{statusLabel(v.status)}</StatusPill></td>
                <td>
                  <div className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => setViewing(v)}>Xem</Button>
                    <Button variant="outline" size="xs" onClick={() => setEditing(v)}>Sửa</Button>
                    <Button variant="destructive" size="xs" onClick={() => void handleDelete(v)}>Xóa</Button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && <EmptyRow colSpan={9} text="Chưa có vendor" />}
          </DataTable>
          <h2 className="mb-2 mt-6 text-[14px] font-bold text-slate-800">Hạn mức đã cấp</h2>
          <DataTable headers={["Vendor", "Nhà máy", "Hạn mức", "SLA", "Hạn bàn giao", "Phụ trách", "SĐT", "Trạng thái"]}>
            {quotas.map((q) => (
              <tr key={q.id}>
                <td><strong>{q.vendor?.short_name ?? q.vendor?.name ?? "—"}</strong></td>
                <td>{q.company?.short_name ?? "—"}</td>
                <td>{q.quota_qty}</td>
                <td>{q.sla_target_pct ?? "—"}%</td>
                <td>{q.handover_deadline ?? "—"}</td>
                <td>{q.vendor?.representative ?? "—"}</td>
                <td><code>{q.vendor?.phone ?? "—"}</code></td>
                <td><StatusPill tone={statusTone(q.vendor?.status ?? null)}>{statusLabel(q.vendor?.status ?? null)}</StatusPill></td>
              </tr>
            ))}
            {quotas.length === 0 && <EmptyRow colSpan={8} />}
          </DataTable>
        </div>
      </QueryState>
      <VendorFormModal
        key={editing ? `edit-${editing.id}` : creating ? "create" : "closed"}
        open={creating || editing !== null}
        title={editing ? `Sửa vendor ${editing.code}` : "Thêm vendor"}
        initial={editing ? formFromVendor(editing) : emptyForm()}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={async (form) => {
          const body = toBody(form);
          if (editing) await updateLiveVendor(editing.id, body);
          else await createLiveVendor(body);
          await reload();
        }}
      />
      <VendorDetailModal
        vendor={viewing}
        onClose={() => setViewing(null)}
        onEdit={(vendor) => {
          setViewing(null);
          setEditing(vendor);
        }}
        onDelete={(vendor) => void handleDelete(vendor)}
      />
    </section>
  );
}

function VendorFormModal({
  open,
  title,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: VendorForm;
  onClose: () => void;
  onSave: (form: VendorForm) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof VendorForm>(key: K, value: VendorForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.type.trim()) {
      setError("Nhập mã, tên và loại vendor.");
      return;
    }
    if (form.fee_per_worker_day.trim()) {
      const fee = Number(form.fee_per_worker_day);
      if (!Number.isFinite(fee) || fee < 0) {
        setError("Phí mỗi ngày không hợp lệ.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
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
        <Field label="Mã vendor *"><input className={inputClass} value={form.code} onChange={(e) => set("code", e.target.value)} /></Field>
        <Field label="Tên đầy đủ *"><input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Tên ngắn"><input className={inputClass} value={form.short_name} onChange={(e) => set("short_name", e.target.value)} /></Field>
        <Field label="Loại *">
          <select className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value)}>
            {TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            {!TYPES.some((t) => t.value === form.type) && form.type && <option value={form.type}>{form.type}</option>}
          </select>
        </Field>
        <Field label="Người phụ trách"><input className={inputClass} value={form.representative} onChange={(e) => set("representative", e.target.value)} /></Field>
        <Field label="Số điện thoại"><input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Phí / người / ngày"><input className={inputClass} inputMode="decimal" value={form.fee_per_worker_day} onChange={(e) => set("fee_per_worker_day", e.target.value)} /></Field>
        <Field label="Trạng thái">
          <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            {!STATUSES.some((s) => s.value === form.status) && <option value={form.status}>{form.status}</option>}
          </select>
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={form.contract_active} onChange={(e) => set("contract_active", e.target.checked)} />
          Hợp đồng còn hiệu lực
        </label>
      </div>
    </Modal>
  );
}

function VendorDetailModal({
  vendor,
  onClose,
  onEdit,
  onDelete,
}: {
  vendor: LiveVendor | null;
  onClose: () => void;
  onEdit: (vendor: LiveVendor) => void;
  onDelete: (vendor: LiveVendor) => void;
}) {
  return (
    <Modal
      open={vendor !== null}
      onClose={onClose}
      title={vendor ? vendor.name : "Vendor"}
      badge={vendor ? <StatusPill tone={statusTone(vendor.status)}>{statusLabel(vendor.status)}</StatusPill> : null}
      footer={
        vendor ? (
          <>
            <Button variant="destructive" onClick={() => onDelete(vendor)}>Xóa</Button>
            <Button variant="outline" onClick={onClose}>Đóng</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => onEdit(vendor)}>Sửa</Button>
          </>
        ) : null
      }
    >
      {vendor && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
          <Detail label="Mã" value={vendor.code} />
          <Detail label="Tên ngắn" value={vendor.short_name ?? "—"} />
          <Detail label="Loại" value={typeLabel(vendor.type)} />
          <Detail label="Người phụ trách" value={vendor.representative ?? "—"} />
          <Detail label="Số điện thoại" value={vendor.phone ?? "—"} />
          <Detail label="Phí / người / ngày" value={money(vendor.fee_per_worker_day)} />
          <Detail label="Hợp đồng" value={vendor.contract_active ? "Hiệu lực" : "Hết hiệu lực"} />
          <Detail label="Trạng thái" value={statusLabel(vendor.status)} />
        </dl>
      )}
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
