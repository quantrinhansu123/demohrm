"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import {
  VI_STATUS,
  VI_TYPE,
  checkLiveDuplicates,
  createLiveWorker,
  deleteLiveWorker,
  dupFieldLabel,
  fetchLiveWorkers,
  toWorker,
  updateLiveWorker,
} from "@/lib/live";
import type { DuplicateHit } from "@/lib/live";
import { maskCitizenId, workerStatusTone } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import type { Worker } from "@/types/hrm";

const STATUSES = ["Đang làm", "Chờ đi làm", "Tạm nghỉ", "Nghỉ việc", "Không đi làm", "Đang tư vấn"];
const PAGE = 50;

export function WorkersView({ onViewDetail }: { onViewDetail: (w: Worker) => void }) {
  const { companies } = useApp();
  const { access } = useSession();
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [closing, setClosing] = useState<Worker | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [qDebounced, company, status, type]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchLiveWorkers({
        company: company || undefined,
        statusEn: status ? VI_STATUS[status] : undefined,
        typeEn: type ? VI_TYPE[type] : undefined,
        q: qDebounced || undefined,
        limit: PAGE,
        offset,
      });
      setRows(page.rows.map(toWorker));
      setTotal(page.total);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được hồ sơ.");
    } finally {
      setLoading(false);
    }
  }, [company, status, type, qDebounced, offset]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleDelete = async (w: Worker) => {
    if (!window.confirm(`Xóa hồ sơ ${w.name} (${w.code})?`)) return;
    try {
      await deleteLiveWorker(w.id);
      await reload();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Xóa thất bại.");
    }
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Hồ sơ Người lao động"
        sub="Danh sách phân trang từ máy chủ"
        actions={
          <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => setOpenCreate(true)}>
            + Thêm người lao động
          </Button>
        }
      />
      <div className="page-body">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, SĐT" className="w-60 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]" />
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Tất cả công ty</option>
            {companies.map((c) => (<option key={c.id} value={c.short_name}>{c.short_name}</option>))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Tất cả trạng thái</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Loại: Tất cả</option>
            <option value="Thời vụ">Thời vụ</option>
            <option value="Chính thức">Chính thức</option>
          </select>
          <span className="ml-auto text-[13px] text-slate-500">Tổng số: <strong className="text-slate-900">{total}</strong></span>
        </div>
        <QueryState loading={loading} error={error}>
          <DataTable headers={["Ảnh & Họ và tên", "Số ĐT", "Quê quán", "CCCD / Định danh", "Công ty & Vị trí", "Loại hình", "Recruiter", "Trạng thái", "Thao tác"]}>
            {rows.map((w) => (
              <tr key={w.id}>
                <td>
                  <button type="button" onClick={() => onViewDetail(w)} className="flex items-center gap-2">
                    <Avatar tone={w.avatarColor} size="sm">{w.initials}</Avatar>
                    <strong className="text-slate-900 hover:text-[#0052cc] hover:underline">{w.name}</strong>
                  </button>
                </td>
                <td><code className="text-[13px]">{w.phone}</code></td>
                <td>{w.hometown}</td>
                <td><code>{maskCitizenId(w.citizenId, access.canViewCccd)}</code></td>
                <td><strong>{w.company}</strong> <span className="text-[11.5px] text-slate-400">({w.position})</span></td>
                <td><StatusPill tone={w.type === "Thời vụ" ? "warning" : "info"}>{w.type}</StatusPill></td>
                <td>{w.recruiter}</td>
                <td><StatusPill tone={workerStatusTone(w.status)}>{w.status}</StatusPill></td>
                <td>
                  <div className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => onViewDetail(w)}>Xem</Button>
                    {w.status === "Đang tư vấn" && <Button variant="outline" size="xs" onClick={() => setClosing(w)}>Chốt</Button>}
                    <Button variant="outline" size="xs" onClick={() => setEditing(w)}>Sửa</Button>
                    <Button variant="destructive" size="xs" onClick={() => void handleDelete(w)}>Xóa</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={9} text="Không tìm thấy hồ sơ phù hợp" />}
          </DataTable>
          <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
            <Button variant="outline" size="xs" disabled={offset === 0} onClick={() => setOffset((n) => Math.max(0, n - PAGE))}>Trước</Button>
            <span>{offset + 1}–{Math.min(offset + PAGE, total)} / {total}</span>
            <Button variant="outline" size="xs" disabled={offset + PAGE >= total} onClick={() => setOffset((n) => n + PAGE)}>Sau</Button>
          </div>
        </QueryState>
      </div>
      <CreateWorkerModal open={openCreate} onClose={() => setOpenCreate(false)} onCreated={() => void reload()} />
      {editing && <EditWorkerModal worker={editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />}
      {closing && <CloseWorkerModal worker={closing} onClose={() => setClosing(null)} onSaved={() => void reload()} />}
    </section>
  );
}

function rememberManager(code: string, manager: string) {
  const key = `tw-worker-profile:${code}`;
  let prev: Record<string, unknown> = {};
  try {
    prev = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, unknown>;
  } catch {
    prev = {};
  }
  localStorage.setItem(key, JSON.stringify({ ...prev, manager }));
}

function CreateWorkerModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { companies, staff } = useApp();
  const defaultCompany = companies[0]?.short_name ?? "";
  const defaultRecruiter = staff[0]?.full_name ?? "";
  const [form, setForm] = useState({ code: "", name: "", phone: "", citizenId: "", dob: "", hometown: "", company: defaultCompany, type: "Thời vụ" as Worker["type"], recruiter: defaultRecruiter });
  const [step, setStep] = useState<"consult" | "close">("consult");
  const [created, setCreated] = useState<{ id: number; code: string } | null>(null);
  const [manager, setManager] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [dupHits, setDupHits] = useState<DuplicateHit[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("consult");
      setCreated(null);
      setManager("");
      setError("");
      setDupHits(null);
      setConfirmed(false);
      setForm({ code: "", name: "", phone: "", citizenId: "", dob: "", hometown: "", company: defaultCompany, type: "Thời vụ", recruiter: defaultRecruiter });
    }
  }
  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setDupHits(null);
    setConfirmed(false);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.phone.trim() || !form.citizenId.trim()) return;
    if (!manager.trim()) {
      setError("Chọn người quản lý.");
      return;
    }
    const recruiter = staff.find((s) => s.full_name === form.recruiter);
    const companyRow = companies.find((c) => c.short_name === form.company);
    if (!recruiter || !companyRow) {
      setError("Chọn công ty và người tuyển trong danh mục.");
      return;
    }
    if (!confirmed) {
      setChecking(true);
      setError("");
      try {
        const hits = await checkLiveDuplicates({
          code: form.code.trim(),
          national_id: form.citizenId.trim(),
          phone: form.phone.trim(),
          full_name: form.name.trim(),
          date_of_birth: form.dob || null,
        });
        const exact = hits.filter((h) => h.level === "exact");
        if (exact.length > 0) {
          setDupHits(hits);
          setError(`Trùng hồ sơ (${exact.map((h) => `${dupFieldLabel(h.field)} với ${h.matched_code}`).join("; ")}).`);
          return;
        }
        if (hits.length > 0) {
          setDupHits(hits);
          setConfirmed(true);
          return;
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Kiểm trùng thất bại.");
        return;
      } finally {
        setChecking(false);
      }
    }
    setSaving(true);
    setError("");
    try {
      const createdRow = await createLiveWorker({
        code: form.code.trim(),
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        national_id: form.citizenId.trim(),
        date_of_birth: form.dob || null,
        hometown: form.hometown.trim() || null,
        employment_type: VI_TYPE[form.type] ?? "seasonal",
        recruiter_id: recruiter.id,
        current_company_id: companyRow.id,
        status: "candidate",
      });
      rememberManager(createdRow.code, manager.trim());
      setCreated({ id: createdRow.id, code: createdRow.code });
      setStep("close");
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const closeDeal = async () => {
    if (!created) return;
    if (!manager.trim()) {
      setError("Chọn người quản lý đón để chốt.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateLiveWorker(created.id, {
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        hometown: form.hometown.trim() || null,
        current_position: "",
        employment_type: VI_TYPE[form.type] ?? "seasonal",
        status: "waiting_start",
      });
      rememberManager(created.code, manager);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Chốt thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "consult" ? "Tạo hồ sơ người lao động" : "Chốt hồ sơ"}
      footer={
        step === "consult" ? (
          <>
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
              {checking ? "Đang kiểm trùng..." : saving ? "Đang lưu..." : dupHits && dupHits.length > 0 ? "Vẫn lưu" : "Lưu hồ sơ"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Để sau</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void closeDeal()}>
              {saving ? "Đang chốt..." : "Chốt"}
            </Button>
          </>
        )
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {dupHits && dupHits.length > 0 && !error && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Nghi trùng. Bấm “Vẫn lưu” nếu đây là người khác.
        </div>
      )}
      {step === "close" ? (
        <div className="grid gap-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            Đã lưu hồ sơ <strong>{form.name}</strong> ở giai đoạn Đang tư vấn. Chọn người quản lý đón để chốt.
          </p>
          <Field label="Người quản lý đón">
            <select className={inputClass} value={manager} onChange={(e) => setManager(e.target.value)}>
              <option value="">— Chọn người đón tại nhà máy —</option>
              {staff.map((s) => (<option key={s.id} value={s.full_name}>{s.full_name}</option>))}
            </select>
          </Field>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-lg bg-sky-50 px-3 py-2 text-[13px] text-sky-800">
          Giai đoạn: <strong>Đang tư vấn</strong>. Lưu thông tin trước, rồi chốt khi đã chọn người đón.
        </div>
        <Field label="Mã NLĐ *"><input className={inputClass} value={form.code} onChange={(e) => set("code", e.target.value)} /></Field>
        <Field label="Họ và tên *"><input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Số điện thoại *"><input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="CCCD *"><input className={inputClass} value={form.citizenId} onChange={(e) => set("citizenId", e.target.value)} /></Field>
        <Field label="Ngày sinh"><input type="date" className={inputClass} value={form.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
        <Field label="Quê quán"><input className={inputClass} value={form.hometown} onChange={(e) => set("hometown", e.target.value)} /></Field>
        <Field label="Công ty">
          <select className={inputClass} value={form.company} onChange={(e) => set("company", e.target.value)}>
            {companies.map((c) => (<option key={c.id} value={c.short_name}>{c.short_name}</option>))}
          </select>
        </Field>
        <Field label="Loại hình">
          <select className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="Thời vụ">Thời vụ</option>
            <option value="Chính thức">Chính thức</option>
          </select>
        </Field>
        <Field label="Người tuyển">
          <select className={inputClass} value={form.recruiter} onChange={(e) => set("recruiter", e.target.value)}>
            {staff.map((s) => (<option key={s.id} value={s.full_name}>{s.full_name}</option>))}
          </select>
        </Field>
        <Field label="Người quản lý *">
          <select className={inputClass} value={manager} onChange={(e) => setManager(e.target.value)}>
            <option value="">— Chọn người quản lý —</option>
            {staff.map((s) => (<option key={s.id} value={s.full_name}>{s.full_name}</option>))}
          </select>
        </Field>
      </div>
      )}
    </Modal>
  );
}

function CloseWorkerModal({
  worker, onClose, onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { staff } = useApp();
  const [manager, setManager] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!manager.trim()) {
      setError("Chọn người quản lý đón để chốt.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateLiveWorker(worker.id, {
        full_name: worker.name,
        phone: worker.phone,
        hometown: worker.hometown || null,
        current_position: worker.position === "—" ? "" : worker.position,
        employment_type: VI_TYPE[worker.type] ?? "seasonal",
        status: "waiting_start",
      });
      rememberManager(worker.code, manager);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Chốt thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Chốt hồ sơ ${worker.code}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>{saving ? "Đang chốt..." : "Chốt"}</Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <p className="mb-3 text-[13px] text-slate-600">Hồ sơ <strong>{worker.name}</strong> đang tư vấn. Chọn người quản lý đón tại nhà máy để chốt.</p>
      <Field label="Người quản lý đón">
        <select className={inputClass} value={manager} onChange={(e) => setManager(e.target.value)}>
          <option value="">— Chọn người đón tại nhà máy —</option>
          {staff.map((s) => (<option key={s.id} value={s.full_name}>{s.full_name}</option>))}
        </select>
      </Field>
    </Modal>
  );
}

function EditWorkerModal({
  worker, onClose, onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: worker.name, phone: worker.phone, hometown: worker.hometown, position: worker.position, type: worker.type, status: worker.status });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await updateLiveWorker(worker.id, {
        full_name: form.name,
        phone: form.phone,
        hometown: form.hometown || null,
        current_position: form.position,
        employment_type: VI_TYPE[form.type] ?? "seasonal",
        status: VI_STATUS[form.status] ?? "working",
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sửa hồ sơ ${worker.code}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Họ và tên"><input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Số điện thoại"><input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Quê quán"><input className={inputClass} value={form.hometown} onChange={(e) => set("hometown", e.target.value)} /></Field>
        <Field label="Vị trí"><input className={inputClass} value={form.position} onChange={(e) => set("position", e.target.value)} /></Field>
        <Field label="Loại hình">
          <select className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="Thời vụ">Thời vụ</option>
            <option value="Chính thức">Chính thức</option>
          </select>
        </Field>
        <Field label="Trạng thái">
          <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

