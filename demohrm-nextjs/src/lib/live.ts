import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { ApiOptions } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import type { OrderSummary, Worker, WorkerStatus, WorkerType, WorkAssignment } from "@/types/hrm";

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
  };
}

// ---- Nguoi lao dong (live, view v_workers_public) ----

export interface LiveWorkerRow {
  id: number;
  code: string;
  full_name: string;
  phone: string;
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
  supervisor_name: string | null;
  supervisor_phone: string | null;
  assignment_count: number;
  open_duplicate_alerts: number;
}

const EN_STATUS: Record<string, WorkerStatus> = {
  working: "Đang làm",
  waiting_start: "Chờ đi làm",
  on_leave: "Tạm nghỉ",
  resigned: "Nghỉ việc",
  no_show: "Không đi làm",
  candidate: "Đang tư vấn",
};

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
    hometown: row.hometown ?? "",
    citizenId: row.national_id_full ?? row.national_id_masked ?? "",
    company: row.company ?? "—",
    position: row.current_position ?? "—",
    type: EN_TYPE[row.employment_type] ?? "Thời vụ",
    recruiter: row.recruited_by ?? row.recruiter_name ?? "",
    introducer: "",
    manager: row.supervisor_name ?? "",
    status: EN_STATUS[row.status] ?? "Đang làm",
    dailyRate: 0,
    workedDays: 0,
    advance: 0,
    avatarColor: AVATARS[Math.abs(row.id) % AVATARS.length] ?? "avatar-blue",
    initials: initialsOf(row.full_name),
  };
}

export interface WorkerFilter {
  company?: string;
  statusEn?: string;
  typeEn?: string;
  q?: string;
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
  if (f?.limit) p.set("limit", String(f.limit));
  if (f?.offset) p.set("offset", String(f.offset));
  const qs = p.toString();
  return apiGet<WorkerPage>(`/workers${qs ? `?${qs}` : ""}`, opts);
}

export interface WorkerCreateBody {
  code: string;
  full_name: string;
  phone: string;
  national_id: string;
  date_of_birth: string | null;
  hometown: string | null;
  employment_type: string;
  recruiter_id: number;
  current_company_id: number;
  status: string;
}

export function createLiveWorker(body: WorkerCreateBody): Promise<LiveWorkerRow> {
  return apiPost<LiveWorkerRow>("/workers", body);
}

// ---- Kiem trung truoc khi luu (rule 11): exact = chan, suspect = canh bao van cho luu
export interface DuplicateHit {
  matched_worker_id: number;
  matched_code: string;
  matched_name: string;
  field: string;
  level: "exact" | "suspect" | string;
  matched_value: string;
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
  full_name: string;
  phone: string;
  hometown: string | null;
  current_position: string;
  employment_type: string;
  status: string;
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

export function createLivePersonnel(body: { department: string; full_name: string; position?: string; phone?: string; email?: string; date_of_birth?: string | null; hired_on?: string | null }): Promise<LivePersonnel[]> {
  return apiPost<LivePersonnel[]>("/staff", body);
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

export function createLiveAdvance(body: { worker_id: number; period_id: number; amount: number; reason: string }): Promise<unknown> {
  return apiPost("/advances", body);
}

export interface Page<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface LiveAttendance {
  id: number;
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
  period_code: string;
  code: string;
  full_name: string;
  company: string | null;
  work_days: number | string;
  rate_per_day: number | string;
  commission_amount: number | string;
}

export function fetchLiveCommissions(period: string): Promise<LiveCommission[]> {
  return apiGet(`/commissions?period=${encodeURIComponent(period)}`);
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
