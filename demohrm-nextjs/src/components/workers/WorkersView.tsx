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
  fetchDuplicateAlerts,
  fetchLiveRecruiters,
  fetchLiveWorkers,
  fetchLiveWorkerHistory,
  fetchLiveSupervisors,
  requestDocumentUpload,
  saveWorkerDocument,
  reviewDuplicateAlert,
  toWorker,
  updateLiveWorker,
} from "@/lib/live";
import type {
  DuplicateHit,
  LiveDuplicateAlert,
  LiveRecruiter,
  LiveSupervisor,
  WorkerAuditHistoryItem,
} from "@/lib/live";
import { formatDateTime, maskCitizenId, workerStatusTone } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Field, Modal, getInputClass, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import type { Worker } from "@/types/hrm";
import { CreateWorkerSchema, EditWorkerSchema, formatZodErrors } from "@/lib/validation";

const STATUSES = ["Đang làm", "Chờ đi làm", "Tạm nghỉ", "Nghỉ việc", "Không đi làm", "Ứng viên"];
const PAGE = 50;

export function WorkersView({ onViewDetail }: { onViewDetail: (w: Worker) => void }) {
  const { companies, staff } = useApp();
  const { access } = useSession();
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [handoverStatus, setHandoverStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<LiveDuplicateAlert[]>([]);
  const [alertError, setAlertError] = useState("");
  const [statsOpen, setStatsOpen] = useState(false);
  const [recruiters, setRecruiters] = useState<LiveRecruiter[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setOffset(0);
  }, [qDebounced, company, status, type, recruiterId, creatorId, handoverStatus]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchLiveWorkers({
        company: company || undefined,
        statusEn: status ? VI_STATUS[status] : undefined,
        typeEn: type ? VI_TYPE[type] : undefined,
        q: qDebounced || undefined,
        recruiter_id: recruiterId || undefined,
        created_by: creatorId || undefined,
        handover_status: handoverStatus || undefined,
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
  }, [company, status, type, qDebounced, recruiterId, creatorId, handoverStatus, offset]);

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

  const openRecruiterStats = async () => {
    setStatsOpen(true);
    try {
      setRecruiters(await fetchLiveRecruiters());
    } catch {
      setRecruiters([]);
    }
  };

  const selectedRecruiter = staff.find((s) => String(s.id) === recruiterId);
  const hasFilter = Boolean(q || company || status || type || recruiterId || creatorId || handoverStatus);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Hồ sơ Người lao động"
        sub="Danh sách phân trang từ máy chủ"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => void openRecruiterStats()}>
              Thống kê tuyển dụng
            </Button>
            <Button size="sm" variant="outline" onClick={() => void (async () => {
              setAlertsOpen(true);
              setAlertError("");
              try {
                setAlerts(await fetchDuplicateAlerts());
              } catch (e) {
                setAlertError(e instanceof ApiError ? e.message : "Không tải được cảnh báo trùng.");
              }
            })()}>Cảnh báo trùng</Button>
            <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => setOpenCreate(true)}>
              + Thêm người lao động
            </Button>
          </>
        }
      />
      <div className="page-body">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên, mã, SĐT" className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]" />
          <select value={company} onChange={(e) => setCompany(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Tất cả công ty</option>
            {companies.map((c) => (<option key={c.id} value={c.short_name}>{c.short_name}</option>))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Trạng thái: Tất cả</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <select value={handoverStatus} onChange={(e) => setHandoverStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Bàn giao: Tất cả</option>
            <option value="pending">Chờ bàn giao</option>
            <option value="handed_over">Đã bàn giao</option>
            <option value="received">Đã tiếp nhận</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Loại: Tất cả</option>
            <option value="Thời vụ">Thời vụ</option>
            <option value="Chính thức">Chính thức</option>
          </select>
          <select
            value={recruiterId}
            onChange={(e) => setRecruiterId(e.target.value)}
            className={`rounded-lg border px-2.5 py-1.5 text-[13px] ${recruiterId ? "border-[#0052cc] bg-blue-50/50 font-medium text-[#0052cc]" : "border-slate-200"}`}
          >
            <option value="">Người tuyển: Tất cả</option>
            {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
          </select>
          <select value={creatorId} onChange={(e) => setCreatorId(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px]">
            <option value="">Người nhập: Tất cả</option>
            {staff.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
          </select>

          <div className="ml-auto flex items-center gap-2 text-[13px]">
            {selectedRecruiter ? (
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-blue-700 font-medium">
                Phụ trách bởi: <strong>{selectedRecruiter.full_name}</strong> ({total} NLĐ)
              </span>
            ) : (
              <span className="text-slate-500">
                Tổng số: <strong className="text-slate-900">{total}</strong> NLĐ
              </span>
            )}
            {hasFilter && (
              <Button
                size="xs"
                variant="outline"
                className="text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setQ("");
                  setCompany("");
                  setStatus("");
                  setHandoverStatus("");
                  setType("");
                  setRecruiterId("");
                  setCreatorId("");
                }}
              >
                ✕ Bỏ lọc
              </Button>
            )}
          </div>
        </div>
        <QueryState loading={loading} error={error}>
          <DataTable headers={["Ảnh & Họ và tên", "Số ĐT", "Quê quán", "CCCD / Định danh", "Công ty & Vị trí", "Quản lý đón", "Loại hình", "Người tuyển", "Người nhập", "Trạng thái", "Thao tác"]}>
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
                <td>
                  {w.supervisorName ? (
                    <div>
                      <strong className="text-slate-800">{w.supervisorName}</strong>
                      <div className="text-[11px] text-slate-400">{w.supervisorPhone}</div>
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td><StatusPill tone={w.type === "Thời vụ" ? "warning" : "info"}>{w.type}</StatusPill></td>
                <td>
                  {w.recruiter ? (
                    <span className="font-semibold text-slate-800">{w.recruiter}</span>
                  ) : (
                    <span className="text-[12px] italic text-slate-400">Chưa phân công</span>
                  )}
                </td>
                <td>
                  <div className="text-[12px] font-medium text-slate-700">{w.creator || "Hệ thống"}</div>
                  {w.createdAt && (
                    <div className="text-[11px] text-slate-400">{formatDateTime(w.createdAt)}</div>
                  )}
                </td>
                <td>
                  <div className="flex flex-col gap-1 items-start">
                    <StatusPill tone={workerStatusTone(w.status)}>{w.status}</StatusPill>
                    {w.handoverStatus && (
                      <StatusPill
                        tone={
                          w.handoverStatus === "received"
                            ? "success"
                            : w.handoverStatus === "handed_over"
                              ? "info"
                              : "warning"
                        }
                      >
                        {w.handoverStatus === "received"
                          ? "Đã tiếp nhận"
                          : w.handoverStatus === "handed_over"
                            ? "Đã bàn giao"
                            : "Chờ bàn giao"}
                      </StatusPill>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => onViewDetail(w)}>Xem</Button>
                    <Button variant="outline" size="xs" onClick={() => setEditing(w)}>Sửa</Button>
                    <Button variant="destructive" size="xs" onClick={() => void handleDelete(w)}>Xóa</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={11} text="Không tìm thấy hồ sơ phù hợp" />}
          </DataTable>
          <div className="mt-3 flex items-center justify-end gap-2 text-[13px]">
            <Button variant="outline" size="xs" disabled={offset === 0} onClick={() => setOffset((n) => Math.max(0, n - PAGE))}>Trước</Button>
            <span>{offset + 1}–{Math.min(offset + PAGE, total)} / {total}</span>
            <Button variant="outline" size="xs" disabled={offset + PAGE >= total} onClick={() => setOffset((n) => n + PAGE)}>Sau</Button>
          </div>
        </QueryState>
      </div>

      <Modal open={statsOpen} onClose={() => setStatsOpen(false)} title="Danh sách người tuyển dụng & Số lượng phụ trách" wide>
        <div className="flex flex-col gap-2">
          <DataTable headers={["Mã", "Họ và tên", "Nguồn", "Tổng NLĐ", "Đang làm", "Chờ đi làm", "Nghỉ việc", ""]}>
            {recruiters.map((r) => (
              <tr key={`${r.source_type}-${r.source_id}`}>
                <td><code>{r.source_code}</code></td>
                <td><strong>{r.source_name}</strong></td>
                <td><StatusPill tone="info">{r.source_type === "staff" ? "Nội bộ" : "Vendor"}</StatusPill></td>
                <td><strong className="text-slate-900">{r.total_workers}</strong></td>
                <td><span className="font-semibold text-emerald-600">{r.working}</span></td>
                <td><span className="font-semibold text-blue-600">{r.waiting_start}</span></td>
                <td><span className="text-slate-400">{r.inactive}</span></td>
                <td>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      if (r.source_type === "staff") {
                        setRecruiterId(String(r.source_id));
                      }
                      setStatsOpen(false);
                    }}
                  >
                    Xem NLĐ
                  </Button>
                </td>
              </tr>
            ))}
            {recruiters.length === 0 && <EmptyRow colSpan={8} text="Đang tải dữ liệu tuyển dụng..." />}
          </DataTable>
        </div>
      </Modal>

      <Modal open={alertsOpen} onClose={() => setAlertsOpen(false)} title="Cảnh báo & Báo cáo trùng hồ sơ" wide>
        {alertError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{alertError}</p>}
        <div className="flex flex-col gap-2">
          {alerts.map((a) => {
            const isExact = a.level === "exact" || a.field === "national_id" || a.field === "worker_code";
            return (
              <div key={a.id} className="rounded-xl border border-slate-100 p-3 text-[13px]">
                <div className="flex items-center gap-2">
                  <StatusPill tone={isExact ? "danger" : "warning"}>
                    {isExact ? "Trùng chính (CCCD/Mã)" : "Nghi trùng (SĐT)"}
                  </StatusPill>
                  <span className="font-semibold text-slate-800">
                    {a.worker_name ?? a.worker_code ?? `Hồ sơ #${a.id}`} · đối chiếu {a.matched_name ?? a.matched_code}
                  </span>
                </div>
                <div className="mt-1 text-slate-500">
                  Trường đối chiếu: <strong>{dupFieldLabel(a.field ?? "")}</strong> {a.matched_value ? `(${a.matched_value})` : ""}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  <span className="text-slate-500 text-[12px]">Trạng thái:</span>
                  <StatusPill
                    tone={
                      a.status === "same_person"
                        ? "danger"
                        : a.status === "not_duplicate"
                          ? "neutral"
                          : a.status === "resolved"
                            ? "success"
                            : "warning"
                    }
                  >
                    {a.status === "same_person"
                      ? "Đã xác nhận trùng"
                      : a.status === "not_duplicate"
                        ? "Không trùng (Khác người)"
                        : a.status === "resolved"
                          ? "Đã xử lý"
                          : "Chờ kiểm tra (open)"}
                  </StatusPill>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-[#0052cc]/30 bg-blue-50/50 px-2.5 py-1 text-[12px] font-semibold text-[#0052cc] hover:bg-[#0052cc] hover:text-white transition-colors"
                      onClick={() =>
                        void reviewDuplicateAlert(a.id, { status: "same_person", review_note: "Xác nhận trùng" })
                          .then(() => setAlerts((list) => list.map((x) => x.id === a.id ? { ...x, status: "same_person" } : x)))
                          .catch((e: unknown) => setAlertError(e instanceof ApiError ? e.message : "Không lưu được kết luận."))
                      }
                    >
                      Xác nhận trùng
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                      onClick={() =>
                        void reviewDuplicateAlert(a.id, { status: "not_duplicate", review_note: "Không trùng" })
                          .then(() => setAlerts((list) => list.map((x) => x.id === a.id ? { ...x, status: "not_duplicate" } : x)))
                          .catch((e: unknown) => setAlertError(e instanceof ApiError ? e.message : "Không lưu được kết luận."))
                      }
                    >
                      Bỏ qua / Khác người
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {alerts.length === 0 && !alertError && <p className="py-6 text-center text-slate-400">Không có cảnh báo trùng nào cần xử lý.</p>}
        </div>
      </Modal>
      <CreateWorkerModal open={openCreate} onClose={() => setOpenCreate(false)} onCreated={() => void reload()} />
      {editing && <EditWorkerModal worker={editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />}
    </section>
  );
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
  const [form, setForm] = useState({
    code: "",
    name: "",
    phone: "",
    citizenId: "",
    dob: "",
    hometown: "",
    company: defaultCompany,
    supervisorId: "",
    type: "Thời vụ" as Worker["type"],
    recruiter: defaultRecruiter,
  });
  const [supervisors, setSupervisors] = useState<LiveSupervisor[]>([]);
  const [cccdFile, setCccdFile] = useState<File | null>(null);
  const [cccdPreview, setCccdPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dupHits, setDupHits] = useState<DuplicateHit[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const comp = companies.find((c) => c.short_name === form.company);
    if (comp) {
      void fetchLiveSupervisors(comp.id)
        .then((list) => {
          setSupervisors(list);
          if (list[0]) {
            setForm((f) => ({ ...f, supervisorId: f.supervisorId || String(list[0].id) }));
          }
        })
        .catch(() => setSupervisors([]));
    } else {
      setSupervisors([]);
    }
  }, [form.company, companies]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setFieldErrors((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
    setDupHits(null);
    setConfirmed(false);
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("File chọn phải là định dạng hình ảnh (JPEG, PNG, WebP).");
      return;
    }
    if (file.size > 5_000_000) {
      setError("Dung lượng ảnh tối đa 5MB.");
      return;
    }
    setCccdFile(file);
    setCccdPreview(URL.createObjectURL(file));
    setError("");
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.citizenId;
      return next;
    });
  };

  const handleCccdPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const save = async () => {
    setError("");
    const parsed = CreateWorkerSchema.safeParse(form);
    if (!parsed.success) {
      const errs = formatZodErrors(parsed.error);
      setFieldErrors(errs);
      setError("Vui lòng kiểm tra và hoàn thiện các ô báo đỏ bên dưới.");
      return;
    }
    setFieldErrors({});

    const recruiter = staff.find((s) => s.full_name === form.recruiter);
    const companyRow = companies.find((c) => c.short_name === form.company);
    if (!recruiter || !companyRow) {
      setError("Vui lòng chọn công ty và người tuyển hợp lệ trong danh mục.");
      return;
    }

    if (!confirmed) {
      setChecking(true);
      setError("");
      try {
        const hits = await checkLiveDuplicates({
          code: form.code.trim() || null,
          national_id: form.citizenId.trim() || null,
          phone: form.phone.trim() || null,
          full_name: form.name.trim() || null,
          date_of_birth: form.dob || null,
        });
        const exact = hits.filter((h) => h.field === "worker_code" || h.field === "national_id" || h.level === "exact");
        const suspect = hits.filter((h) => !exact.includes(h));
        if (exact.length > 0) {
          setDupHits(hits);
          setError(`Trùng hồ sơ chính (${exact.map((h) => `${dupFieldLabel(h.field)} với ${h.matched_code} - ${h.matched_name}`).join("; ")}). Một lao động chỉ được dùng một hồ sơ duy nhất.`);
          return;
        }
        if (suspect.length > 0) {
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
      const newWorker = await createLiveWorker({
        code: form.code.trim() || undefined,
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        national_id: form.citizenId.trim() || null,
        date_of_birth: form.dob || null,
        hometown: form.hometown.trim() || null,
        employment_type: VI_TYPE[form.type] ?? "seasonal",
        recruiter_id: recruiter.id,
        current_company_id: companyRow.id,
        supervisor_id: form.supervisorId ? Number(form.supervisorId) : null,
        status: "candidate",
      });

      // Tai len anh CCCD neu co
      if (cccdFile && newWorker?.id) {
        try {
          const signed = await requestDocumentUpload(newWorker.id, {
            mime: cccdFile.type,
            filename: cccdFile.name || "cccd.png",
          });
          const put = await fetch(signed.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": cccdFile.type },
            body: cccdFile,
          });
          if (put.ok) {
            await saveWorkerDocument(newWorker.id, {
              doc_type: "national_id",
              storage_path: signed.path,
              mime: cccdFile.type,
            });
          }
        } catch {
          // Upload anh bo tro, khong chan tao ho so
        }
      }

      onCreated();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        const p = e.payload as { field?: string } | undefined;
        if (p?.field) {
          setFieldErrors((prev) => ({ ...prev, [p.field!]: e.message }));
        }
      } else {
        setError(e instanceof Error ? e.message : "Lưu thất bại.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tạo hồ sơ người lao động"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void save()}>
            {checking ? "Đang kiểm trùng..." : saving ? "Đang lưu..." : dupHits && dupHits.length > 0 ? "Vẫn lưu (xác nhận khác người)" : "Lưu hồ sơ"}
          </Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">{error}</p>}
      {dupHits && dupHits.length > 0 && !error && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Nghi ngờ trùng SĐT với {dupHits.map(h => `${h.matched_code} (${h.matched_name})`).join(", ")}. Theo quy định, SĐT trùng chỉ đánh dấu nghi trùng (có thể dùng chung SĐT người thân). Nhấn “Vẫn lưu” nếu đã xác nhận đây là NLĐ khác.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3" onPaste={handleCccdPaste}>
        <Field label="Mã NLĐ (để trống để tự tạo)" error={fieldErrors.code}>
          <input
            className={getInputClass(fieldErrors.code)}
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder="Hệ thống tự sinh (VD: NLD-212)"
          />
        </Field>
        <Field label="Họ và tên *" error={fieldErrors.name}>
          <input
            className={getInputClass(fieldErrors.name)}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="VD: Nguyễn Văn A"
          />
        </Field>
        <Field label="Số điện thoại *" error={fieldErrors.phone}>
          <input
            className={getInputClass(fieldErrors.phone)}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="VD: 0987654321"
          />
        </Field>

        {/* Khu vuc CCCD & Copy anh CCCD */}
        <div className="col-span-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3 transition-colors hover:border-[#0052cc]">
          <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
            <label className="text-[12.5px] font-semibold text-slate-700">
              CCCD / Copy ảnh CCCD
            </label>
            <span className="text-[11.5px] text-blue-600 font-medium">
              💡 Bấm Ctrl+V tại đây để dán ảnh CCCD từ Zalo/Clipboard
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[200px]">
              <input
                className={getInputClass(fieldErrors.citizenId)}
                value={form.citizenId}
                onChange={(e) => set("citizenId", e.target.value)}
                placeholder="Nhập 12 số CCCD (hoặc dán ảnh)"
              />
              {fieldErrors.citizenId && (
                <p className="mt-1 text-[11.5px] font-medium text-rose-600">{fieldErrors.citizenId}</p>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <span>📁 Chọn ảnh CCCD</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFile(file);
                }}
              />
            </label>
          </div>

          {cccdPreview && (
            <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2">
              <img
                src={cccdPreview}
                alt="Ảnh CCCD"
                className="h-14 w-24 rounded border border-slate-200 object-cover shadow-sm"
              />
              <div className="flex-1 text-[12px]">
                <div className="font-bold text-emerald-800">✓ Đã đính kèm ảnh CCCD</div>
                <div className="text-slate-500">
                  {cccdFile?.name || "Ảnh từ clipboard"} ({((cccdFile?.size || 0) / 1024).toFixed(0)} KB)
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCccdFile(null);
                  setCccdPreview(null);
                }}
                className="rounded px-2 py-1 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-100"
              >
                Gỡ ảnh
              </button>
            </div>
          )}
        </div>

        <Field label="Ngày sinh" error={fieldErrors.dob}>
          <input
            type="date"
            className={getInputClass(fieldErrors.dob)}
            value={form.dob}
            onChange={(e) => set("dob", e.target.value)}
          />
        </Field>
        <Field label="Quê quán" error={fieldErrors.hometown}>
          <input
            className={getInputClass(fieldErrors.hometown)}
            value={form.hometown}
            onChange={(e) => set("hometown", e.target.value)}
            placeholder="Tỉnh/Thành phố"
          />
        </Field>
        <Field label="Công ty" error={fieldErrors.company}>
          <select
            className={getInputClass(fieldErrors.company)}
            value={form.company}
            onChange={(e) => set("company", e.target.value)}
          >
            {companies.map((c) => (<option key={c.id} value={c.short_name}>{c.short_name}</option>))}
          </select>
        </Field>
        <Field label="Người quản lý (đón tại NM)">
          <select
            className={inputClass}
            value={form.supervisorId}
            onChange={(e) => set("supervisorId", e.target.value)}
          >
            <option value="">— Chọn người đón tại nhà máy —</option>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} · {s.phone} {s.title ? `(${s.title})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Loại hình" error={fieldErrors.type}>
          <select
            className={getInputClass(fieldErrors.type)}
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            <option value="Thời vụ">Thời vụ</option>
            <option value="Chính thức">Chính thức</option>
          </select>
        </Field>
        <Field label="Người tuyển" error={fieldErrors.recruiter}>
          <select
            className={getInputClass(fieldErrors.recruiter)}
            value={form.recruiter}
            onChange={(e) => set("recruiter", e.target.value)}
          >
            {staff.map((s) => (<option key={s.id} value={s.full_name}>{s.full_name}</option>))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

export function EditWorkerModal({
  worker, onClose, onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { staff } = useApp();
  const matchedRecruiter = worker.recruiterId
    ? String(worker.recruiterId)
    : staff.find((s) => s.full_name === worker.recruiter)?.id
    ? String(staff.find((s) => s.full_name === worker.recruiter)?.id)
    : "";

  const [form, setForm] = useState({
    name: worker.name,
    phone: worker.phone,
    citizenId: worker.citizenId,
    hometown: worker.hometown,
    position: worker.position,
    type: worker.type,
    status: worker.status,
    recruiterId: matchedRecruiter,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<WorkerAuditHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await fetchLiveWorkerHistory(worker.id);
        if (active) setHistory(list);
      } catch {
        // Khong chan modal neu khong tai duoc lich su
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [worker.id]);

  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setFieldErrors((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  };

  const save = async () => {
    setError("");
    const parsed = EditWorkerSchema.safeParse(form);
    if (!parsed.success) {
      const errs = formatZodErrors(parsed.error);
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    setError("");
    try {
      await updateLiveWorker(worker.id, {
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        national_id: form.citizenId.trim() || null,
        hometown: form.hometown.trim() || null,
        current_position: form.position.trim(),
        employment_type: VI_TYPE[form.type] ?? "seasonal",
        status: VI_STATUS[form.status] ?? "working",
        recruiter_id: form.recruiterId ? Number(form.recruiterId) : null,
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
        {/* Khối bảo lưu thông tin người tạo ban đầu */}
        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[12.5px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-slate-800">📌 Thông tin người tạo ban đầu (Bảo lưu gốc)</span>
            <span className="text-[11px] text-slate-400 italic">Bảo vệ vĩnh viễn không bị ghi đè</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>
              Người nhập hồ sơ gốc: <strong className="text-slate-800">{worker.creator || "Hệ thống"}</strong>
            </div>
            <div>
              Thời gian gia nhập / tạo: <strong className="text-slate-800">{formatDateTime(worker.createdAt)}</strong>
            </div>
          </div>
        </div>

        <Field label="Họ và tên *" error={fieldErrors.name}>
          <input
            className={getInputClass(fieldErrors.name)}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Số điện thoại *" error={fieldErrors.phone}>
          <input
            className={getInputClass(fieldErrors.phone)}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="CCCD / Định danh" error={fieldErrors.citizenId}>
          <input
            className={getInputClass(fieldErrors.citizenId)}
            value={form.citizenId}
            onChange={(e) => set("citizenId", e.target.value)}
            placeholder="12 chữ số"
          />
        </Field>
        <Field label="Quê quán" error={fieldErrors.hometown}>
          <input
            className={getInputClass(fieldErrors.hometown)}
            value={form.hometown}
            onChange={(e) => set("hometown", e.target.value)}
          />
        </Field>
        <Field label="Vị trí *" error={fieldErrors.position}>
          <input
            className={getInputClass(fieldErrors.position)}
            value={form.position}
            onChange={(e) => set("position", e.target.value)}
          />
        </Field>
        <Field label="Loại hình" error={fieldErrors.type}>
          <select
            className={getInputClass(fieldErrors.type)}
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            <option value="Thời vụ">Thời vụ</option>
            <option value="Chính thức">Chính thức</option>
          </select>
        </Field>
        <Field label="Trạng thái" error={fieldErrors.status}>
          <select
            className={getInputClass(fieldErrors.status)}
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </Field>
        <Field label="Người tuyển dụng phụ trách" error={fieldErrors.recruiterId}>
          <select
            className={getInputClass(fieldErrors.recruiterId)}
            value={form.recruiterId}
            onChange={(e) => set("recruiterId", e.target.value)}
          >
            <option value="">— Chưa phân công —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </Field>

        {/* Khối lịch sử chỉnh sửa hồ sơ */}
        <div className="col-span-2 mt-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-slate-800">🕒 Lịch sử chỉnh sửa gần đây</span>
            <span className="text-[11.5px] text-slate-400">Ghi nhận người sửa & thời gian sửa</span>
          </div>
          {loadingHistory ? (
            <div className="py-2 text-[12px] text-slate-400">Đang tải lịch sử...</div>
          ) : history.length === 0 ? (
            <div className="py-2 text-[12px] italic text-slate-400">Chưa có lịch sử chỉnh sửa trước đây</div>
          ) : (
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 text-[12px]">
              {history.map((h) => (
                <div key={h.id} className="py-2 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-slate-800">{h.actor_name || "Nhân viên"}</span>
                    <span className="ml-1.5 text-slate-600">({h.detail || h.action})</span>
                  </div>
                  <span className="whitespace-nowrap text-[11.5px] text-slate-400">{formatDateTime(h.occurred_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

