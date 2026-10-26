import { apiDelete, apiDownload, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { ApiOptions, DownloadResult } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import { RESIGNED_STATUS, WORKER_STATUS_LABEL } from "@/lib/worker-status";
import type { OrderSummary, Worker, WorkerType, WorkAssignment } from "@/types/hrm";

// Cac dong tra ve tu BE (view v_* trong schema trangway).

export interface LiveOrderRow {
  order_id: number;
  code: string;
  company: string;
  company_name: string;
  name: string;
  start_date: string;
  end_date: string;
  owner: string;
  status: string;
  health: "on_track" | "slightly_late" | "at_risk" | string;
  target_qty: number;
  working_qty: number;
  waiting_qty: number;
  interview_qty: number;
  applied_qty: number;
  assigned_qty: number;
  total_profiles: number;
  position_count: number;
  vendor_count: number;
  card_note?: string | null;
  video_url?: string | null;
  image_urls?: string[];
  pinned_at?: string | null;
}

export function pinLiveOrder(orderId: number, pinned: boolean): Promise<{ id: number; pinned_at: string | null }> {
  return apiPatch(`/orders/${orderId}/pin`, { pinned });
}

export interface LivePositionRow {
  order_id: number;
  sort_order: number;
  title: string;
  target_qty: number;
  working_qty: number;
}

export interface LivePeriodDashboard {
  code: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  order_count: number;
  target_qty: number;
  working_qty: number;
  total_work_days: number;
  approved_advances: number;
  advance_workers: number;
}

export function fetchLiveOrders(period: string): Promise<LiveOrderRow[]> {
  return apiGet<LiveOrderRow[]>(`/orders?period=${encodeURIComponent(period)}`, { timeoutMs: 60000 });
}

export function saveLiveOrderMedia(
  orderId: number,
  body: { video_url?: string; images?: string[] },
): Promise<{ video_url: string; images: string[] }> {
  return apiPost(`/orders/${orderId}/media`, body, { timeoutMs: 60000 });
}

export function fetchLivePositions(): Promise<LivePositionRow[]> {
  return apiGet<LivePositionRow[]>(`/positions`);
}

export function fetchLiveDashboard(code: string): Promise<LivePeriodDashboard> {
  return apiGet<LivePeriodDashboard>(`/periods/${encodeURIComponent(code)}/dashboard`);
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const ORDER_STATUS: Record<string, string> = {
  running: "Đang chạy",
  open: "Đang chạy",
  completed: "Đã hoàn thành",
  closed: "Đã đóng",
  draft: "Nháp",
};

function healthLabel(h: string): OrderSummary["health"] {
  if (h === "slightly_late") return "Chậm tiến độ";
  if (h === "at_risk") return "Có rủi ro";
  return "Đúng tiến độ";
}

export function toOrderSummary(row: LiveOrderRow, positions: LivePositionRow[]): OrderSummary {
  const items = positions
    .filter((p) => p.order_id === row.order_id)
    .map((p, i) => ({
      idx: String(i + 1).padStart(2, "0"),
      name: p.title,
      done: p.working_qty,
      total: p.target_qty,
    }));
  return {
    orderId: row.order_id,
    code: row.code,
    title: `${row.company} – ${row.name}`,
    period: `${fmtDate(row.start_date)} – ${fmtDate(row.end_date)}`,
    manager: row.owner,
    target: row.target_qty,
    working: row.working_qty,
    positions: row.position_count,
    vendors: row.vendor_count,
    status: ORDER_STATUS[row.status] ?? row.status,
    health: healthLabel(row.health),
    items:
      items.length > 0
        ? items
        : [{ idx: "01", name: row.name, done: row.working_qty, total: row.target_qty }],
    funnel: [
      { label: "Đã đi làm", value: row.working_qty, tone: "green" },
      { label: "Chờ nhận việc", value: row.waiting_qty, tone: "blue" },
      { label: "Hẹn PV", value: row.interview_qty, tone: "orange" },
      { label: "Mới ứng tuyển", value: row.applied_qty, tone: "grey" },
    ],
    totalProfiles: row.total_profiles,
    cardNote: row.card_note ?? null,
    videoUrl: row.video_url ?? "",
    imageUrls: row.image_urls ?? [],
    pinnedAt: row.pinned_at ?? null,
  };
}

// ---- Nguoi lao dong (live, view v_workers_public) ----

export interface LiveWorkerRow {
  id: number;
  code: string;
  full_name: string;
  phone: string;
  phone_hidden?: boolean;
  hometown: string | null;
  national_id_masked: string | null;
  national_id_full?: string | null;
  company: string | null;
  current_position: string | null;
  employment_type: string;
  status: string;
  recruiter_id: number | null;
  recruiter_name: string | null;
  recruited_by: string | null;
  manager_id?: number | null;
  manager_name?: string | null;
  created_by?: number | null;
  consult_date?: string | null;
  start_work_date?: string | null;
  resign_date?: string | null;
  supervisor_name: string | null;
  supervisor_phone: string | null;
  assignment_count: number;
  open_duplicate_alerts: number;
}

const EN_STATUS = WORKER_STATUS_LABEL;

export const VI_STATUS: Record<string, string> = {
  "Đang làm": "working",
  "Chờ đi làm": "waiting_start",
  "Tạm nghỉ": "on_leave",
  "Nghỉ việc": "resigned",
  "Không đi làm": "no_show",
  "Đang tư vấn": "candidate",
  "Ứng viên": "candidate",
};

const EN_TYPE: Record<string, WorkerType> = { seasonal: "Thời vụ", official: "Chính thức" };
export const VI_TYPE: Record<string, string> = { "Thời vụ": "seasonal", "Chính thức": "official" };

const AVATARS = ["avatar-blue", "avatar-rose", "avatar-indigo", "avatar-purple", "avatar-emerald", "avatar-amber", "avatar-teal", "avatar-cyan"];

export function toWorker(row: LiveWorkerRow): Worker {
  return {
    id: row.id,
    code: row.code,
    name: row.full_name,
    phone: row.phone ?? "",
    phoneHidden: Boolean(row.phone_hidden),
    hometown: row.hometown ?? "",
    citizenId: row.national_id_full ?? row.national_id_masked ?? "",
    company: row.company ?? "—",
    position: row.current_position ?? "—",
    type: EN_TYPE[row.employment_type] ?? (row.employment_type as Worker["type"]),
    recruiter: row.recruited_by ?? row.recruiter_name ?? "",
    introducer: "",
    manager: row.manager_name ?? row.supervisor_name ?? "",
    status: EN_STATUS[row.status] ?? (row.status as Worker["status"]),
    dailyRate: 0,
    workedDays: 0,
    advance: 0,
    avatarColor: AVATARS[Math.abs(row.id) % AVATARS.length] ?? "avatar-blue",
    initials: initialsOf(row.full_name),
    consultDate: row.consult_date ?? "",
    startWorkDate: row.start_work_date ?? "",
    resignDate: row.resign_date ?? "",
    recruiterId: row.recruiter_id,
    managerId: row.manager_id ?? null,
    createdBy: row.created_by ?? null,
  };
}

export interface WorkerFilter {
  company?: string;
  statusEn?: string;
  typeEn?: string;
  q?: string;
  recruiterId?: number;
  managerId?: number;
  limit?: number;
  offset?: number;
}

export interface WorkerPage {
  rows: LiveWorkerRow[];
  total: number;
  limit: number;
  offset: number;
}

export function fetchLiveWorkers(f?: WorkerFilter, opts?: ApiOptions): Promise<WorkerPage> {
  const p = new URLSearchParams();
  if (f?.company) p.set("company", f.company);
  if (f?.statusEn) p.set("status", f.statusEn);
  if (f?.typeEn) p.set("type", f.typeEn);
  if (f?.q) p.set("q", f.q);
  if (f?.recruiterId) p.set("recruiter_id", String(f.recruiterId));
  if (f?.managerId) p.set("manager_id", String(f.managerId));
  if (f?.limit) p.set("limit", String(f.limit));
  if (f?.offset) p.set("offset", String(f.offset));
  const qs = p.toString();
  return apiGet<WorkerPage>(`/workers${qs ? `?${qs}` : ""}`, opts);
}

export interface WorkerCreateBody {
  code?: string;
  full_name: string;
  phone: string;
  national_id: string;
  date_of_birth: string | null;
  hometown: string | null;
  employment_type: string;
  recruiter_id: number;
  manager_id: number;
  current_company_id: number;
  status: string;
  note?: string | null;
  consult_date?: string | null;
  start_work_date?: string | null;
  resign_date?: string | null;
}

export function createLiveWorker(body: WorkerCreateBody): Promise<LiveWorkerRow> {
  return apiPost<LiveWorkerRow>("/workers", body);
}

// ---- Giay to NLD (bucket worker-private, doc_type portrait | national_id) ----
const WORKER_DOC_MIME = ["image/jpeg", "image/png", "image/webp"];

export function requestWorkerDocUploadUrl(
  workerId: number,
  body: { mime: string; filename: string },
): Promise<{ path: string; token: string; signedUrl: string }> {
  return apiPost(`/workers/${workerId}/documents/upload-url`, body);
}

export function saveWorkerDocument(
  workerId: number,
  body: { doc_type: "portrait" | "national_id"; storage_path: string; mime: string },
): Promise<{ id: number }> {
  return apiPost(`/workers/${workerId}/documents`, body);
}

export async function uploadWorkerPortrait(workerId: number, file: File): Promise<void> {
  if (!WORKER_DOC_MIME.includes(file.type)) {
    throw new Error("Chỉ nhận ảnh JPEG, PNG hoặc WebP.");
  }
  const signed = await requestWorkerDocUploadUrl(workerId, { mime: file.type, filename: file.name || "portrait.jpg" });
  const put = await fetch(signed.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!put.ok) throw new Error("Tải ảnh lên kho lưu trữ thất bại.");
  await saveWorkerDocument(workerId, { doc_type: "portrait", storage_path: signed.path, mime: file.type });
}

// ---- Kiem trung truoc khi luu (rule 11): exact = chan, suspect = canh bao van cho luu
export interface DuplicateHit {
  matched_worker_id: number;
  matched_code: string;
  matched_name: string;
  field: string;
  level: "exact" | "suspect" | string;
  matched_value: string;
  matched_status?: string | null;
}

// Chỉ tái tuyển / tạo mới được khi hồ sơ trùng đã Nghỉ việc.
export function isRehirableDuplicate(hit: DuplicateHit): boolean {
  return hit.matched_status === RESIGNED_STATUS;
}

export function checkLiveDuplicates(body: {
  code?: string | null;
  national_id?: string | null;
  old_id_number?: string | null;
  phone?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
}): Promise<DuplicateHit[]> {
  return apiPost<DuplicateHit[]>("/workers/check-duplicates", body);
}

export function dupFieldLabel(field: string): string {
  if (field === "worker_code") return "Mã NLĐ";
  if (field === "national_id") return "CCCD";
  if (field === "old_id_number") return "CMND cũ";
  if (field === "phone") return "SĐT";
  if (field === "name_dob") return "Tên + ngày sinh";
  return field;
}

export function updateLiveWorker(id: number, body: {
  full_name?: string;
  phone?: string;
  hometown?: string | null;
  current_position?: string;
  employment_type?: string;
  status?: string;
  recruiter_id?: number;
  manager_id?: number;
  current_company_id?: number;
  consult_date?: string | null;
  start_work_date?: string | null;
  resign_date?: string | null;
}): Promise<unknown> {
  return apiPatch(`/workers/${id}`, body);
}

export function deleteLiveWorker(id: number): Promise<unknown> {
  return apiDelete(`/workers/${id}`);
}

// ---- Dot lam viec (live, view v_worker_assignments) ----

export interface LiveAssignmentRow {
  placement_id: number;
  worker_id: number;
  worker_code: string;
  company: string;
  work_site: string | null;
  order_id: number;
  order_code: string;
  order_name: string;
  position: string;
  shift: string | null;
  stage: string;
  start_date: string;
  end_date: string | null;
  end_reason: string | null;
  is_current: boolean;
  recruiter: string | null;
  supervisor_name: string | null;
  supervisor_phone: string | null;
  handover_status: string | null;
}

export function fetchLiveAssignments(workerId: number): Promise<LiveAssignmentRow[]> {
  return apiGet<LiveAssignmentRow[]>(`/workers/${workerId}/assignments`);
}

export function toWorkAssignment(a: LiveAssignmentRow): WorkAssignment {
  return {
    id: String(a.placement_id),
    company: a.company,
    orderCode: a.order_code,
    position: a.position,
    startDate: a.start_date,
    endDate: a.end_date,
    recruiter: a.recruiter ?? "",
  };
}

export function addLivePlacement(body: {
  worker_id: number;
  order_code: string;
  position?: string;
  recruiter_id?: number | null;
  start_date: string;
}): Promise<unknown> {
  return apiPost("/placements/by-code", { stage: "working", ...body });
}

export function closeLivePlacement(placementId: number, end_date: string, end_reason?: string): Promise<unknown> {
  return apiPatch(`/placements/${placementId}/end`, { end_date, end_reason });
}

// ---- Luong live (view v_payroll_preview) ----

export interface LivePayrollRow {
  code: string;
  full_name: string;
  companies?: string | null;
  work_days: number | string;
  wage_amount: number | string;
  extra_amount: number | string;
  deduction: number | string;
  advance_amount: number | string;
  net_amount: number | string;
  has_variance: boolean;
}

export function fetchLivePayroll(period: string, workerCode?: string): Promise<LivePayrollRow[]> {
  const p = new URLSearchParams({ period });
  if (workerCode) p.set("worker", workerCode);
  return apiGet<LivePayrollRow[]>(`/payroll?${p.toString()}`);
}

export function generateLivePayroll(period: string): Promise<{ ok: boolean; result: unknown }> {
  return apiPost(`/payroll/${encodeURIComponent(period)}/generate`, {}, { timeoutMs: 120000 });
}

// ---- Danh muc (de map id khi tao/sua) ----

export interface LiveStaff {
  id: number;
  code: string;
  full_name: string;
  role: string;
  title?: string | null;
}

export interface LivePersonnel extends LiveStaff {
  initials: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  date_of_birth: string | null;
  hired_on: string | null;
}

export interface LiveCompany {
  id: number;
  code: string;
  short_name: string;
  name: string;
  hotline?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  bill_rate_per_day?: number | null;
  status?: string;
}

export interface LivePeriod {
  id: number;
  code: string;
  name: string;
  type: string;
  status: string;
  start_date: string;
  end_date: string;
}

export interface LiveTeam {
  id: number;
  code: string;
  name: string;
  region: string | null;
  leader_id: number | null;
  status: string;
  leader: { full_name: string } | { full_name: string }[] | null;
}

export function fetchLiveStaff(): Promise<LiveStaff[]> {
  return apiGet<LiveStaff[]>("/staff");
}

export function fetchLivePersonnel(): Promise<LivePersonnel[]> {
  return apiGet<LivePersonnel[]>("/staff?directory=1");
}

export interface PersonnelWrite {
  full_name: string;
  department: string;
  phone?: string | null;
  email?: string | null;
  position?: string | null;
  date_of_birth?: string | null;
  hired_on?: string | null;
  status: string;
}

export function createLivePersonnel(body: { department: string; full_name: string; position?: string; phone?: string; email?: string; date_of_birth?: string | null; hired_on?: string | null; pin: string }): Promise<LivePersonnel[]> {
  return apiPost<LivePersonnel[]>("/staff", body);
}

export function changePinLive(body: { old_pin: string; new_pin: string }): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/auth/change-pin", body);
}

export function resetStaffPinLive(id: number, body: { new_pin: string }): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>(`/staff/${id}/reset-pin`, body);
}

export function updateLivePersonnel(id: number, body: PersonnelWrite): Promise<LivePersonnel> {
  return apiPatch<LivePersonnel>(`/staff/${id}`, body);
}

export function deleteLivePersonnel(id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/staff/${id}`);
}

export function fetchLiveCompanies(): Promise<LiveCompany[]> {
  return apiGet<LiveCompany[]>("/companies");
}

export interface CompanyWrite {
  code: string;
  short_name: string;
  name: string;
  hotline?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  bill_rate_per_day?: number | null;
}

export function createLiveCompany(body: CompanyWrite): Promise<LiveCompany> {
  return apiPost("/companies", body);
}

export function updateLiveCompany(id: number, body: CompanyWrite): Promise<LiveCompany> {
  return apiPatch(`/companies/${id}`, body);
}

export function deleteLiveCompany(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/companies/${id}`);
}

export function fetchLivePeriods(): Promise<LivePeriod[]> {
  return apiGet<LivePeriod[]>("/periods");
}

export interface LiveAdvance {
  id: number;
  code: string;
  worker_id: number | null;
  staff_id?: number | null;
  subject_type?: "worker" | "staff" | string;
  amount: number;
  reason: string | null;
  status: string;
  advance_date: string;
  advance_time: string;
  requested_by: number | null;
  approved_by?: number | null;
  approved_at?: string | null;
  paid_at?: string | null;
  settled_at?: string | null;
  settled_amount?: number | null;
  note?: string | null;
  cashbook_entry_id?: number | null;
  legacy_salary_advance_id?: number | null;
  updated_at?: string | null;
  worker_name?: string | null;
  worker_code?: string | null;
  company_name?: string | null;
  staff_name?: string | null;
  giver_name: string | null;
  approver_name?: string | null;
  evidence_url: string | null;
}

export interface AdvanceFilter {
  workerId?: number;
  staffId?: number;
  subjectType?: "worker" | "staff";
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
}

export function fetchLiveAdvances(arg?: number | AdvanceFilter): Promise<LiveAdvance[]> {
  const p = new URLSearchParams();
  if (typeof arg === "number") {
    p.set("worker_id", String(arg));
  } else if (arg) {
    if (arg.workerId) p.set("worker_id", String(arg.workerId));
    if (arg.staffId) p.set("staff_id", String(arg.staffId));
    if (arg.subjectType) p.set("subject_type", arg.subjectType);
    if (arg.status) p.set("status", arg.status);
    if (arg.from) p.set("from", arg.from);
    if (arg.to) p.set("to", arg.to);
    if (arg.q) p.set("q", arg.q);
    if (arg.limit) p.set("limit", String(arg.limit));
  }
  const qs = p.toString();
  return apiGet(`/advances${qs ? `?${qs}` : ""}`);
}

export interface AdvanceWrite {
  subject_type?: "worker" | "staff";
  worker_id?: number | null;
  staff_id?: number | null;
  amount: number;
  reason: string;
  advance_date: string;
  advance_time: string;
  requested_by: number;
  note?: string | null;
  evidence?: string;
}

export function createLiveAdvance(body: AdvanceWrite): Promise<LiveAdvance> {
  return apiPost("/advances", body, { timeoutMs: 60000 });
}

export function updateLiveAdvance(
  id: number,
  body: { amount?: number; reason?: string; advance_date?: string; advance_time?: string; note?: string | null },
): Promise<LiveAdvance> {
  return apiPatch(`/advances/${id}`, body);
}

export interface AdvanceExportFilter {
  from?: string;
  to?: string;
  month?: string;
  status?: string;
  subjectType?: "worker" | "staff" | "";
  q?: string;
}

export function downloadLiveAdvancesExcel(filter: AdvanceExportFilter): Promise<DownloadResult> {
  const p = new URLSearchParams();
  if (filter.month) p.set("month", filter.month);
  if (filter.from) p.set("from", filter.from);
  if (filter.to) p.set("to", filter.to);
  if (filter.status) p.set("status", filter.status);
  if (filter.subjectType) p.set("subject_type", filter.subjectType);
  if (filter.q) p.set("q", filter.q);
  return apiDownload(`/advances/export?${p.toString()}`);
}

export interface AdvanceMonthClose {
  month_code: string;
  closed_at: string;
  closed_by: number | null;
  note: string | null;
}

export interface AdvanceMonthRow {
  month_code: string;
  status: "open" | "closed";
  closed_at: string | null;
  closed_by: number | null;
  note: string | null;
  advance_count: number;
  total_amount: number;
  open_count: number;
  is_current: boolean;
}

export interface AdvanceMonthsResponse {
  current_month: string;
  current_closed: boolean;
  closed: AdvanceMonthClose[];
  months: AdvanceMonthRow[];
}

export function fetchLiveAdvanceMonths(): Promise<AdvanceMonthsResponse> {
  return apiGet("/advances/months");
}

export function closeLiveAdvanceMonth(
  month: string,
  note?: string,
): Promise<AdvanceMonthClose & { next_month: string | null }> {
  return apiPost("/advances/months/close", { month, note });
}

export function reopenLiveAdvanceMonth(month: string): Promise<{ month_code: string; status: "open" }> {
  return apiPost("/advances/months/reopen", { month });
}

export function deleteLiveAdvanceMonthClose(
  month: string,
): Promise<{ month_code: string; status: "open"; deleted: boolean }> {
  return apiDelete(`/advances/months/close?month=${encodeURIComponent(month)}`);
}

export function cancelLiveAdvance(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/advances/${id}`);
}

export function approveLiveAdvance(id: number, status: "approved" | "rejected"): Promise<LiveAdvance> {
  return apiPatch(`/advances/${id}/approve`, { status });
}

export function payLiveAdvance(id: number): Promise<{ ok: boolean; result: unknown }> {
  return apiPatch(`/advances/${id}/pay`, {});
}

export function settleLiveAdvance(id: number, settled_amount?: number): Promise<LiveAdvance> {
  return apiPatch(`/advances/${id}/settle`, { settled_amount });
}

// ---- Sổ chi hàng ngày ----

export interface LiveCashbookEntry {
  id: number;
  entry_date: string;
  content: string;
  full_name: string | null;
  company_name: string | null;
  amount: number;
  note: string | null;
  group_code: string;
  group_name: string | null;
  source_type?: string | null;
  source_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CashbookFilter {
  from?: string;
  to?: string;
  group?: string;
  company?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function fetchLiveCashbook(filter?: CashbookFilter): Promise<Page<LiveCashbookEntry>> {
  const p = new URLSearchParams();
  if (filter?.from) p.set("from", filter.from);
  if (filter?.to) p.set("to", filter.to);
  if (filter?.group) p.set("group", filter.group);
  if (filter?.company) p.set("company", filter.company);
  if (filter?.q) p.set("q", filter.q);
  if (filter?.limit) p.set("limit", String(filter.limit));
  if (filter?.offset) p.set("offset", String(filter.offset));
  const qs = p.toString();
  return apiGet(`/cashbook${qs ? `?${qs}` : ""}`);
}

export interface CashbookWrite {
  entry_date: string;
  content: string;
  full_name?: string | null;
  company_name?: string | null;
  amount: number;
  note?: string | null;
  group_code: string;
}

export function createLiveCashbookEntry(body: CashbookWrite): Promise<LiveCashbookEntry> {
  return apiPost("/cashbook", body);
}

export function updateLiveCashbookEntry(id: number, body: Partial<CashbookWrite>): Promise<LiveCashbookEntry> {
  return apiPatch(`/cashbook/${id}`, body);
}

export function deleteLiveCashbookEntry(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/cashbook/${id}`);
}

export interface CashbookSummaryRow {
  period: string;
  total: number;
  weekly_wage: number;
  office: number;
  count: number;
}

export interface CashbookSummary {
  from: string;
  to: string;
  group_by: "day" | "month";
  rows: CashbookSummaryRow[];
  totals: CashbookSummaryRow;
}

export function fetchCashbookSummary(params: {
  from: string;
  to: string;
  groupBy: "day" | "month";
  group?: string;
}): Promise<CashbookSummary> {
  const p = new URLSearchParams({ from: params.from, to: params.to, group_by: params.groupBy });
  if (params.group) p.set("group", params.group);
  return apiGet(`/cashbook/summary?${p.toString()}`);
}

export interface Page<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LiveAttendance {
  id: number;
  worker_id?: number | null;
  work_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_distance_m: number | null;
  work_units: number | string | null;
  status: string;
  worker: { code: string; full_name: string } | null;
  site: { name: string } | null;
  shift: { name: string } | null;
}

export function fetchLiveAttendances(date?: string): Promise<Page<LiveAttendance>> {
  const p = new URLSearchParams({ limit: "100" });
  if (date) p.set("date", date);
  return apiGet(`/attendances?${p.toString()}`);
}

export async function fetchLiveAttendancesRange(from: string, to: string): Promise<LiveAttendance[]> {
  const limit = 200;
  const rows: LiveAttendance[] = [];
  let offset = 0;
  for (let page = 0; page < 25; page += 1) {
    const p = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      from,
      to,
    });
    const data = await apiGet<Page<LiveAttendance>>(`/attendances?${p.toString()}`);
    rows.push(...data.rows);
    offset += data.rows.length;
    if (data.rows.length === 0 || offset >= data.total) break;
  }
  return rows;
}

export function checkInLive(body: { staff_id?: number; worker_id?: number; check_in_lat?: number; check_in_lng?: number }): Promise<LiveAttendance> {
  return apiPost("/attendances/check-in", body);
}

export function checkOutLive(id: number, body: { check_out_lat?: number; check_out_lng?: number } = {}): Promise<LiveAttendance> {
  return apiPost(`/attendances/${id}/check-out`, body);
}

export interface LiveFinanceTx {
  id: number;
  code: string;
  txn_date: string;
  type: string;
  description: string | null;
  amount: number;
  status: string;
  created_by: number | null;
  category: { name: string } | null;
  company: { short_name: string } | null;
  worker: { code: string; full_name: string } | null;
}

export function fetchLiveFinance(): Promise<Page<LiveFinanceTx>> {
  return apiGet("/finance/transactions?limit=100");
}

export interface LiveCommission {
  id: number;
  company_name: string;
  unit_price: number | string;
  period_code: string;
  worker_count: number | string;
  commission_amount: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface CommissionWrite {
  company_name: string;
  unit_price: number;
  period_code: string;
}

export function fetchLiveCommissions(period: string): Promise<LiveCommission[]> {
  return apiGet<LiveCommission[]>(`/commissions?period=${encodeURIComponent(period)}`, { timeoutMs: 60000 });
}

export function createLiveCommission(body: CommissionWrite): Promise<LiveCommission> {
  return apiPost("/commissions", body);
}

export function updateLiveCommission(id: number, body: Partial<CommissionWrite>): Promise<LiveCommission> {
  return apiPatch(`/commissions/${id}`, body);
}

export function deleteLiveCommission(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/commissions/${id}`);
}

export interface LiveAudit {
  id: number;
  occurred_at: string;
  actor_id: number | null;
  actor_role: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  detail: string | null;
  ip_address: string | null;
}

export function fetchLiveAudit(): Promise<Page<LiveAudit>> {
  return apiGet("/audit-logs?limit=100");
}

export interface LiveRecruiter {
  source_type: string;
  source_id: number;
  source_code: string;
  source_name: string;
  total_workers: number;
  working: number;
  waiting_start: number;
  inactive: number;
}

export function fetchLiveRecruiters(): Promise<LiveRecruiter[]> {
  return apiGet("/recruiters");
}

export interface WorkerSaleStatus {
  sale: string;
  counts: Record<string, number>;
  total: number;
}

export function fetchWorkerStatusBySale(): Promise<{ sales: WorkerSaleStatus[] }> {
  return apiGet("/workers/by-sale");
}

export interface LiveVendor {
  id: number;
  code: string;
  name: string;
  short_name: string | null;
  type: string | null;
  representative: string | null;
  phone: string | null;
  contract_active: boolean | null;
  fee_per_worker_day: number | null;
  status: string | null;
}

export interface LiveVendorQuota {
  id: number;
  quota_qty: number;
  sla_target_pct: number | null;
  handover_deadline: string | null;
  vendor: { name: string; short_name: string | null; phone: string | null; representative: string | null; status: string | null } | null;
  company: { short_name: string } | null;
}

export function fetchLiveVendors(): Promise<LiveVendor[]> {
  return apiGet("/vendors");
}

export interface VendorWriteBody {
  code: string;
  name: string;
  short_name: string | null;
  type: string | null;
  representative: string | null;
  phone: string | null;
  contract_active: boolean;
  fee_per_worker_day: number | null;
  status: string;
}

export function createLiveVendor(body: VendorWriteBody): Promise<LiveVendor> {
  return apiPost("/vendors", body);
}

export function updateLiveVendor(id: number, body: VendorWriteBody): Promise<LiveVendor> {
  return apiPatch(`/vendors/${id}`, body);
}

export function deleteLiveVendor(id: number): Promise<unknown> {
  return apiDelete(`/vendors/${id}`);
}

export function fetchLiveVendorQuotas(): Promise<LiveVendorQuota[]> {
  return apiGet("/vendor-quotas");
}

export interface LiveSite {
  id: number;
  company_id: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number | null;
  status: string | null;
}

export function fetchLiveSites(companyId?: number): Promise<LiveSite[]> {
  if (companyId) return apiGet(`/companies/${companyId}/sites`);
  return apiGet("/companies/sites");
}

export interface LiveDailyReport {
  report_date: string;
  company: string;
  order_id: number;
  order_code: string;
  order_name: string;
  target_qty: number;
  active_qty: number;
  attended_qty: number;
  new_joins: number;
  left_qty: number;
  pending_handover: number;
  received_handover: number;
  missing_qty: number;
  note: string | null;
}

export function fetchLiveDailyReport(date: string): Promise<LiveDailyReport[]> {
  return apiGet(`/reports/daily?date=${encodeURIComponent(date)}`);
}

export function closeLivePeriod(code: string): Promise<unknown> {
  return apiPost(`/periods/${encodeURIComponent(code)}/close`, {});
}
