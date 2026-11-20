import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import {
  VI_STATUS,
  VI_TYPE,
  checkLiveBlacklistCccd,
  checkLiveDuplicates,
  createLiveCompany,
  createLivePersonnel,
  createLiveWorker,
  deleteLiveWorker,
  downloadLiveWorkersExcel,
  dupFieldLabel,
  fetchLiveOrders,
  fetchLiveWorkers,
  fetchWorkerPortraits,
  isRehirableDuplicate,
  toWorker,
  updateLiveWorker,
  uploadWorkerPortrait,
} from "@/lib/live";
import type { DuplicateHit, LiveCompany, LiveStaff } from "@/lib/live";
import { downloadBlob } from "@/lib/download";
import { buildProfileImagesDocx } from "@/lib/profile-images-docx";
import { maskCitizenId, workerStatusTone } from "@/lib/format";
import { workerStatusLabel } from "@/lib/worker-status";
import { SuggestInput } from "@/components/ui/suggest-input";
import { SearchableStaffSelect } from "@/components/ui/searchable-staff-select";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import { CreateWorkerSchema, formatZodErrors } from "@/lib/validation";
import type { Worker } from "@/types/hrm";
import { BlacklistPanel } from "@/components/workers/BlacklistPanel";

const STATUSES = ["Đang làm", "Chờ đi làm", "Tạm nghỉ", "Nghỉ việc", "Không đi làm", "Đang tư vấn", "Blacklist"];
const HCNS_STATUSES = ["Đang làm", "Chờ đi làm", "Nghỉ việc", "Không đi làm"] as const;
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

function birthYearToDob(value: string): string | null | "invalid" {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{4}$/.test(text)) return "invalid";
  const year = Number(text);
  const max = new Date().getFullYear();
  if (year < 1940 || year > max) return "invalid";
  return `${text}-01-01`;
}

function showDate(value?: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Không đọc được ảnh hồ sơ."));
    reader.onerror = () => reject(new Error("Không đọc được ảnh hồ sơ."));
    reader.readAsDataURL(blob);
  });
}

async function profileImageDataUrl(blob: Blob): Promise<string> {
  if (blob.type === "image/png" || blob.type === "image/jpeg") return blobToDataUrl(blob);
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không xử lý được ảnh hồ sơ.");
    context.drawImage(bitmap, 0, 0);
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Không chuyển đổi được ảnh hồ sơ.")), "image/jpeg", 0.92);
    });
    return blobToDataUrl(jpeg);
  } finally {
    bitmap.close();
  }
}

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type ConsultDates = { consultDate: string | null; startWorkDate: string | null };

function parseConsultDates(form: { consultDate: string; startWorkDate: string }): ConsultDates | { invalidField: "consultDate" | "startWorkDate" } {
  const consultDate = isoDate(form.consultDate);
  if (consultDate === "invalid") return { invalidField: "consultDate" };
  const startWorkDate = isoDate(form.startWorkDate);
  if (startWorkDate === "invalid") return { invalidField: "startWorkDate" };
  return { consultDate, startWorkDate };
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
  const { companies, staff } = useApp();
  const { access } = useSession();
  const canDelete = access.canDelete;
  const canEdit = access.canEditWorker;
  const canCreate = access.canCreateWorker;
  const canEditStatus = access.canEditWorkerStatus;
  /** Chốt / tái tuyển / sửa trạng thái: GD/PGĐ/KT (full) hoặc HCNS·Nhân viên·CTV (ops). */
  const canCloseWorker = canEdit || canEditStatus;
  const [listTab, setListTab] = useState<"workers" | "blacklist">("workers");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [saleId, setSaleId] = useState<number | null>(null);
  const [managerId, setManagerId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const [workersWithoutPortrait, setWorkersWithoutPortrait] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [closing, setClosing] = useState<Worker | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingProfiles, setExportingProfiles] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [qDebounced, companyFilter, status, type, saleId, managerId, createdFrom, createdTo]);

  const staffOptions = useMemo(
    () => [...staff].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")),
    [staff],
  );

  const companyOptions = useMemo(
    () => [...new Set(companies.map((c) => c.short_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")),
    [companies],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchLiveWorkers({
        companies: companyFilter.length > 0 ? companyFilter : undefined,
        statusEn: status ? VI_STATUS[status] : undefined,
        typeEn: type ? VI_TYPE[type] : undefined,
        q: qDebounced || undefined,
        recruiterId: saleId ?? undefined,
        managerId: managerId ?? undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
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
  }, [companyFilter, status, type, saleId, managerId, createdFrom, createdTo, qDebounced, offset]);

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

  const exportExcel = async () => {
    setExporting(true);
    setExportError("");
    setWorkersWithoutPortrait([]);
    try {
      const { blob, filename } = await downloadLiveWorkersExcel({
        companies: companyFilter.length > 0 ? companyFilter : undefined,
        statusEn: status ? VI_STATUS[status] : undefined,
        typeEn: type ? VI_TYPE[type] : undefined,
        q: qDebounced || undefined,
        recruiterId: saleId ?? undefined,
        managerId: managerId ?? undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
      });
      downloadBlob(blob, filename || "nguoi-lao-dong.xlsx");
    } catch (e) {
      setExportError(e instanceof ApiError ? e.message : "Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  };

  const exportProfileImages = async (selectedOnly: boolean) => {
    setExportingProfiles(true);
    setExportError("");
    setWorkersWithoutPortrait([]);
    try {
      let workers = selectedOnly
        ? rows.filter((worker) => selectedWorkerIds.includes(worker.id))
        : [];
      if (!selectedOnly) {
        const gathered: typeof rows = [];
        let pageOffset = 0;
        let pageTotal = total;
        do {
          const page = await fetchLiveWorkers({
            companies: companyFilter.length ? companyFilter : undefined,
            statusEn: status ? VI_STATUS[status] : undefined,
            typeEn: type ? VI_TYPE[type] : undefined,
            q: qDebounced || undefined,
            recruiterId: saleId ?? undefined,
            managerId: managerId ?? undefined,
            createdFrom: createdFrom || undefined,
            createdTo: createdTo || undefined,
            limit: 200,
            offset: pageOffset,
          });
          gathered.push(...page.rows.map(toWorker));
          pageTotal = page.total;
          pageOffset += page.limit;
          if (gathered.length >= 5000) break;
        } while (pageOffset < pageTotal);
        workers = gathered;
      }
      const images: Array<{ workerCode: string; workerName: string; dataUrl: string }> = [];
      const missingPortrait: Array<{ id: number; code: string; name: string }> = [];
      for (const worker of workers) {
        const imageCountBefore = images.length;
        const { documents } = await fetchWorkerPortraits(worker.id);
        for (const document of documents) {
          const response = await fetch(document.url);
          if (!response.ok) throw new Error(`Không tải được ảnh hồ sơ của ${worker.code}.`);
          const dataUrl = await profileImageDataUrl(await response.blob());
          images.push({ workerCode: worker.code, workerName: worker.name, dataUrl });
        }
        if (documents.length === 0) {
          // Hỗ trợ ảnh cũ được lưu cục bộ trước khi hồ sơ ảnh chuyển sang Supabase.
          const raw = localStorage.getItem(`tw-worker-profile:${worker.code}`);
          if (raw) {
            try {
              const saved = JSON.parse(raw) as { images?: unknown[] };
              for (const image of saved.images ?? []) {
                if (typeof image === "string" && image.startsWith("data:image/")) {
                  images.push({ workerCode: worker.code, workerName: worker.name, dataUrl: image });
                }
              }
            } catch {
              // Bỏ qua dữ liệu hồ sơ lưu lỗi; tiếp tục xuất các ảnh đọc được.
            }
          }
        }
        if (images.length === imageCountBefore) {
          missingPortrait.push({ id: worker.id, code: worker.code, name: worker.name });
        }
      }
      setWorkersWithoutPortrait(missingPortrait);
      if (images.length === 0) {
        setExportError("Không tìm thấy ảnh hồ sơ. Danh sách người lao động chưa có ảnh:");
        return;
      }
      const blob = await buildProfileImagesDocx(images);
      downloadBlob(blob, `anh-ho-so-nhan-su_${new Date().toISOString().slice(0, 10)}.docx`);
      if (missingPortrait.length > 0) {
        setExportError(`Đã xuất ${images.length} ảnh. Có ${missingPortrait.length} người lao động chưa có ảnh hồ sơ:`);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Xuất ảnh hồ sơ thất bại.");
    } finally {
      setExportingProfiles(false);
    }
  };

  return (
    <section className="absolute inset-0 flex flex-col">
      <ModuleHeader
        title="Hồ sơ Người lao động"
        sub={listTab === "blacklist" ? "Danh sách blacklist — ai cũng xem" : "Danh sách phân trang từ máy chủ"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {listTab === "workers" ? (
              <>
                <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportExcel()}>
                  {exporting ? "Đang xuất..." : "Xuất Excel"}
                </Button>
                {access.canExportWorkerCccd && <>
                  <Button variant="outline" size="sm" disabled={exportingProfiles || selectedWorkerIds.length === 0}
                    onClick={() => void exportProfileImages(true)}>
                    {exportingProfiles ? "Đang tạo DOC..." : `Xuất ảnh đã chọn (${selectedWorkerIds.length})`}
                  </Button>
                  <Button variant="outline" size="sm" disabled={exportingProfiles || total === 0}
                    onClick={() => void exportProfileImages(false)}>
                    {exportingProfiles ? "Đang tạo DOC..." : "Xuất tất cả ảnh hồ sơ"}
                  </Button>
                </>}
                {canCreate ? (
                  <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => setOpenCreate(true)}>
                    + Thêm người lao động
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        }
      />
      <div className="page-body">
        <div className="mb-3 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
          <button
            type="button"
            onClick={() => setListTab("workers")}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${listTab === "workers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Hồ sơ NLĐ
          </button>
          <button
            type="button"
            onClick={() => setListTab("blacklist")}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${listTab === "blacklist" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Blacklist
          </button>
        </div>
        {listTab === "blacklist" ? (
          <BlacklistPanel />
        ) : (
          <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, SĐT" className="w-60 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]" />
          <div className="w-56">
            <SearchableMultiSelect
              values={companyFilter}
              onChange={setCompanyFilter}
              options={companyOptions}
              placeholder="Tất cả công ty"
              emptyLabel="Tất cả công ty"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Tất cả trạng thái</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Loại: Tất cả</option>
            <option value="Thời vụ">Thời vụ</option>
            <option value="Chính thức">Chính thức</option>
          </select>
          <div className="w-56">
            <SearchableStaffSelect
              value={saleId}
              onChange={setSaleId}
              staff={staffOptions}
              placeholder="Tất cả sale"
              showAvatar={false}
            />
          </div>
          <div className="w-56">
            <SearchableStaffSelect
              value={managerId}
              onChange={setManagerId}
              staff={staffOptions}
              placeholder="Tất cả phụ trách"
              showAvatar={false}
            />
          </div>
          <label className="flex items-center gap-2 text-[12px] text-slate-500">
            <span>Ngày nhập từ</span>
            <input
              type="date"
              value={createdFrom}
              max={createdTo || undefined}
              onChange={(event) => setCreatedFrom(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-800"
              aria-label="Ngày nhập từ"
            />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-slate-500">
            <span>Đến ngày</span>
            <input
              type="date"
              value={createdTo}
              min={createdFrom || undefined}
              onChange={(event) => setCreatedTo(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-800"
              aria-label="Ngày nhập đến ngày"
            />
          </label>
          <span className="ml-auto text-[13px] text-slate-500">Tổng số: <strong className="text-slate-900">{total}</strong></span>
        </div>
        {exportError && (
          <section role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
            <p className="font-medium">{exportError}</p>
            {workersWithoutPortrait.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer font-semibold underline">
                  Xem {workersWithoutPortrait.length} người lao động chưa có ảnh
                </summary>
                <ul className="mt-2 max-h-52 list-disc space-y-1 overflow-y-auto pl-5">
                  {workersWithoutPortrait.map((worker) => (
                    <li key={worker.id}>{worker.name} ({worker.code})</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
        <QueryState loading={loading} error={error}>
          <DataTable headers={[...(access.canExportWorkerCccd ? ["Chọn"] : []), "Ảnh & Họ và tên", "Số ĐT", "Nơi ở", "CCCD / Định danh", "Công ty & Vị trí", "Loại hình", "NV tư vấn", "Phụ trách", "Ngày nhập", "Ngày tư vấn", "Ngày vào làm", "Ngày nghỉ", "Trạng thái", "Thao tác"]}>
            {rows.map((w) => (
              <tr key={w.id}>
                {access.canExportWorkerCccd && <td><input type="checkbox" aria-label={`Chọn hồ sơ ${w.name}`} checked={selectedWorkerIds.includes(w.id)}
                  onChange={() => setSelectedWorkerIds((selected) => selected.includes(w.id) ? selected.filter((id) => id !== w.id) : [...selected, w.id])} /></td>}
                <td>
                  <button type="button" onClick={() => onViewDetail(w)} className="flex items-center gap-2">
                    <Avatar tone={w.avatarColor} size="sm">{w.initials}</Avatar>
                    <strong className="text-slate-900 hover:text-[#0052cc] hover:underline">{w.name}</strong>
                  </button>
                </td>
                <td><code className="text-[13px]">{w.phone}</code></td>
                <td>{w.hometown || "—"}</td>
                <td><code>{maskCitizenId(w.citizenId, access.canViewCccd)}</code></td>
                <td><strong>{w.company}</strong> <span className="text-[11.5px] text-slate-400">({w.position})</span></td>
                <td className="w-[1%] whitespace-nowrap"><StatusPill tone={w.type === "Thời vụ" ? "warning" : "info"}>{w.type}</StatusPill></td>
                <td>{w.recruiter || "—"}</td>
                <td>{w.manager || "—"}</td>
                <td className="whitespace-nowrap">{showDate(w.createdAt)}</td>
                <td className="whitespace-nowrap">{showDate(w.consultDate)}</td>
                <td className="whitespace-nowrap">{showDate(w.startWorkDate)}</td>
                <td className="whitespace-nowrap">{showDate(w.resignDate)}</td>
                <td className="w-[1%] whitespace-nowrap"><StatusPill tone={workerStatusTone(w.status)}>{w.status}</StatusPill></td>
                <td>
                  <WorkerMenu
                    worker={w}
                    canDelete={canDelete}
                    canEdit={canEdit}
                    canCloseWorker={canCloseWorker}
                    canEditStatus={canEditStatus}
                    onView={onViewDetail}
                    onCloseDeal={setClosing}
                    onEdit={setEditing}
                    onDelete={handleDelete}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={access.canExportWorkerCccd ? 14 : 13} text="Không tìm thấy hồ sơ phù hợp" />}
          </DataTable>
          <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
            <Button variant="outline" size="xs" disabled={offset === 0} onClick={() => setOffset((n) => Math.max(0, n - PAGE))}>Trước</Button>
            <span>{offset + 1}–{Math.min(offset + PAGE, total)} / {total}</span>
            <Button variant="outline" size="xs" disabled={offset + PAGE >= total} onClick={() => setOffset((n) => n + PAGE)}>Sau</Button>
          </div>
        </QueryState>
          </>
        )}
      </div>
      {canCreate ? (
        <CreateWorkerModal
          open={openCreate}
          allowCloseDeal={canCloseWorker}
          onClose={() => setOpenCreate(false)}
          onCreated={() => void reload()}
        />
      ) : null}
      {editing && (
        <EditWorkerModal
          worker={editing}
          statusOnly={!canEdit && canEditStatus}
          onClose={() => setEditing(null)}
          onSaved={() => void reload()}
        />
      )}
      {canCloseWorker && closing ? (
        <CloseWorkerModal worker={closing} onClose={() => setClosing(null)} onSaved={() => void reload()} />
      ) : null}
    </section>
  );
}

function WorkerMenu({
  worker,
  canDelete,
  canEdit,
  canCloseWorker,
  canEditStatus,
  onView,
  onCloseDeal,
  onEdit,
  onDelete,
}: {
  worker: Worker;
  canDelete: boolean;
  canEdit: boolean;
  canCloseWorker: boolean;
  canEditStatus: boolean;
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
          {canCloseWorker && worker.status === "Đang tư vấn" && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onCloseDeal(worker); }}>Chốt</button>
          )}
          {canEdit && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onEdit(worker); }}>
              Sửa
            </button>
          )}
          {!canEdit && canEditStatus && worker.status !== "Đang tư vấn" && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50" onClick={() => { setOpen(false); onEdit(worker); }}>
              Sửa trạng thái
            </button>
          )}
          {canDelete && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50" onClick={() => { setOpen(false); void onDelete(worker); }}>Xóa</button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateWorkerModal({
  open, allowCloseDeal = false, onClose, onCreated,
}: {
  open: boolean;
  /** GD/PGĐ/KT/HCNS/Nhân viên/CTV: bước chốt & tái tuyển khi có quyền ops. */
  allowCloseDeal?: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { companies, staff, periodCode, reloadCatalog } = useApp();
  const { access } = useSession();
  const [form, setForm] = useState({ name: "", phone: "", citizenId: "", birthYear: "", hometown: "", company: "", type: "Thời vụ", source: "", sale: "", manager: "", consultDate: todayIso(), startWorkDate: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [portraits, setPortraits] = useState<string[]>([]);
  const [portraitFiles, setPortraitFiles] = useState<File[]>([]);
  const [uploadedPortraitCount, setUploadedPortraitCount] = useState(0);
  const [orderCompanies, setOrderCompanies] = useState<string[]>([]);
  const [knownWorkers, setKnownWorkers] = useState<Worker[]>([]);
  const [step, setStep] = useState<"consult" | "close">("consult");
  const [created, setCreated] = useState<{ id: number; code: string; managerId: number | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dupHits, setDupHits] = useState<DuplicateHit[] | null>(null);
  const [blacklistHit, setBlacklistHit] = useState<{ id: number; code: string; full_name: string; status: string } | null>(null);
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
      setBlacklistHit(null);
      setConfirmed(false);
      setPortraits([]);
      setPortraitFiles([]);
      setUploadedPortraitCount(0);
      setForm({ name: "", phone: "", citizenId: "", birthYear: "", hometown: "", company: "", type: "Thời vụ", source: "", sale: "", manager: "", consultDate: todayIso(), startWorkDate: "" });
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
    setBlacklistHit(null);
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

  const rehirableHits = (dupHits ?? []).filter((h) => h.level === "exact" && isRehirableDuplicate(h));

  // Sale bắt buộc; công ty / phụ trách chỉ tạo khi đã nhập (dùng chung tạo hồ sơ và tái tuyển).
  const resolveAssignees = async () => {
    const pins: string[] = [];
    const known = new Map<string, number>();
    const companyId = form.company.trim() ? await ensureCompanyId(companies, form.company) : null;
    const recruiterId = await ensureStaffId(staff, known, form.sale, "Sale", pins);
    const managerId = form.manager.trim() ? await ensureStaffId(staff, known, form.manager, "Phụ trách", pins) : null;
    return { companyId, recruiterId, managerId, pins };
  };

  const announceNewStaff = async (pins: string[]) => {
    if (pins.length === 0) return;
    setNotice(`Đã thêm nhân sự mới. ${pins.join(". ")}`);
    await reloadCatalog();
  };

  const insertNewRecord = async (dob: string | null, dates: ConsultDates) => {
    setSaving(true);
    setError("");
    try {
      const { companyId, recruiterId, managerId, pins } = await resolveAssignees();
      const createdRow = await createLiveWorker({
        note: form.source.trim() ? `Nguồn: ${form.source.trim()}` : null,
        full_name: form.name.trim() || "Chưa cập nhật",
        phone: form.phone.trim(),
        national_id: form.citizenId.trim() || null,
        date_of_birth: dob,
        hometown: form.hometown.trim() || null,
        employment_type: VI_TYPE[form.type] ?? form.type.trim(),
        recruiter_id: recruiterId,
        manager_id: managerId,
        current_company_id: companyId,
        status: "candidate",
        consult_date: dates.consultDate,
        start_work_date: dates.startWorkDate,
      });
      await announceNewStaff(pins);
      if (portraitFiles.length > 0) {
        setUploadingPhoto(true);
        try {
          for (let index = 0; index < portraitFiles.length; index += 1) {
            const file = portraitFiles[index];
            if (!file) continue;
            await uploadWorkerPortrait(createdRow.id, file);
            setUploadedPortraitCount(index + 1);
          }
          setNotice((prev) => `${prev ? `${prev} ` : ""}Đã tải ${portraitFiles.length} ảnh hồ sơ.`);
        } catch (e) {
          setNotice((prev) => `${prev ? `${prev} ` : ""}Đã lưu hồ sơ nhưng tải ảnh thất bại: ${errorText(e, "không tải được ảnh.")}`);
        } finally {
          setUploadingPhoto(false);
        }
      }
      setCreated({ id: createdRow.id, code: createdRow.code, managerId });
      onCreated();
      if (allowCloseDeal) {
        setStep("close");
      } else {
        onClose();
      }
    } catch (e) {
      setError(errorText(e, "Lưu thất bại."));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const parsed = CreateWorkerSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    const dob = birthYearToDob(form.birthYear);
    if (dob === "invalid") {
      setFieldErrors({ birthYear: "Năm sinh gồm 4 chữ số hợp lệ." });
      return;
    }
    const dates = parseConsultDates(form);
    if ("invalidField" in dates) {
      setFieldErrors({ [dates.invalidField]: "Ngày theo dạng YYYY-MM-DD." });
      return;
    }
    if (!dates.consultDate) {
      setFieldErrors({ consultDate: "Ngày tư vấn không được để trống." });
      return;
    }
    if (!confirmed) {
      setChecking(true);
      setError("");
      try {
        const cccd = form.citizenId.trim();
        if (cccd) {
          const blocked = await checkLiveBlacklistCccd(cccd);
          if (blocked) {
            setBlacklistHit(blocked);
            setConfirmed(true);
            setNotice(
              `Cảnh báo blacklist: CCCD trùng hồ sơ ${blocked.code} (${blocked.full_name}) đang ở trạng thái Blacklist. Bấm “Vẫn lưu” nếu vẫn muốn tạo hồ sơ.`,
            );
            return;
          }
        }

        const hits = await checkLiveDuplicates({
          national_id: cccd || undefined,
          phone: form.phone.trim(),
          full_name: form.name.trim() || undefined,
          date_of_birth: dob,
        });
        const exact = hits.filter((h) => h.level === "exact");
        if (exact.length > 0) {
          setDupHits(hits);
          const blocking = exact.filter((h) => !isRehirableDuplicate(h));
          if (blocking.length > 0) {
            // Còn hồ sơ trùng CCCD/SĐT chưa nghỉ -> chặn cứng, không tự động cho nghỉ.
            // Muốn tạo mới: mở từng hồ sơ liệt kê dưới đây, Sửa sang Nghỉ việc (nếu thực tế đã nghỉ), rồi tạo lại.
            setError(
              `Trùng hồ sơ (${blocking
                .map((h) => `${dupFieldLabel(h.field)} với ${h.matched_code} (${h.matched_name}, ${workerStatusLabel(h.matched_status)})`)
                .join("; ")}). Hồ sơ này chưa nghỉ việc nên không tạo mới được.`,
            );
            return;
          }
          // Mọi hồ sơ trùng đã Nghỉ việc -> cho tạo mới hoặc tái tuyển ở lần bấm tiếp theo.
          setConfirmed(true);
          setError("");
          setNotice(
            `Phát hiện ${exact[0].matched_code} (${exact[0].matched_name}) đã Nghỉ việc. Bấm “Vẫn lưu” để tạo hồ sơ mới, hoặc “Tái tuyển dụng” để mở lại hồ sơ cũ.`,
          );
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
    await insertNewRecord(dob, dates);
  };

  const rehireExact = async () => {
    if (!allowCloseDeal) return;
    const target = rehirableHits[0];
    const dates = parseConsultDates(form);
    if (!target) return;
    if ("invalidField" in dates) {
      setFieldErrors({ [dates.invalidField]: "Ngày theo dạng YYYY-MM-DD." });
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { companyId, recruiterId, managerId, pins } = await resolveAssignees();
      await updateLiveWorker(target.matched_worker_id, {
        full_name: form.name.trim() || "Chưa cập nhật",
        phone: form.phone.trim(),
        hometown: form.hometown.trim() || null,
        current_position: "",
        employment_type: VI_TYPE[form.type] ?? form.type.trim(),
        status: "candidate",
        recruiter_id: recruiterId,
        manager_id: managerId,
        current_company_id: companyId,
        consult_date: dates.consultDate,
        start_work_date: dates.startWorkDate,
        resign_date: null,
      });
      await announceNewStaff(pins);
      setNotice((prev) => `${prev ? `${prev} ` : ""}Đã mở lại hồ sơ ${target.matched_code} (${target.matched_name}) sang Đang tư vấn.`);
      setCreated({ id: target.matched_worker_id, code: target.matched_code, managerId });
      setStep("close");
      onCreated();
    } catch (e) {
      setError(errorText(e, "Tái tuyển dụng thất bại."));
    } finally {
      setSaving(false);
    }
  };

  const closeDeal = async () => {
    if (!created) return;
    setSaving(true);
    setError("");
    try {
      await updateLiveWorker(created.id, { status: "waiting_start" });
      onCreated();
      onClose();
    } catch (e) {
      setError(errorText(e, "Chuyển sang Chờ đi làm thất bại."));
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
      title={step === "consult" ? "Tạo hồ sơ người lao động" : "Chờ đi làm"}
      footer={
        step === "consult" ? (
          <>
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            {allowCloseDeal && rehirableHits.length > 0 && confirmed && (
              <Button variant="outline" disabled={saving || checking} onClick={() => void rehireExact()}>
                {saving ? "Đang mở lại..." : `Tái tuyển ${rehirableHits[0].matched_code}`}
              </Button>
            )}
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" disabled={saving || checking || uploadingPhoto} onClick={() => void save()}>
              {checking
                ? "Đang kiểm trùng..."
                : saving
                  ? "Đang lưu..."
                  : uploadingPhoto
                    ? "Đang tải ảnh..."
                    : blacklistHit || (dupHits && dupHits.length > 0)
                      ? "Vẫn lưu"
                      : "Lưu hồ sơ"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Để sau</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void closeDeal()}>
              {saving ? "Đang chuyển..." : "Chuyển sang Chờ đi làm"}
            </Button>
          </>
        )
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {blacklistHit && !error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">
          <strong>Cảnh báo blacklist:</strong> CCCD trùng hồ sơ <strong>{blacklistHit.code}</strong> (
          {blacklistHit.full_name}) đang Blacklist. Có thể bấm “Vẫn lưu” để tiếp tục.
        </div>
      )}
      {notice && !blacklistHit && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{notice}</p>}
      {notice && blacklistHit && !error && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">{notice}</p>
      )}
      {dupHits && dupHits.length > 0 && !error && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Nghi trùng. Bấm “Vẫn lưu” nếu đây là người khác.
        </div>
      )}
      {step === "close" ? (
        <div className="grid gap-3">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
            Đã lưu hồ sơ <strong>{form.name.trim() || "Chưa cập nhật"}</strong> ở giai đoạn Đang tư vấn.
          </p>
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-[13px] text-sky-800">
            Có thể chuyển sang <strong>Chờ đi làm</strong> ngay. Bổ sung ảnh hồ sơ, công ty và người phụ trách trước khi chuyển sang <strong>Đang làm</strong>.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-lg bg-sky-50 px-3 py-2 text-[13px] text-sky-800">
          Giai đoạn: <strong>Đang tư vấn</strong>. Bắt buộc: SĐT, ngày tư vấn và nhân viên tư vấn. Năm sinh, nơi ở, ảnh, công ty và người phụ trách có thể bổ sung sau.
        </div>
        <Field label="Mã NLĐ"><input className={inputClass} value="Tự động khi lưu" readOnly /></Field>
        <Field label="Họ và tên">
          <input className={`${inputClass} ${fieldErrors.name ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Có thể để trống" />
          {fieldErrors.name && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.name}</p>}
        </Field>
        <Field label="Số điện thoại *">
          <input className={`${inputClass} ${fieldErrors.phone ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          {fieldErrors.phone && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.phone}</p>}
        </Field>
        <Field label="CCCD">
          <input className={`${inputClass} ${fieldErrors.citizenId ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.citizenId} onChange={(e) => set("citizenId", e.target.value)} placeholder="Có thể để trống" />
          {fieldErrors.citizenId && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.citizenId}</p>}
        </Field>
        <Field label="Năm sinh">
          <input
            type="number"
            inputMode="numeric"
            min={1940}
            max={new Date().getFullYear()}
            placeholder="VD: 1995"
            className={`${inputClass} ${fieldErrors.birthYear ? "border-rose-500 focus:border-rose-500" : ""}`}
            value={form.birthYear}
            onChange={(e) => set("birthYear", e.target.value)}
          />
          {fieldErrors.birthYear && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.birthYear}</p>}
        </Field>
        <Field label="Nơi ở">
          <input className={`${inputClass} ${fieldErrors.hometown ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.hometown} onChange={(e) => set("hometown", e.target.value)} />
          {fieldErrors.hometown && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.hometown}</p>}
        </Field>
        <Field label="Ngày tư vấn *">
          <input type="date" className={`${inputClass} ${fieldErrors.consultDate ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.consultDate} onChange={(e) => set("consultDate", e.target.value)} />
          {fieldErrors.consultDate && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.consultDate}</p>}
        </Field>
        <Field label="Ngày vào làm">
          <input type="date" className={`${inputClass} ${fieldErrors.startWorkDate ? "border-rose-500 focus:border-rose-500" : ""}`} value={form.startWorkDate} onChange={(e) => set("startWorkDate", e.target.value)} />
          {fieldErrors.startWorkDate && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.startWorkDate}</p>}
        </Field>
        <Field label="Công ty">
          <SuggestInput
            value={form.company}
            onChange={(company) => set("company", company)}
            suggestions={companyNames}
            createLabel="Thêm mới"
            placeholder="Có thể chọn sau khi chốt"
            emptyLimit={20}
          />
          {fieldErrors.company && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.company}</p>}
        </Field>
        <Field label="Loại hình">
          <SuggestInput value={form.type} onChange={(type) => set("type", type)} suggestions={typeNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ loại hình mới" />
        </Field>
        <Field label="Nguồn">
          <SuggestInput value={form.source} onChange={(source) => set("source", source)} suggestions={sources} createLabel="Thêm mới" placeholder="Chọn hoặc gõ nguồn mới" />
        </Field>
        <Field label="Nhân viên tư vấn *">
          <SuggestInput value={form.sale} onChange={(sale) => set("sale", sale)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ tên NV tư vấn" />
          {fieldErrors.sale && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.sale}</p>}
        </Field>
        <Field label="Phụ trách">
          <SuggestInput value={form.manager} onChange={(manager) => set("manager", manager)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Có thể chọn sau khi chốt" />
          {fieldErrors.manager && <p className="mt-1 text-[12px] text-rose-600">{fieldErrors.manager}</p>}
        </Field>
        <div className="col-span-2">
          <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh hồ sơ (chân dung)</span>
          {access.canManageWorkerPortrait ? (
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await updateLiveWorker(worker.id, { status: "waiting_start" });
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e, "Chuyển sang Chờ đi làm thất bại."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Chuyển ${worker.code} sang Chờ đi làm`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>{saving ? "Đang chuyển..." : "Chờ đi làm"}</Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      <p className="mb-3 text-[13px] text-slate-600">Hồ sơ <strong>{worker.name}</strong> có thể chuyển sang Chờ đi làm ngay. Ảnh hồ sơ, công ty và người phụ trách bắt buộc trước khi chuyển sang Đang làm.</p>
    </Modal>
  );
}

function EditWorkerModal({
  worker, statusOnly = false, onClose, onSaved,
}: {
  worker: Worker;
  statusOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { companies, staff, reloadCatalog } = useApp();
  const { access } = useSession();
  const [knownWorkers, setKnownWorkers] = useState<Worker[]>([]);
  const [portraitFiles, setPortraitFiles] = useState<File[]>([]);
  const canEditPhone = !worker.phoneHidden;
  const initialStatus = HCNS_STATUSES.includes(worker.status as (typeof HCNS_STATUSES)[number])
    ? worker.status
    : "Đang làm";
  const [form, setForm] = useState({
    name: worker.name,
    phone: worker.phone,
    company: worker.company === "—" ? "" : worker.company,
    hometown: worker.hometown === "—" ? "" : worker.hometown,
    position: worker.position === "—" ? "" : worker.position,
    type: worker.type,
    status: statusOnly ? initialStatus : worker.status,
    sale: worker.recruiter,
    manager: worker.manager === "—" ? "" : worker.manager,
    consultDate: worker.consultDate ?? "",
    startWorkDate: worker.startWorkDate ?? "",
    resignDate: worker.resignDate ?? "",
    noShowReason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const needsNoShowReason = form.status === "Không đi làm";

  useEffect(() => {
    if (statusOnly) return;
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
  }, [statusOnly]);

  const save = async () => {
    if (statusOnly) {
      if (!(HCNS_STATUSES as readonly string[]).includes(form.status)) {
        setError("Chỉ được chọn Đang làm, Chờ đi làm, Nghỉ việc hoặc Không đi làm.");
        return;
      }
      if (needsNoShowReason && !form.noShowReason.trim()) {
        setError("Nhập lý do không đi làm.");
        return;
      }
      const startWorkDate = isoDate(form.startWorkDate);
      const resignDate = isoDate(form.resignDate);
      if (startWorkDate === "invalid" || resignDate === "invalid") {
        setError("Ngày theo dạng YYYY-MM-DD.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        const pins: string[] = [];
        const extra: { current_company_id?: number; manager_id?: number; note?: string } = {};
        if (worker.status === "Chờ đi làm" && form.status === "Đang làm") {
          const companyRecord = companies.find((item) =>
            item.short_name.trim().toLowerCase() === form.company.trim().toLowerCase()
            || item.name.trim().toLowerCase() === form.company.trim().toLowerCase(),
          );
          if (!companyRecord) {
            setError("Chọn một công ty có trong danh sách trước khi chuyển sang Đang làm.");
            setSaving(false);
            return;
          }
          if (!form.manager.trim()) {
            setError("Chọn người phụ trách trước khi chuyển sang Đang làm.");
            setSaving(false);
            return;
          }
          extra.current_company_id = companyRecord.id;
          extra.manager_id = await ensureStaffId(staff, new Map(), form.manager, "Phụ trách", pins);
          for (const file of portraitFiles) await uploadWorkerPortrait(worker.id, file);
        }
        if (needsNoShowReason) {
          extra.note = `[Không đi làm] ${form.noShowReason.trim()}`;
        }
        await updateLiveWorker(worker.id, {
          status: VI_STATUS[form.status] ?? form.status.trim(),
          start_work_date: startWorkDate,
          resign_date: resignDate,
          ...extra,
        });
        onSaved();
        onClose();
      } catch (e) {
        setError(errorText(e, "Lưu thất bại."));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!form.sale.trim()) {
      setError("Nhập sale. Có thể chọn gợi ý hoặc gõ tên mới.");
      return;
    }
    if (needsNoShowReason && !form.noShowReason.trim()) {
      setError("Nhập lý do không đi làm.");
      return;
    }
    const consultDate = isoDate(form.consultDate);
    const startWorkDate = isoDate(form.startWorkDate);
    const resignDate = isoDate(form.resignDate);
    if (consultDate === "invalid" || startWorkDate === "invalid" || resignDate === "invalid") {
      setError("Ngày theo dạng YYYY-MM-DD.");
      return;
    }
    const companyRecord = companies.find((item) =>
      item.short_name.trim().toLowerCase() === form.company.trim().toLowerCase()
      || item.name.trim().toLowerCase() === form.company.trim().toLowerCase(),
    );
    const companyChanged = form.company.trim().toLowerCase() !== worker.company.trim().toLowerCase();
    const enteringWork = worker.status === "Chờ đi làm" && form.status === "Đang làm";
    if (form.status === "Đang làm" && worker.status === "Đang tư vấn") {
      setError("Hồ sơ phải qua Chờ đi làm trước khi chuyển sang Đang làm.");
      return;
    }
    if (enteringWork && !companyRecord) {
      setError("Chọn một công ty có trong danh sách trước khi chuyển sang Đang làm.");
      return;
    }
    if (enteringWork && !form.manager.trim()) {
      setError("Chọn người phụ trách trước khi chuyển sang Đang làm.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const pins: string[] = [];
      const known = new Map<string, number>();
      const saleId = await ensureStaffId(staff, known, form.sale, "Sale", pins);
      const managerId = form.manager.trim()
        ? await ensureStaffId(staff, known, form.manager, "Phụ trách", pins)
        : undefined;
      if (enteringWork) {
        for (const file of portraitFiles) await uploadWorkerPortrait(worker.id, file);
      }
      await updateLiveWorker(worker.id, {
        full_name: form.name.trim(),
        ...(canEditPhone ? { phone: form.phone.trim() } : {}),
        hometown: form.hometown.trim() || null,
        current_position: form.position.trim(),
        employment_type: VI_TYPE[form.type] ?? form.type.trim(),
        status: VI_STATUS[form.status] ?? form.status.trim(),
        ...(needsNoShowReason ? { note: `[Không đi làm] ${form.noShowReason.trim()}` } : {}),
        recruiter_id: saleId,
        ...(managerId ? { manager_id: managerId } : {}),
        ...(companyChanged && companyRecord ? { current_company_id: companyRecord.id } : {}),
        consult_date: consultDate,
        start_work_date: startWorkDate,
        resign_date: resignDate,
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
  const transitionNeedsPortrait = worker.status === "Chờ đi làm" && form.status === "Đang làm";

  return (
    <Modal
      open
      onClose={onClose}
      title={statusOnly ? `Sửa trạng thái ${worker.code}` : `Sửa hồ sơ ${worker.code}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => { if (notice) onClose(); else void save(); }}>{notice ? "Đóng" : saving ? "Đang lưu..." : "Lưu"}</Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">{notice}</p>}
      {statusOnly ? (
        <div className="grid grid-cols-2 gap-3">
          <p className="col-span-2 text-[12.5px] text-slate-500">
            Chỉ được sửa trạng thái <strong>Đang làm</strong> / <strong>Chờ đi làm</strong> / <strong>Nghỉ việc</strong> / <strong>Không đi làm</strong> và ngày vào / nghỉ liên quan.
          </p>
          <Field label="Họ và tên"><input className={inputClass} value={worker.name} readOnly /></Field>
          <Field label="Trạng thái">
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {HCNS_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </Field>
          {worker.status === "Chờ đi làm" && form.status === "Đang làm" && <>
            <Field label="Công ty *">
              <SuggestInput value={form.company} onChange={(company) => set("company", company)} suggestions={uniq(companies.flatMap((item) => [item.short_name, item.name]))} createLabel="Chọn tên" placeholder="Chọn công ty" />
            </Field>
            <Field label="Phụ trách *">
              <SuggestInput value={form.manager} onChange={(manager) => set("manager", manager)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn người phụ trách" />
            </Field>
            <div className="col-span-2">
              <label className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh hồ sơ * (nếu chưa có)</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
                setPortraitFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }} />
            </div>
          </>}
          <Field label="Ngày vào làm"><input type="date" className={inputClass} value={form.startWorkDate} onChange={(e) => set("startWorkDate", e.target.value)} /></Field>
          <Field label="Ngày nghỉ việc"><input type="date" className={inputClass} value={form.resignDate} onChange={(e) => set("resignDate", e.target.value)} /></Field>
          {needsNoShowReason && (
            <div className="col-span-2">
              <Field label="Lý do không đi làm *">
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  value={form.noShowReason}
                  onChange={(e) => set("noShowReason", e.target.value)}
                  placeholder="Ví dụ: tư vấn xong nhưng không nhận việc / không đến công ty..."
                />
              </Field>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Họ và tên"><input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Số điện thoại">
            <input
              className={inputClass}
              value={form.phone}
              readOnly={!canEditPhone}
              onChange={(e) => {
                if (!canEditPhone) return;
                set("phone", e.target.value);
              }}
            />
          </Field>
          {!canEditPhone && (
            <p className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              Số điện thoại đang bị che — bạn không có quyền xem/sửa SĐT hồ sơ này.
            </p>
          )}
          <Field label="Quê quán"><input className={inputClass} value={form.hometown} onChange={(e) => set("hometown", e.target.value)} /></Field>
          <Field label="Vị trí"><SuggestInput value={form.position} onChange={(position) => set("position", position)} suggestions={positions} createLabel="Thêm mới" placeholder="Chọn hoặc gõ vị trí mới" /></Field>
          <Field label="Loại hình"><SuggestInput value={form.type} onChange={(type) => set("type", type)} suggestions={typeNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ loại hình mới" /></Field>
          <Field label="Trạng thái"><SuggestInput value={form.status} onChange={(status) => set("status", status)} suggestions={statusNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ trạng thái mới" /></Field>
          <Field label={transitionNeedsPortrait ? "Công ty hiện tại *" : "Công ty hiện tại"}><SuggestInput value={form.company} onChange={(company) => set("company", company)} suggestions={uniq(companies.flatMap((item) => [item.short_name, item.name]))} createLabel="Chọn tên" placeholder="Chọn công ty" /></Field>
          <Field label="Sale"><SuggestInput value={form.sale} onChange={(sale) => set("sale", sale)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ sale mới" /></Field>
          <Field label={transitionNeedsPortrait ? "Phụ trách *" : "Phụ trách"}><SuggestInput value={form.manager} onChange={(manager) => set("manager", manager)} suggestions={staffNames} createLabel="Thêm mới" placeholder="Chọn hoặc gõ tên mới" /></Field>
          <Field label="Ngày tư vấn"><input type="date" className={inputClass} value={form.consultDate} onChange={(e) => set("consultDate", e.target.value)} /></Field>
          <Field label="Ngày vào làm"><input type="date" className={inputClass} value={form.startWorkDate} onChange={(e) => set("startWorkDate", e.target.value)} /></Field>
          <Field label="Ngày nghỉ việc"><input type="date" className={inputClass} value={form.resignDate} onChange={(e) => set("resignDate", e.target.value)} /></Field>
          {needsNoShowReason && (
            <div className="col-span-2">
              <Field label="Lý do không đi làm *">
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  value={form.noShowReason}
                  onChange={(e) => set("noShowReason", e.target.value)}
                  placeholder="Ví dụ: tư vấn xong nhưng không nhận việc / không đến công ty..."
                />
              </Field>
            </div>
          )}
          {transitionNeedsPortrait && access.canManageWorkerPortrait && (
            <div className="col-span-2">
              <label className="mb-1 block text-[12.5px] font-medium text-slate-600">Ảnh hồ sơ * (nếu chưa có)</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
                setPortraitFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

