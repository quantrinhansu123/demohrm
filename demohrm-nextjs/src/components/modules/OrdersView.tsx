"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { createLiveOrder, deleteLiveOrder, patchLiveOrder, createLiveWageRate, fetchLiveOrders, fetchLivePositions, fetchLiveSites, fetchPositionOptions, toOrderSummary } from "@/lib/live";
import type { LiveOrderRow, LivePositionOption, LiveSite } from "@/lib/live";
import type { OrderSummary as OrderCard } from "@/types/hrm";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { StatusPill, statusToneForHealth } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import { ApiError } from "@/lib/api";

const legendTone: Record<string, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-400",
  orange: "bg-amber-500",
  grey: "bg-slate-300",
};

const primaryBtn = "bg-[#0052cc] text-white hover:bg-[#0747a6]";

export function OrdersView() {
  const { periodCode, periods, companies, staff, teams } = useApp();
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [sources, setSources] = useState<LiveOrderRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [wageOpen, setWageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [sites, setSites] = useState<LiveSite[]>([]);
  const [positions, setPositions] = useState<LivePositionOption[]>([]);
  const period = periods.find((p) => p.code === periodCode);
  const [form, setForm] = useState({
    code: "",
    name: "",
    companyId: "",
    siteId: "",
    ownerId: "",
    teamId: "",
    start: "",
    end: "",
    target: "10",
    position: "",
    positionQty: "10",
    status: "running",
  });
  const [wage, setWage] = useState({ positionId: "", from: "", rate: "", dayRate: "", note: "" });
  const periodName = periods.find((p) => p.code === periodCode)?.name ?? periodCode;
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  const load = useCallback(async () => {
    if (!periodCode) return;
    setLoading(true);
    try {
      const [rows, positionRows] = await Promise.all([fetchLiveOrders(periodCode), fetchLivePositions()]);
      setSources(rows);
      setOrders(rows.map((r) => toOrderSummary(r, positionRows)));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [periodCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = async () => {
    setEditingId(null);
    setFormError("");
    setForm({
      code: "",
      name: "",
      companyId: companies[0] ? String(companies[0].id) : "",
      siteId: "",
      ownerId: staff[0] ? String(staff[0].id) : "",
      teamId: teams[0] ? String(teams[0].id) : "",
      start: period?.start_date ?? "",
      end: period?.end_date ?? "",
      target: "10",
      position: "",
      positionQty: "10",
      status: "running",
    });
    setOpen(true);
    try {
      const all = await fetchLiveSites();
      setSites(all);
      const companyId = companies[0]?.id;
      const first = all.find((s) => s.company_id === companyId);
      if (first) setForm((f) => ({ ...f, siteId: String(first.id) }));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được địa điểm.");
    }
  };

  const openEdit = (id: number) => {
    const row = sources.find((r) => r.order_id === id);
    if (!row) return;
    const company = companies.find((c) => c.short_name === row.company);
    setFormError("");
    setEditingId(id);
    setForm({
      code: row.code,
      name: row.name,
      companyId: company ? String(company.id) : "",
      siteId: "",
      ownerId: "",
      teamId: "",
      start: row.start_date,
      end: row.end_date,
      target: String(row.target_qty),
      position: "",
      positionQty: "10",
      status: row.status || "running",
    });
    setOpen(true);
  };

  const saveOrder = async () => {
    if (!period) {
      setFormError("Chưa chọn kỳ.");
      return;
    }
    if (!form.code.trim() || !form.name.trim() || !form.companyId || (!editingId && !form.position.trim())) {
      setFormError(editingId ? "Nhập mã đơn và tên đơn." : "Nhập mã đơn, tên đơn và vị trí tuyển.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      if (editingId) {
        await patchLiveOrder(editingId, {
          code: form.code.trim(),
          name: form.name.trim(),
          company_id: Number(form.companyId),
          start_date: form.start,
          end_date: form.end,
          target_qty: Number(form.target) || 0,
          status: form.status,
        });
        setOpen(false);
        setEditingId(null);
        await load();
        return;
      }
      await createLiveOrder({
        code: form.code.trim(),
        name: form.name.trim(),
        company_id: Number(form.companyId),
        work_site_id: form.siteId ? Number(form.siteId) : null,
        period_id: period.id,
        owner_staff_id: form.ownerId ? Number(form.ownerId) : null,
        team_id: form.teamId ? Number(form.teamId) : null,
        start_date: form.start,
        end_date: form.end,
        target_qty: Number(form.target) || 0,
        status: "running",
        positions: [{ title: form.position.trim(), target_qty: Number(form.positionQty) || 0 }],
      });
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Tạo đơn thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const openWage = async () => {
    setFormError("");
    setWageOpen(true);
    try {
      const rows = await fetchPositionOptions();
      setPositions(rows);
      setWage({ positionId: rows[0] ? String(rows[0].id) : "", from: period?.start_date ?? "", rate: "", dayRate: "", note: "" });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được vị trí.");
    }
  };

  const saveWage = async () => {
    if (!wage.positionId || !wage.from) return;
    setBusy(true);
    setFormError("");
    try {
      await createLiveWageRate(Number(wage.positionId), {
        effective_from: wage.from,
        wage_unit: "day",
        rate_amount: wage.rate ? Number(wage.rate) : null,
        day_rate: wage.dayRate ? Number(wage.dayRate) : null,
        note: wage.note.trim() || null,
      });
      setWageOpen(false);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Thêm đơn giá thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const removeOrder = async (order: OrderCard) => {
    if (!window.confirm(`Xóa đơn ${order.title} (${order.code})?`)) return;
    setError("");
    try {
      await deleteLiveOrder(order.id);
      await load();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Xóa đơn thất bại.");
    }
  };

  const companySites = sites.filter((s) => String(s.company_id) === form.companyId);

  const visible = useMemo(
    () => orders.filter((o) => o.title.toLowerCase().includes(query.toLowerCase().trim()) || o.code.toLowerCase().includes(query.toLowerCase().trim())),
    [query, orders]
  );

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Đơn hàng cung ứng"
        sub={periodName}
        actions={
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm đơn hàng..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
            <Button size="sm" variant="outline" onClick={() => void openWage()}>Đơn giá</Button>
            <Button size="sm" className={primaryBtn} onClick={() => void openCreate()}>+ Thêm đơn</Button>
          </>
        }
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body flex flex-col gap-4">
          {visible.map((o) => (
            <article key={o.id} className="grid gap-5 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-[1.1fr_1.2fr_1fr]">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <StatusPill tone={o.status === "Đang chạy" ? "success" : "neutral"}>{o.status}</StatusPill>
                  <span className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => openEdit(o.id)}>Sửa</Button>
                    <Button variant="destructive" size="xs" onClick={() => void removeOrder(o)}>Xóa</Button>
                  </span>
                </div>
                <h2 className="mt-2 text-[17px] font-bold text-slate-900">{o.title}</h2>
                <div className="text-[12.5px] text-slate-500">{o.code} · {o.period}</div>
                <div className="text-[12.5px] text-slate-500">Phụ trách: {o.manager}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Chỉ tiêu", `${o.target} người`],
                    ["Đã đi làm", `${o.working}`],
                    ["Vị trí tuyển", `${o.positions}`],
                    ["Vendor tham gia", `${o.vendors}`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <div className="text-[11px] text-slate-500">{k}</div>
                      <div className="font-bold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold text-slate-600">
                  <span>Vị trí tuyển chính</span>
                  <span className="font-normal text-slate-400">Tiến độ giao người</span>
                </div>
                <div className="flex flex-col gap-3">
                  {o.items.map((p) => {
                    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                    return (
                      <div key={p.idx}>
                        <div className="mb-1 flex items-center justify-between text-[13px]">
                          <span><span className="mr-1.5 font-bold text-[#0052cc]">{p.idx}</span>{p.name}</span>
                          <span className="text-slate-500">{p.done}/{p.total} · {pct}%</span>
                        </div>
                        <ProgressBar value={pct} tone="green" />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-[12.5px] font-semibold text-slate-600">Tổng quan hồ sơ ({o.totalProfiles})</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {o.funnel.map((f) => (
                    <div key={f.label} className="flex items-center gap-2 text-[13px] text-slate-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${legendTone[f.tone]}`} />
                      {f.label} ({f.value})
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2 text-[13px]">
                  <span className="text-slate-500">Tiến độ</span>
                  <StatusPill tone={statusToneForHealth(o.health)}>{o.health}</StatusPill>
                </div>
              </div>
            </article>
          ))}
          {visible.length === 0 && <p className="py-10 text-center text-slate-400">Không có đơn hàng trong kỳ này.</p>}
        </div>
      </QueryState>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Sửa đơn hàng" : "Thêm đơn hàng"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button className={primaryBtn} onClick={() => void saveOrder()}>{busy ? "Đang lưu..." : editingId ? "Lưu" : "Tạo đơn"}</Button></>}
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã đơn *"><input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DH-2610-WESUM" /></Field>
          <Field label="Tên đơn *"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Công ty *">
            <select className={inputClass} value={form.companyId} onChange={(e) => {
              const companyId = e.target.value;
              const site = sites.find((s) => String(s.company_id) === companyId);
              setForm({ ...form, companyId, siteId: site ? String(site.id) : "" });
            }}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
          </Field>
          {editingId && (
            <Field label="Trạng thái">
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Nháp</option>
                <option value="running">Đang chạy</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="closed">Đã đóng</option>
              </select>
            </Field>
          )}
          {!editingId && (
            <>
              <Field label="Địa điểm">
                <select className={inputClass} value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
                  <option value="">—</option>
                  {companySites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Phụ trách">
                <select className={inputClass} value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </Field>
              <Field label="Nhóm">
                <select className={inputClass} value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Từ ngày"><input type="date" className={inputClass} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
          <Field label="Đến ngày"><input type="date" className={inputClass} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
          <Field label="Chỉ tiêu đơn"><input className={inputClass} inputMode="numeric" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} /></Field>
          {!editingId && <Field label="Vị trí tuyển *"><input className={inputClass} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>}
          {!editingId && <Field label="Chỉ tiêu vị trí"><input className={inputClass} inputMode="numeric" value={form.positionQty} onChange={(e) => setForm({ ...form, positionQty: e.target.value })} /></Field>}
        </div>
      </Modal>
      <Modal
        open={wageOpen}
        onClose={() => setWageOpen(false)}
        title="Thêm đơn giá vị trí"
        footer={<><Button variant="outline" onClick={() => setWageOpen(false)}>Hủy</Button><Button className={primaryBtn} onClick={() => void saveWage()}>{busy ? "Đang lưu..." : "Lưu đơn giá"}</Button></>}
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3">
          <Field label="Vị trí">
            <select className={inputClass} value={wage.positionId} onChange={(e) => setWage({ ...wage, positionId: e.target.value })}>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Hiệu lực từ *"><input type="date" className={inputClass} value={wage.from} onChange={(e) => setWage({ ...wage, from: e.target.value })} /></Field>
          <Field label="Đơn giá"><input className={inputClass} inputMode="numeric" value={wage.rate} onChange={(e) => setWage({ ...wage, rate: e.target.value })} /></Field>
          <Field label="Lương ngày"><input className={inputClass} inputMode="numeric" value={wage.dayRate} onChange={(e) => setWage({ ...wage, dayRate: e.target.value })} /></Field>
          <Field label="Ghi chú"><input className={inputClass} value={wage.note} onChange={(e) => setWage({ ...wage, note: e.target.value })} /></Field>
        </div>
      </Modal>
    </section>
  );
}
