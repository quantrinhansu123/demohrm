import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import {
  VI_STATUS,
  VI_TYPE,
  checkLiveDuplicates,
  createLiveCompany,
  createLivePersonnel,
  createLiveWorker,
  deleteLiveWorker,
  dupFieldLabel,
  fetchLiveOrders,
  fetchLiveWorkers,
  toWorker,
  updateLiveWorker,
  uploadWorkerPortrait,
} from "@/lib/live";
import type { DuplicateHit, LiveCompany, LiveStaff } from "@/lib/live";
import { maskCitizenId, workerStatusTone } from "@/lib/format";
import { SuggestInput } from "@/components/ui/suggest-input";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import { CreateWorkerSchema, formatZodErrors } from "@/lib/validation";
import type { Worker } from "@/types/hrm";

const STATUSES = ["Đang làm", "Chờ đi làm", "Tạm nghỉ", "Nghỉ việc", "Không đi làm", "Đang tư vấn"];
const TYPES = ["Thời vụ", "Chính thức"];
const PAGE = 50;

function uniq(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = (raw ?? "").trim().replace(/\s+/g, " ");
    const key = value.toLowerCase();
    if (!value || value === "—" || value.includes("*") || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b, "vi"));
}

function companyCode(name: string): string {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
  return `${ascii || "CT"}${Date.now().toString().slice(-4)}`;
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isoDate(value: string): string | null | "invalid" {
  const text = value.trim();
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "invalid";
}

async function ensureCompanyId(companies: LiveCompany[], name: string): Promise<number> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const found = companies.find((company) => company.short_name.toLowerCase() === trimmed.toLowerCase() || company.name.toLowerCase() === trimmed.toLowerCase());
  if (found) return found.id;
  const created = await createLiveCompany({ code: companyCode(trimmed), short_name: trimmed, name: trimmed });
  return created.id;
}

async function ensureStaffId(staff: LiveStaff[], known: Map<string, number>, name: string, position: string, pins: string[]): Promise<number> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const key = trimmed.toLowerCase();
  const cached = known.get(key);
  if (cached) return cached;
  const existing = staff.find((person) => person.full_name.trim().toLowerCase() === key);
  if (existing) {
    known.set(key, existing.id);
    return existing.id;
  }
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  const created = await createLivePersonnel({ department: "Nhân viên", full_name: trimmed, position, pin });
  const person = created[0];
  if (!person?.id) throw new Error("Không thêm được nhân sự mới.");
  known.set(key, person.id);
  pins.push(`${trimmed} (${person.code}): PIN ${pin}`);
  return person.id;
}

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
    <section className="absolute inset-0 flex flex-col">
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
          <DataTable headers={["Ảnh & Họ và tên", "Số ĐT", "Quê quán", "CCCD / Định danh", "Công ty & Vị trí", "Loại hình", "Sale", "Phụ trách", "Trạng thái", "Thao tác"]}>
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
                <td className="w-[1%] whitespace-nowrap"><StatusPill tone={w.type === "Thời vụ" ? "warning" : "info"}>{w.type}</StatusPill></td>
                <td>{w.recruiter || "—"}</td>
                <td>{w.manager || "—"}</td>
                <td className="w-[1%] whitespace-nowrap"><StatusPill tone={workerStatusTone(w.status)}>{w.status}</StatusPill></td>
                <td>
                  <WorkerMenu
                    worker={w}
                    onView={onViewDetail}
                    onCloseDeal={setClosing}
                    onEdit={setEditing}
                    onDelete={handleDelete}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={10} text="Không tìm thấy hồ sơ phù hợp" />}
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

function WorkerMenu({
  worker,
  onView,
  onCloseDeal,
  onEdit,
  onDelete,
}: {
  worker: Worker;
  onView: (worker: Worker) => void;
  onCloseDeal: (worker: Worker) => void;
  onEdit: (worker: Worker) => void;
  onDelete: (worker: Worker) => void;
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
        aria-label="Thao tác người lao động"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div ref={menuRef} className="fixed z-50 w-28 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={{ top: menuPos.top, left: menuPos.left }}>
          <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onView(worker); }}>Xem</button>
          {worker.status === "Đang tư vấn" && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onCloseDeal(worker); }}>Chốt</button>
          )}
          <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onEdit(worker); }}>Sửa</button>
          <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50" onClick={() => { setOpen(false); void onDelete(worker); }}>Xóa</button>
        </div>
      )}
    </div>
  );
}

function CreateWorkerModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { companies, staff, periodCode, reloadCatalog } = useApp();
  const { access } = useSession();
  const [form, setForm] = useState({ name: "", phone: "", citizenId: "", dob: "", hometown: "", company: "", type: "Thời vụ", source: "", sale: "", manager: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [portraits, setPortraits] = useState<string[]>([]);
  const [portraitFiles, setPortraitFiles] = useState<File[]>([]);
  const [orderCompanies, setOrderCompanies] = useState<string[]>([]);
  const [knownWorkers, setKnownWorkers] = useState<Worker[]>([]);
  const [step, setStep] = useState<"consult" | "close">("consult");
  const [created, setCreated] = useState<{ id: number; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dupHits, setDupHits] = useState<DuplicateHit[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep("consult");
      setCreated(null);
      setError("");
      setNotice("");
      setFieldErrors({});
      setDupHits(null);
      setConfirmed(false);
      setPortraits([]);
      setPortraitFiles([]);
      setForm({ name: "", phone: "", citizenId: "", dob: "", hometown: "", company: "", type: "Thời vụ", source: "", sale: "", manager: "" });
    }
  }
  useEffect(() => {
    if (!open || !periodCode) return;
    let alive = true;
    fetchLiveOrders(periodCode)
      .then((rows) => {
        if (!alive) return;
        const names = [...new Set(rows.map((row) => row.company).filter(Boolean))];
        setOrderCompanies(names);
      })
      .catch(() => {
        if (alive) setOrderCompanies([]);
      });
    return () => {
      alive = false;
    };
  }, [open, periodCode]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchLiveWorkers({ limit: 200 })
      .then((page) => {
        if (alive) setKnownWorkers(page.rows.map(toWorker));
      })
      .catch(() => {
        if (alive) setKnownWorkers([]);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setFieldErrors((prev) => ({ ...prev, [k]: "" }));
    setDupHits(null);
    setConfirmed(false);
  };

  const readImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Không đọc được ảnh."));
        img.onload = () => {
          const max = 1200;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Không xử lý được ảnh."));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });

  const addPortraitImages = useCallback(async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    const urls = await Promise.all(images.map((file) => readImageFile(file)));
    setPortraits((prev) => [...prev, ...urls]);
    setPortraitFiles((prev) => [...prev, ...images]);
    setNotice(`Đã thêm ${urls.length} ảnh.`);
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      void addPortraitImages(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addPortraitImages]);

  const save = async () => {
    const parsed = CreateWorkerSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    const dob = isoDate(form.dob);
    if (dob === "invalid") {
      setFieldErrors({ dob: "Ngày sinh theo dạng YYYY-MM-DD." });
      return;
    }
    if (!confirmed) {
      setChecking(true);
      setError("");
      try {
        const hits = await checkLiveDuplicates({
          national_id: form.citizenId.trim(),
          phone: form.phone.trim(),
          full_name: form.name.trim(),
          date_of_birth: dob,
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
        setError(errorText(e, "Kiểm trùng thất bại."));
        return;
      } finally {
        setChecking(false);
      }
    }
    setSaving(true);
    setError("");
    try {
      const pins: string[] = [];
      const known = new Map<string, number>();
      const companyId = await ensureCompanyId(companies, form.company);
      const recruiterId = await ensureStaffId(staff, known, form.sale, "Sale", pins);
      const managerId = await ensureStaffId(staff, known, form.manager, "Phụ trách", pins);
      const createdRow = await createLiveWorker({
        note: form.source.trim() ? `Nguồn: ${form.source.trim()}` : null,
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        national_id: form.citizenId.trim(),
        date_of_birth: dob,
        hometown: form.hometown.trim() || null,
        employment_type: VI_TYPE[form.type] ?? form.type.trim(),
        recruiter_id: recruiterId,
        manager_id: managerId,
        current_company_id: companyId,
        status: "candidate",
      });
      if (pins.length > 0) {
        setNotice(`Đã thêm nhân sự mới. ${pins.join(". ")}`);
        await reloadCatalog();
      }
      if (portraitFiles.length > 0) {
        setUploadingPhoto(true);
        try {
          for (const file of portraitFiles) {
            await uploadWorkerPortrait(createdRow.id, file);
          }
          setNotice((prev) => `${prev ? `${prev} ` : ""}Đã tải ${portraitFiles.length} ảnh hồ sơ.`);
        } catch (e) {
          setNotice((prev) => `${prev ? `${prev} ` : ""}Đã lưu hồ sơ nhưng tải ảnh thất bại: ${errorText(e, "không tải được ảnh.")}`);
        } finally {
          setUploadingPhoto(false);
        }
      }
      setCreated({ id: createdRow.id, code: createdRow.code });
      setStep("close");
      onCreated();
    } catch (e) {
      setError(errorText(e, "Lưu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  const closeDeal = async () => {
    if (!created) return;
    if (!form.manager.trim()) {
      setError("Nhập người phụ trách.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const pins: string[] = [];
      const managerId = await ensureStaffId(staff, new Map(), form.manager, "Phụ trách", pins);
      await updateLiveWorker(created.id, {
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        hometown: form.hometown.trim() || null,
        current_position: "",
        employment_type: VI_TYPE[form.type] ?? form.type.trim(),
        status: "waiting_start",
        manager_id: managerId,
      });
      if (pins.length > 0) await reloadCatalog();
      onCreated();
      onClose();
    } catch (e) {
      setError(errorText(e, "Chốt thất bại."));
    } finally {
      setSaving(false);
    }
  };

  const companyNames = uniq([...orderCompanies, ...companies.map((company) => company.short_name), ...knownWorkers.map((worker) => worker.company)]);
  const staffNames = uniq(staff.map((person) => person.full_name));
  const typeNames = uniq([...TYPES, ...knownWorkers.map((worker) => worker.type)]);
  const sources = uniq(["Trangway", ...companies.map((company) => company.short_name)]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "consult" ? "Tạo hồ sơ người lao động" : "Chốt hồ sơ"}
      footer={
        step === "consult" ? (
          <>
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" disabled={saving || checking || uploadingPhoto} onClick={() => void save()}>
              {checking ? "Đang kiểm trùng..." : saving ? "Đang lưu..." : uploadingPhoto ? "Đang tải ảnh..." : dupHits && dupHits.length > 0 ? "Vẫn lưu" : "Lưu hồ sơ"}
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
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{notice}</p>}
      {dupHits && dupHits.length > 0 && !error && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Nghi trùng. Bấm “Vẫn lưu” nếu đây là người khác.
        </div>
      )}
      {step === "close" ? (
        <div className="grid gap-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            Đã lưu hồ sơ <strong>{form.name}</strong> ở giai đoạn Đang tư vấn. Chọn hoặc gõ người phụ trách để chốt.
          </p>
          <Field label="Phụ trách *">
            <SuggestInput value={form.manager} onChange={(manager) => set("manager", manager)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ tên mới" />
          </Field>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-lg bg-sky-50 px-3 py-2 text-[13px] text-sky-800">
          Giai đoạn: <strong>Đang tư vấn</strong>. Công ty, loại hình, nguồn, sale và phụ trách có thể chọn gợi ý hoặc gõ giá trị mới.
        </div>
        <Field label="Mã NLĐ"><input className={inputClass} value="Tự động khi lưu" readOnly /></Field>
        <Field label="Họ và tên *">
          <input className={`${inputClass} ${fieldErrors.name ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.name} onChange={(e) => set("name", e.target.value)} />
          {fieldErrors.name && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.name}</p>}
        </Field>
        <Field label="Số điện thoại *">
          <input className={`${inputClass} ${fieldErrors.phone ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          {fieldErrors.phone && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.phone}</p>}
        </Field>
        <Field label="CCCD *">
          <input className={`${inputClass} ${fieldErrors.citizenId ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.citizenId} onChange={(e) => set("citizenId", e.target.value)} />
          {fieldErrors.citizenId && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.citizenId}</p>}
        </Field>
        <Field label="Ngày sinh">
          <input type="date" className={`${inputClass} ${fieldErrors.dob ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.dob} onChange={(e) => set("dob", e.target.value)} />
          {fieldErrors.dob && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.dob}</p>}
        </Field>
        <Field label="Quê quán">
          <input className={inputClass} value={form.hometown} onChange={(e) => set("hometown", e.target.value)} />
        </Field>
        <Field label="Công ty *">
          <SuggestInput value={form.company} onChange={(company) => set("company", company)} suggestions={companyNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ công ty mới" />
          {fieldErrors.company && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.company}</p>}
        </Field>
        <Field label="Loại hình">
          <SuggestInput value={form.type} onChange={(type) => set("type", type)} suggestions={typeNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ loại hình mới" />
        </Field>
        <Field label="Nguồn">
          <SuggestInput value={form.source} onChange={(source) => set("source", source)} suggestions={sources} createLabel="Thêm mới" placeholder="Chọn hoặc gõ nguồn mới" />
        </Field>
        <Field label="Sale *">
          <SuggestInput value={form.sale} onChange={(sale) => set("sale", sale)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ sale mới" />
          {fieldErrors.sale && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.sale}</p>}
        </Field>
        <Field label="Phụ trách *">
          <SuggestInput value={form.manager} onChange={(manager) => set("manager", manager)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ tên mới" />
          {fieldErrors.manager && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.manager}</p>}
        </Field>
        <div className="col-span-2">
          <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh hồ sơ (chân dung)</span>
          {access.canViewCccd ? (
            <div
              className="flex min-h-[180px] flex-col rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 outline-none focus:border-[#0052cc]"
              tabIndex={0}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
                if (files.length === 0) return;
                event.preventDefault();
                event.stopPropagation();
                void addPortraitImages(files);
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-[13px] font-bold text-slate-800">Ảnh hồ sơ</h4>
                <label className="cursor-pointer rounded-lg bg-[#0052cc] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[#0747a6]">
                  Tải ảnh từ máy
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      void addPortraitImages(files);
                    }}
                  />
                </label>
              </div>
              <p className="text-[12px] text-slate-500">Bấm vào cột này rồi nhấn Ctrl+V để dán ảnh, hoặc tải từ máy tính.</p>
              {notice && <p className="mt-1 text-[12px] font-medium text-emerald-700">{notice}</p>}
              {portraits.length === 0 ? (
                <div className="mt-3 grid flex-1 place-items-center rounded-lg border border-dashed border-slate-200 bg-white text-[13px] text-slate-400">
                  Chưa có ảnh
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {portraits.map((src, index) => (
                    <div key={`${index}-${src.slice(0, 24)}`} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-36 w-full rounded-lg object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPortraits((prev) => prev.filter((_, i) => i !== index));
                          setPortraitFiles((prev) => prev.filter((_, i) => i !== index));
                        }}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/80 text-white"
                        aria-label="Xóa ảnh"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">Tài khoản không có quyền tải ảnh hồ sơ.</p>
          )}
        </div>
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
  const { staff, reloadCatalog } = useApp();
  const [manager, setManager] = useState(worker.manager === "—" ? "" : worker.manager);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const save = async () => {
    if (notice) {
      onClose();
      return;
    }
    if (!manager.trim()) {
      setError("Nhập người phụ trách.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const pins: string[] = [];
      const managerId = await ensureStaffId(staff, new Map(), manager, "Phụ trách", pins);
      await updateLiveWorker(worker.id, {
        full_name: worker.name,
        phone: worker.phone,
        hometown: worker.hometown || null,
        current_position: worker.position === "—" ? "" : worker.position,
        employment_type: VI_TYPE[worker.type] ?? worker.type,
        status: "waiting_start",
        manager_id: managerId,
      });
      onSaved();
      if (pins.length > 0) {
        setNotice(`Đã chốt. Đã thêm nhân sự mới. ${pins.join(". ")}`);
        await reloadCatalog();
        return;
      }
      onClose();
    } catch (e) {
      setError(errorText(e, "Chốt thất bại."));
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
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>{notice ? "Đóng" : saving ? "Đang chốt..." : "Chốt"}</Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{notice}</p>}
      <p className="mb-3 text-[13px] text-slate-600">Hồ sơ <strong>{worker.name}</strong> đang tư vấn. Chọn hoặc gõ người phụ trách để chốt.</p>
      <Field label="Phụ trách *">
        <SuggestInput value={manager} onChange={setManager} suggestions={uniq(staff.map((person) => person.full_name))} createLabel="Thêm mới" placeholder="Chọn hoặc gõ tên mới" />
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
  const { staff, reloadCatalog } = useApp();
  const [knownWorkers, setKnownWorkers] = useState<Worker[]>([]);
  const [form, setForm] = useState({
    name: worker.name,
    phone: worker.phone,
    hometown: worker.hometown === "—" ? "" : worker.hometown,
    position: worker.position === "—" ? "" : worker.position,
    type: worker.type,
    status: worker.status,
    sale: worker.recruiter,
    manager: worker.manager === "—" ? "" : worker.manager,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    let alive = true;
    fetchLiveWorkers({ limit: 200 })
      .then((page) => {
        if (alive) setKnownWorkers(page.rows.map(toWorker));
      })
      .catch(() => {
        if (alive) setKnownWorkers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    if (!form.sale.trim() || !form.manager.trim()) {
      setError("Nhập sale và người phụ trách. Có thể chọn gợi ý hoặc gõ tên mới.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const pins: string[] = [];
      const known = new Map<string, number>();
      const saleId = await ensureStaffId(staff, known, form.sale, "Sale", pins);
      const managerId = await ensureStaffId(staff, known, form.manager, "Phụ trách", pins);
      await updateLiveWorker(worker.id, {
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        hometown: form.hometown.trim() || null,
        current_position: form.position.trim(),
        employment_type: VI_TYPE[form.type] ?? form.type.trim(),
        status: VI_STATUS[form.status] ?? form.status.trim(),
        recruiter_id: saleId,
        manager_id: managerId,
      });
      onSaved();
      if (pins.length > 0) {
        setNotice(`Đã lưu. Đã thêm nhân sự mới. ${pins.join(". ")}`);
        await reloadCatalog();
        return;
      }
      onClose();
    } catch (e) {
      setError(errorText(e, "Lưu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  const positions = uniq(knownWorkers.map((person) => person.position));
  const typeNames = uniq([...TYPES, ...knownWorkers.map((person) => person.type)]);
  const statusNames = uniq([...STATUSES, ...knownWorkers.map((person) => person.status)]);
  const staffNames = uniq(staff.map((person) => person.full_name));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Sửa hồ sơ ${worker.code}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => { if (notice) onClose(); else void save(); }}>{notice ? "Đóng" : saving ? "Đang lưu..." : "Lưu"}</Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{notice}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Họ và tên"><input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Số điện thoại"><input className={inputClass} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Quê quán"><input className={inputClass} value={form.hometown} onChange={(e) => set("hometown", e.target.value)} /></Field>
        <Field label="Vị trí"><SuggestInput value={form.position} onChange={(position) => set("position", position)} suggestions={positions} createLabel="Thêm mới" placeholder="Chọn hoặc gõ vị trí mới" /></Field>
        <Field label="Loại hình"><SuggestInput value={form.type} onChange={(type) => set("type", type)} suggestions={typeNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ loại hình mới" /></Field>
        <Field label="Trạng thái"><SuggestInput value={form.status} onChange={(status) => set("status", status)} suggestions={statusNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ trạng thái mới" /></Field>
        <Field label="Sale"><SuggestInput value={form.sale} onChange={(sale) => set("sale", sale)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ sale mới" /></Field>
        <Field label="Phụ trách *"><SuggestInput value={form.manager} onChange={(manager) => set("manager", manager)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ tên mới" /></Field>
      </div>
    </Modal>
  );
}

