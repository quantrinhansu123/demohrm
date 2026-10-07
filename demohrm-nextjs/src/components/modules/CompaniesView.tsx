"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { createLiveCompany, createLiveSite, deleteLiveCompany, deleteLiveSite, fetchLiveOrders, fetchLiveSites, patchLiveCompany, patchLiveSite } from "@/lib/live";
import type { LiveCompany, LiveOrderRow, LiveSite } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";

export function CompaniesView() {
  const { companies, periodCode, reloadCatalog } = useApp();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<LiveCompany | null>(null);
  const [editingSite, setEditingSite] = useState<LiveSite | null>(null);
  const [siteCompanyId, setSiteCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [companyForm, setCompanyForm] = useState({ code: "", shortName: "", name: "", contact: "", phone: "", rate: "" });
  const [siteForm, setSiteForm] = useState({ name: "", address: "", lat: "", lng: "", radius: "" });
  const [orders, setOrders] = useState<LiveOrderRow[]>([]);
  const [sites, setSites] = useState<LiveSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  const reloadSites = useCallback(async () => {
    setSites(await fetchLiveSites());
  }, []);

  const openCompany = (row?: LiveCompany) => {
    setEditingCompany(row ?? null);
    setFormError("");
    setCompanyForm({
      code: row?.code ?? "",
      shortName: row?.short_name ?? "",
      name: row?.name ?? "",
      contact: row?.contact_name ?? "",
      phone: row?.contact_phone ?? row?.hotline ?? "",
      rate: row?.bill_rate_per_day != null ? String(row.bill_rate_per_day) : "",
    });
    setCompanyOpen(true);
  };

  const saveCompany = async () => {
    if (!companyForm.code.trim() || !companyForm.shortName.trim() || !companyForm.name.trim()) return;
    setBusy(true);
    setFormError("");
    try {
      const payload = {
        code: companyForm.code.trim(),
        short_name: companyForm.shortName.trim(),
        name: companyForm.name.trim(),
        contact_name: companyForm.contact.trim() || null,
        contact_phone: companyForm.phone.trim() || null,
        bill_rate_per_day: companyForm.rate ? Number(companyForm.rate) : null,
        status: "active",
      };
      if (editingCompany) await patchLiveCompany(editingCompany.id, payload);
      else await createLiveCompany(payload);
      setCompanyOpen(false);
      await reloadCatalog();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Lưu công ty thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const openSite = (companyId: number, site?: LiveSite) => {
    setSiteCompanyId(String(companyId));
    setEditingSite(site ?? null);
    setFormError("");
    setSiteForm({
      name: site?.name ?? "",
      address: site?.address ?? "",
      lat: site?.latitude != null ? String(site.latitude) : "",
      lng: site?.longitude != null ? String(site.longitude) : "",
      radius: site?.geofence_radius_m != null ? String(site.geofence_radius_m) : "",
    });
    setSiteOpen(true);
  };

  const saveSite = async () => {
    if (!siteForm.name.trim() || !siteForm.lat.trim() || !siteForm.lng.trim()) {
      setFormError("Nhập tên và tọa độ.");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      const payload = {
        name: siteForm.name.trim(),
        address: siteForm.address.trim() || null,
        latitude: Number(siteForm.lat),
        longitude: Number(siteForm.lng),
        geofence_radius_m: siteForm.radius ? Number(siteForm.radius) : null,
      };
      if (editingSite) await patchLiveSite(editingSite.id, payload);
      else await createLiveSite(Number(siteCompanyId), payload);
      setSiteOpen(false);
      await reloadSites();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Lưu địa điểm thất bại.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!periodCode) return;
    let alive = true;
    Promise.all([fetchLiveOrders(periodCode), fetchLiveSites()])
      .then(([orderRows, siteRows]) => {
        if (!alive) return;
        setOrders(orderRows);
        setSites(siteRows);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được công ty.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode]);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title="Công ty khách hàng" sub="Địa điểm và tiến độ đơn trong kỳ đang chọn" actions={<Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => openCompany()}>+ Thêm công ty</Button>} />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <DataTable headers={["Mã", "Tên", "Liên hệ", "Địa điểm", "Đang làm", "Chỉ tiêu", "Đơn giá/ngày", ""]}>
            {companies.map((c) => {
              const mine = orders.filter((o) => o.company === c.short_name);
              const site = sites.find((s) => s.company_id === c.id);
              return (
                <tr key={c.id}>
                  <td><strong>{c.short_name}</strong></td>
                  <td>{c.name}</td>
                  <td>{c.contact_name ?? "—"} <span className="text-slate-400">{c.contact_phone ?? c.hotline ?? ""}</span></td>
                  <td>
                    {site ? `${site.name} · ${site.address ?? ""}` : "—"}
                    <span className="mt-1 flex gap-2">
                      <button type="button" className="text-[12px] font-semibold text-[#0052cc]" onClick={() => openSite(c.id, site)}>{site ? "Sửa điểm" : "Thêm điểm"}</button>
                      {site && <button type="button" className="text-[12px] font-semibold text-rose-600" onClick={() => void (async () => {
                        if (!window.confirm(`Xóa địa điểm ${site.name}?`)) return;
                        try {
                          await deleteLiveSite(site.id);
                          await reloadSites();
                        } catch (e) {
                          window.alert(e instanceof ApiError ? e.message : "Xóa địa điểm thất bại.");
                        }
                      })()}>Xóa điểm</button>}
                    </span>
                  </td>
                  <td><StatusPill tone="info">{mine.reduce((s, o) => s + o.working_qty, 0)}</StatusPill></td>
                  <td>{mine.reduce((s, o) => s + o.target_qty, 0)}</td>
                  <td>{c.bill_rate_per_day ?? "—"}</td>
                  <td>
                    <span className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => openCompany(c)}>Sửa</Button>
                      <Button variant="destructive" size="xs" onClick={() => void (async () => {
                        if (!window.confirm(`Xóa công ty ${c.short_name}?`)) return;
                        try {
                          await deleteLiveCompany(c.id);
                          await reloadCatalog();
                        } catch (e) {
                          window.alert(e instanceof ApiError ? e.message : "Xóa công ty thất bại.");
                        }
                      })()}>Xóa</Button>
                    </span>
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && <EmptyRow colSpan={8} />}
          </DataTable>
        </div>
      </QueryState>
      <Modal open={companyOpen} onClose={() => setCompanyOpen(false)} title={editingCompany ? "Sửa công ty" : "Thêm công ty"} footer={<><Button variant="outline" onClick={() => setCompanyOpen(false)}>Hủy</Button><Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void saveCompany()}>{busy ? "Đang lưu..." : "Lưu"}</Button></>}>
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã *"><input className={inputClass} value={companyForm.code} onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })} /></Field>
          <Field label="Tên ngắn *"><input className={inputClass} value={companyForm.shortName} onChange={(e) => setCompanyForm({ ...companyForm, shortName: e.target.value })} /></Field>
          <Field label="Tên đầy đủ *"><input className={inputClass} value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} /></Field>
          <Field label="Người liên hệ"><input className={inputClass} value={companyForm.contact} onChange={(e) => setCompanyForm({ ...companyForm, contact: e.target.value })} /></Field>
          <Field label="Điện thoại"><input className={inputClass} value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} /></Field>
          <Field label="Đơn giá/ngày"><input className={inputClass} inputMode="numeric" value={companyForm.rate} onChange={(e) => setCompanyForm({ ...companyForm, rate: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={siteOpen} onClose={() => setSiteOpen(false)} title={editingSite ? "Sửa địa điểm" : "Thêm địa điểm"} footer={<><Button variant="outline" onClick={() => setSiteOpen(false)}>Hủy</Button><Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void saveSite()}>{busy ? "Đang lưu..." : "Lưu"}</Button></>}>
        {formError && !companyOpen && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3">
          <Field label="Tên *"><input className={inputClass} value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} /></Field>
          <Field label="Địa chỉ"><input className={inputClass} value={siteForm.address} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })} /></Field>
          <Field label="Vĩ độ *"><input className={inputClass} inputMode="decimal" value={siteForm.lat} onChange={(e) => setSiteForm({ ...siteForm, lat: e.target.value })} /></Field>
          <Field label="Kinh độ *"><input className={inputClass} inputMode="decimal" value={siteForm.lng} onChange={(e) => setSiteForm({ ...siteForm, lng: e.target.value })} /></Field>
          <Field label="Bán kính GPS (m)"><input className={inputClass} inputMode="numeric" value={siteForm.radius} onChange={(e) => setSiteForm({ ...siteForm, radius: e.target.value })} /></Field>
        </div>
      </Modal>
    </section>
  );
}
