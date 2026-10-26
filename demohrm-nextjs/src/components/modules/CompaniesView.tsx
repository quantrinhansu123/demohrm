"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { createLiveCompany, deleteLiveCompany, fetchLiveOrders, fetchLiveSites, fetchLiveWorkers, toWorker, updateLiveCompany } from "@/lib/live";
import type { CompanyWrite, LiveCompany, LiveOrderRow, LiveSite } from "@/lib/live";
import { workerStatusTone } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import type { Worker } from "@/types/hrm";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";

interface CompanyForm {
  code: string;
  short_name: string;
  name: string;
  contact_name: string;
  contact_phone: string;
  hotline: string;
  bill_rate_per_day: string;
}

function emptyForm(): CompanyForm {
  return { code: "", short_name: "", name: "", contact_name: "", contact_phone: "", hotline: "", bill_rate_per_day: "" };
}

function formFromCompany(company: LiveCompany): CompanyForm {
  return {
    code: company.code,
    short_name: company.short_name,
    name: company.name,
    contact_name: company.contact_name ?? "",
    contact_phone: company.contact_phone ?? "",
    hotline: company.hotline ?? "",
    bill_rate_per_day: company.bill_rate_per_day == null ? "" : String(company.bill_rate_per_day),
  };
}

function toWrite(form: CompanyForm): CompanyWrite {
  const rate = form.bill_rate_per_day.trim();
  return {
    code: form.code.trim(),
    short_name: form.short_name.trim(),
    name: form.name.trim(),
    contact_name: form.contact_name.trim() || null,
    contact_phone: form.contact_phone.trim() || null,
    hotline: form.hotline.trim() || null,
    bill_rate_per_day: rate ? Number(rate) : null,
  };
}

export function CompaniesView() {
  const { companies, periodCode, reloadCatalog } = useApp();
  const { access } = useSession();
  const canDelete = access.canDelete;
  const canEdit = access.canEditCompanies;
  const [orders, setOrders] = useState<LiveOrderRow[]>([]);
  const [sites, setSites] = useState<LiveSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LiveCompany | null>(null);
  const [viewing, setViewing] = useState<LiveCompany | null>(null);
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

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

  const handleDelete = async (company: LiveCompany) => {
    if (!window.confirm(`Xóa công ty ${company.short_name} (${company.code})?`)) return;
    try {
      await deleteLiveCompany(company.id);
      if (viewing?.id === company.id) setViewing(null);
      await reloadCatalog();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Xóa thất bại.");
    }
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Công ty"
        sub="Thêm, xem, sửa và xóa công ty"
        actions={
          canEdit ? (
            <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => setCreating(true)}>
              + Thêm mới
            </Button>
          ) : undefined
        }
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <DataTable headers={["Mã", "Tên", "Liên hệ", "Địa điểm", "Đang làm", "Chỉ tiêu", "Đơn giá/ngày", "Thao tác"]}>
            {companies.map((c) => {
              const mine = orders.filter((o) => o.company === c.short_name);
              const site = sites.find((s) => s.company_id === c.id);
              return (
                <tr key={c.id}>
                  <td><strong>{c.short_name}</strong></td>
                  <td>{c.name}</td>
                  <td>{c.contact_name ?? "—"} <span className="text-slate-400">{c.contact_phone ?? c.hotline ?? ""}</span></td>
                  <td>{site ? `${site.name} · ${site.address ?? ""}` : "—"}</td>
                  <td><StatusPill tone="info">{mine.reduce((s, o) => s + o.working_qty, 0)}</StatusPill></td>
                  <td>{mine.reduce((s, o) => s + o.target_qty, 0)}</td>
                  <td>{c.bill_rate_per_day ?? "—"}</td>
                  <td>
                    <CompanyMenu company={c} canEdit={canEdit} canDelete={canDelete} onView={setViewing} onEdit={setEditing} onDelete={handleDelete} />
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && <EmptyRow colSpan={8} text="Chưa có công ty" />}
          </DataTable>
        </div>
      </QueryState>
      <CompanyFormModal
        key={editing ? `edit-${editing.id}` : "create"}
        open={creating || editing !== null}
        company={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          void reloadCatalog();
        }}
      />
      <CompanyDetailModal
        company={viewing}
        site={viewing ? sites.find((s) => s.company_id === viewing.id) : undefined}
        orders={viewing ? orders.filter((order) => order.company === viewing.short_name) : []}
        canEdit={canEdit}
        canDelete={canDelete}
        onClose={() => setViewing(null)}
        onEdit={(company) => {
          setViewing(null);
          setEditing(company);
        }}
        onDelete={(company) => void handleDelete(company)}
      />
    </section>
  );
}

function CompanyMenu({
  company,
  canEdit,
  canDelete,
  onView,
  onEdit,
  onDelete,
}: {
  company: LiveCompany;
  canEdit: boolean;
  canDelete: boolean;
  onView: (company: LiveCompany) => void;
  onEdit: (company: LiveCompany) => void;
  onDelete: (company: LiveCompany) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 112 });
    setOpen((value) => !value);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
        aria-label="Thao tác công ty"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div ref={menuRef} className="fixed z-50 w-28 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={{ top: menuPos.top, left: menuPos.left }}>
          <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onView(company); }}>Xem</button>
          {canEdit && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onEdit(company); }}>Sửa</button>
          )}
          {canDelete && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50" onClick={() => { setOpen(false); void onDelete(company); }}>Xóa</button>
          )}
        </div>
      )}
    </div>
  );
}

function CompanyFields({ form, setForm }: { form: CompanyForm; setForm: (form: CompanyForm) => void }) {
  const set = (patch: Partial<CompanyForm>) => setForm({ ...form, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Mã">
        <input value={form.code} onChange={(e) => set({ code: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Tên ngắn">
        <input value={form.short_name} onChange={(e) => set({ short_name: e.target.value })} className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Tên công ty">
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
        </Field>
      </div>
      <Field label="Người liên hệ">
        <input value={form.contact_name} onChange={(e) => set({ contact_name: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Điện thoại">
        <input value={form.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Hotline">
        <input value={form.hotline} onChange={(e) => set({ hotline: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Đơn giá/ngày">
        <input value={form.bill_rate_per_day} onChange={(e) => set({ bill_rate_per_day: e.target.value })} inputMode="decimal" className={inputClass} />
      </Field>
    </div>
  );
}

function CompanyFormModal({
  open,
  company,
  onClose,
  onSaved,
}: {
  open: boolean;
  company: LiveCompany | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CompanyForm>(() => company ? formFromCompany(company) : emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!form.code.trim() || !form.short_name.trim() || !form.name.trim()) {
      setError("Nhập mã, tên ngắn và tên công ty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (company) await updateLiveCompany(company.id, toWrite(form));
      else await createLiveCompany(toWrite(form));
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không lưu được công ty.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={company ? `Sửa ${company.code}` : "Thêm công ty"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
        <CompanyFields form={form} setForm={setForm} />
      </div>
    </Modal>
  );
}

const ORDER_STATUS: Record<string, string> = {
  running: "Đang chạy",
  open: "Đang chạy",
  completed: "Đã hoàn thành",
  closed: "Đã đóng",
  draft: "Nháp",
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

type CompanyTab = "info" | "orders" | "people";

function CompanyDetailModal({
  company,
  site,
  orders,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: {
  company: LiveCompany | null;
  site?: LiveSite;
  orders: LiveOrderRow[];
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (company: LiveCompany) => void;
  onDelete: (company: LiveCompany) => void;
}) {
  const [tab, setTab] = useState<CompanyTab>("info");
  const [people, setPeople] = useState<Worker[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState("");

  useEffect(() => {
    setTab("info");
  }, [company?.id]);

  useEffect(() => {
    if (!company) return;
    let alive = true;
    setPeopleLoading(true);
    setPeopleError("");
    fetchLiveWorkers({ company: company.short_name, limit: 200 })
      .then((page) => {
        if (alive) setPeople(page.rows.map(toWorker));
      })
      .catch((e: unknown) => {
        if (alive) setPeopleError(e instanceof ApiError ? e.message : "Không tải được nhân sự.");
      })
      .finally(() => {
        if (alive) setPeopleLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [company]);

  const tabs: { id: CompanyTab; label: string; count?: number }[] = [
    { id: "info", label: "Thông tin" },
    { id: "orders", label: "Đơn hàng", count: orders.length },
    { id: "people", label: "Nhân sự", count: people.length },
  ];

  return (
    <Modal
      open={company !== null}
      onClose={onClose}
      wide
      title={company ? company.short_name : "Công ty"}
      footer={
        company ? (
          <>
            {canDelete && <Button variant="destructive" onClick={() => onDelete(company)}>Xóa</Button>}
            <Button variant="outline" onClick={onClose}>Đóng</Button>
            {canEdit && (
              <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => onEdit(company)}>Sửa</Button>
            )}
          </>
        ) : null
      }
    >
      {company && (
        <div>
          <div className="mb-4 flex gap-1 border-b">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={tab === item.id
                  ? "border-b-2 border-[#0052cc] px-3 py-2 text-[13px] font-semibold text-[#0052cc]"
                  : "border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-800"}
              >
                {item.label}{item.count != null ? ` (${item.count})` : ""}
              </button>
            ))}
          </div>
          {tab === "info" && (
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <div><dt className="text-slate-500">Mã</dt><dd className="font-semibold">{company.code}</dd></div>
              <div><dt className="text-slate-500">Tên ngắn</dt><dd className="font-semibold">{company.short_name}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Tên công ty</dt><dd className="font-semibold">{company.name}</dd></div>
              <div><dt className="text-slate-500">Người liên hệ</dt><dd>{company.contact_name || "—"}</dd></div>
              <div><dt className="text-slate-500">Điện thoại</dt><dd>{company.contact_phone || "—"}</dd></div>
              <div><dt className="text-slate-500">Hotline</dt><dd>{company.hotline || "—"}</dd></div>
              <div><dt className="text-slate-500">Đơn giá/ngày</dt><dd>{company.bill_rate_per_day ?? "—"}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Địa điểm</dt><dd>{site ? `${site.name}${site.address ? ` · ${site.address}` : ""}` : "—"}</dd></div>
            </dl>
          )}
          {tab === "orders" && (
            <DataTable headers={["Mã", "Tên đơn", "Thời gian", "Phụ trách", "Chỉ tiêu", "Đang làm", "Trạng thái"]}>
              {orders.map((order) => (
                <tr key={order.order_id}>
                  <td><strong>{order.code}</strong></td>
                  <td>{order.name}</td>
                  <td className="whitespace-nowrap">{formatDate(order.start_date)} – {formatDate(order.end_date)}</td>
                  <td className="whitespace-nowrap">{order.owner || "—"}</td>
                  <td>{order.target_qty}</td>
                  <td>{order.working_qty}</td>
                  <td className="whitespace-nowrap"><StatusPill tone={order.status === "running" || order.status === "open" ? "success" : "neutral"}>{ORDER_STATUS[order.status] ?? order.status}</StatusPill></td>
                </tr>
              ))}
              {orders.length === 0 && <EmptyRow colSpan={7} text="Công ty này chưa có đơn hàng" />}
            </DataTable>
          )}
          {tab === "people" && (
            <QueryState loading={peopleLoading} error={peopleError}>
              <DataTable headers={["Họ và tên", "Số ĐT", "Vị trí", "Sale", "Phụ trách", "Trạng thái"]}>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td><strong>{person.name}</strong></td>
                    <td className="whitespace-nowrap">{person.phone || "—"}</td>
                    <td>{person.position}</td>
                    <td className="whitespace-nowrap">{person.recruiter || "—"}</td>
                    <td className="whitespace-nowrap">{person.manager || "—"}</td>
                    <td className="whitespace-nowrap"><StatusPill tone={workerStatusTone(person.status)}>{person.status}</StatusPill></td>
                  </tr>
                ))}
                {people.length === 0 && <EmptyRow colSpan={6} text="Chưa có nhân sự tại công ty này" />}
              </DataTable>
            </QueryState>
          )}
        </div>
      )}
    </Modal>
  );
}
