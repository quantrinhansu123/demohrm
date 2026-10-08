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
  work_site?: string | null;
  site_address?: string | null;
  name: string;
  start_date: string;
  end_date: string;
  owner: string;
  owner_phone?: string | null;
  status: string;
  health: "on_track" | "slightly_late" | "at_risk" | string;
  target_qty: number;
  working_qty: number;
  waiting_qty: number;
  interview_qty: number;
  applied_qty: number;
  assigned_qty: number;
  missing_qty?: number;
  total_profiles: number;
  position_count: number;
  vendor_count: number;
}

export interface LivePositionRow {
  position_id?: number;
  order_id: number;
  sort_order: number;
  title: string;
  target_qty: number;
  working_qty: number;
  waiting_qty?: number;
  interview_qty?: number;
  applied_qty?: number;
  left_qty?: number;
  job_description?: string;
  shift?: string;
  start_time?: string;
  end_time?: string;
  wage_unit?: string;
  rate_amount?: number;
  day_rate?: number;
  rate_from?: string;
  rate_to?: string;
  progress_pct?: number;
  remaining_qty?: number;
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
  return apiGet<LiveOrderRow[]>(`/orders?period=${encodeURIComponent(period)}`);
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
      id: p.position_id,
      idx: String(i + 1).padStart(2, "0"),
      name: p.title,
      done: p.working_qty,
      total: p.target_qty,
      jobDescription: p.job_description,
      shift: p.shift ? `${p.shift}${p.start_time && p.end_time ? ` (${p.start_time.slice(0, 5)} - ${p.end_time.slice(0, 5)})` : ""}` : undefined,
      dayRate: p.day_rate,
      rateAmount: p.rate_amount,
      wageUnit: p.wage_unit,
      rateFrom: p.rate_from,
      rateTo: p.rate_to,
    }));
  const arranged = (row.working_qty ?? 0) + (row.waiting_qty ?? 0);
  const missing = row.missing_qty !== undefined ? row.missing_qty : Math.max(0, row.target_qty - (row.working_qty ?? 0));
  return {
    id: row.order_id,
    code: row.code,
    title: `${row.company} – ${row.name}`,
    period: `${fmtDate(row.start_date)} – ${fmtDate(row.end_date)}`,
    manager: row.owner,
    target: row.target_qty,
    working: row.working_qty,
    arranged,
    missing,
    companyName: row.company_name,
    workSite: row.work_site ?? undefined,
    siteAddress: row.site_address ?? undefined,
    ownerPhone: row.owner_phone ?? undefined,
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
  created_by?: number | null;
  creator_name?: string | null;
  created_at?: string | null;
  handover_status?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
}

const EN_STATUS: Record<string, WorkerStatus> = {
  working: "Đang làm",
  waiting_start: "Chờ đi làm",
  on_leave: "Tạm nghỉ",
  resigned: "Nghỉ việc",
  no_show: "Không đi làm",
  candidate: "Ứng viên",
};

export const VI_STATUS: Record<string, string> = {
  "Đang làm": "working",
  "Chờ đi làm": "waiting_start",
  "Tạm nghỉ": "on_leave",
  "Nghỉ việc": "resigned",
  "Không đi làm": "no_show",
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
    recruiter: row.recruited_by ?? "",
    recruiterId: row.recruiter_id ?? null,
    status: EN_STATUS[row.status] ?? "Đang làm",
    dailyRate: 0,
    workedDays: 0,
    advance: 0,
    avatarColor: AVATARS[Math.abs(row.id) % AVATARS.length] ?? "avatar-blue",
    initials: initialsOf(row.full_name),
    creator: row.creator_name ?? "",
    creatorId: row.created_by ?? null,
    createdAt: row.created_at ?? "",
    updatedBy: row.updated_by_name ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    supervisorName: row.supervisor_name ?? "",
    supervisorPhone: row.supervisor_phone ?? "",
    handoverStatus: row.handover_status ?? null,
  };
}

export interface WorkerFilter {
  company?: string;
  statusEn?: string;
  typeEn?: string;
  q?: string;
  recruiter_id?: number | string;
  created_by?: number | string;
  source_vendor_id?: number | string;
  handover_status?: string;
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
  if (f?.recruiter_id) p.set("recruiter_id", String(f.recruiter_id));
  if (f?.created_by) p.set("created_by", String(f.created_by));
  if (f?.source_vendor_id) p.set("source_vendor_id", String(f.source_vendor_id));
  if (f?.handover_status) p.set("handover_status", f.handover_status);
  if (f?.limit) p.set("limit", String(f.limit));
  if (f?.offset) p.set("offset", String(f.offset));
  const qs = p.toString();
  return apiGet<WorkerPage>(`/workers${qs ? `?${qs}` : ""}`, opts);
}

export interface WorkerCreateBody {
  code?: string;
  full_name: string;
  phone: string;
  national_id?: string | null;
  date_of_birth: string | null;
  hometown: string | null;
  employment_type: string;
  recruiter_id: number;
  current_company_id: number;
  supervisor_id?: number | null;
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
  recruiter_id?: number | null;
  created_by?: number | null;
  created_at?: string | null;
  national_id?: string | null;
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
  company_contact?: string | null;
  company_contact_phone?: string | null;
  handover_status: string | null;
}

export function fetchLiveAssignments(workerId: number): Promise<LiveAssignmentRow[]> {
  return apiGet<LiveAssignmentRow[]>(`/workers/${workerId}/assignments`);
}

export interface WorkerAuditHistoryItem {
  id: number;
  occurred_at: string;
  actor_name: string;
  action: string;
  detail: string | null;
}

export function fetchLiveWorkerHistory(workerId: number): Promise<WorkerAuditHistoryItem[]> {
  return apiGet<WorkerAuditHistoryItem[]>(`/workers/${workerId}/history`);
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
    companyContact: a.company_contact ?? undefined,
    companyContactPhone: a.company_contact_phone ?? undefined,
    supervisorName: a.supervisor_name ?? undefined,
    supervisorPhone: a.supervisor_phone ?? undefined,
  };
}

export function addLivePlacement(body: {
  worker_id: number;
  order_code: string;
  position?: string;
  recruiter_id?: number | null;
  supervisor_id?: number | null;
  start_date: string;
}): Promise<unknown> {
  return apiPost("/placements/by-code", { stage: "working", ...body });
}

export function closeLivePlacement(placementId: number, end_date: string, end_reason?: string): Promise<unknown> {
  return apiPatch(`/placements/${placementId}/end`, { end_date, end_reason });
}

// ---- Luong live (view v_payroll_preview) ----

export interface LivePayrollRow {
  worker_id?: number;
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

export function fetchLiveCompanies(): Promise<LiveCompany[]> {
  return apiGet<LiveCompany[]>("/companies");
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
  worker: { id?: number; code: string; full_name: string } | null;
  site: { name: string } | null;
  shift: { name: string } | null;
}

export interface LiveAttendanceFilter {
  date?: string;
  from?: string;
  to?: string;
  worker?: number | string;
  status?: string;
  limit?: number;
  offset?: number;
}

export function fetchLiveAttendances(arg?: string | LiveAttendanceFilter): Promise<Page<LiveAttendance>> {
  const p = new URLSearchParams();
  if (typeof arg === "string") {
    if (arg) p.set("date", arg);
  } else if (arg) {
    if (arg.date) p.set("date", arg.date);
    if (arg.from) p.set("from", arg.from);
    if (arg.to) p.set("to", arg.to);
    if (arg.worker) p.set("worker", String(arg.worker));
    if (arg.status) p.set("status", arg.status);
    if (arg.limit) p.set("limit", String(arg.limit));
    if (arg.offset) p.set("offset", String(arg.offset));
  }
  if (!p.has("limit")) p.set("limit", "500");
  const qs = p.toString();
  return apiGet(`/attendances${qs ? `?${qs}` : ""}`);
}

export function checkInLive(body: { worker_id: number; check_in_lat?: number; check_in_lng?: number }): Promise<LiveAttendance> {
  return apiPost("/attendances/check-in", body);
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

export function fetchLiveVendorQuotas(): Promise<LiveVendorQuota[]> {
  return apiGet("/vendor-quotas");
}

export function createLiveVendor(body: Record<string, unknown>): Promise<LiveVendor> {
  return apiPost("/vendors", body);
}

export function patchLiveVendor(id: number, body: Record<string, unknown>): Promise<LiveVendor> {
  return apiPatch(`/vendors/${id}`, body);
}

export function deleteLiveVendor(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/vendors/${id}`);
}

export function patchLiveVendorQuota(id: number, body: Record<string, unknown>): Promise<unknown> {
  return apiPatch(`/vendor-quotas/${id}`, body);
}

export function deleteLiveVendorQuota(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/vendor-quotas/${id}`);
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
  note_updated_by?: string | null;
  note_updated_at?: string | null;
}

export function fetchLiveDailyReport(date: string): Promise<LiveDailyReport[]> {
  return apiGet(`/reports/daily?date=${encodeURIComponent(date)}`);
}

export function closeLivePeriod(code: string): Promise<unknown> {
  return apiPost(`/periods/${encodeURIComponent(code)}/close`, {});
}

export function createLiveOrder(body: Record<string, unknown>): Promise<{ id: number; code: string; name: string }> {
  return apiPost("/orders", body);
}

export function deleteLiveOrder(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/orders/${id}`);
}

export function patchLiveOrder(id: number, body: Record<string, unknown>): Promise<unknown> {
  return apiPatch(`/orders/${id}`, body);
}

export function createLiveFinance(body: Record<string, unknown>): Promise<unknown> {
  return apiPost("/finance/transactions", body);
}

export function patchLiveFinance(id: number, body: Record<string, unknown>): Promise<unknown> {
  return apiPatch(`/finance/transactions/${id}`, body);
}

export function deleteLiveFinance(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/finance/transactions/${id}`);
}

export function fetchFinanceCategories(): Promise<Array<{ id: number; name: string }>> {
  return apiGet("/finance/categories");
}

export interface LiveAdvance {
  id: number;
  code: string;
  worker_id: number;
  period_id: number;
  amount: number | string;
  reason: string | null;
  status: string;
  worker: { code: string; full_name: string } | { code: string; full_name: string }[] | null;
}

export function fetchLiveAdvances(periodId?: number, status?: string): Promise<LiveAdvance[]> {
  const p = new URLSearchParams();
  if (periodId) p.set("period", String(periodId));
  if (status) p.set("status", status);
  const qs = p.toString();
  return apiGet(`/advances${qs ? `?${qs}` : ""}`);
}

export function approveLiveAdvance(id: number, status: "approved" | "paid" | "rejected"): Promise<unknown> {
  return apiPatch(`/advances/${id}/approve`, { status });
}

export function checkOutLive(id: number, body: { check_out_lat?: number; check_out_lng?: number }): Promise<unknown> {
  return apiPost(`/attendances/${id}/check-out`, body);
}

export function patchLiveAttendance(id: number, body: { work_units?: number; status?: string }): Promise<unknown> {
  return apiPatch(`/attendances/${id}`, body);
}

export function deleteLiveAttendance(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/attendances/${id}`);
}

export function generateLivePayroll(period: string): Promise<unknown> {
  return apiPost(`/payroll/${encodeURIComponent(period)}/generate`, {});
}

export interface LiveSalaryEntry {
  id: number;
  code: string | null;
  worker_id: number;
  placement_id?: number | null;
  period_id: number;
  entry_type: string | null;
  work_days: number | string | null;
  daily_rate: number | string | null;
  amount: number | string | null;
  content: string | null;
  entry_date: string | null;
  is_auto?: boolean | null;
  revision_no?: number | null;
  voided_at: string | null;
  void_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  company?: string | null;
  order_code?: string | null;
  position?: string | null;
  workers?: { code: string; full_name: string } | null;
  staff?: { full_name: string } | null;
}

export function fetchLiveSalaryEntries(periodId: number): Promise<LiveSalaryEntry[]> {
  return apiGet(`/salary-entries?period=${periodId}`);
}

export function createLiveSalaryEntry(body: Record<string, unknown>): Promise<unknown> {
  return apiPost("/salary-entries", body);
}

export function patchLiveSalaryEntry(id: number, body: Record<string, unknown>): Promise<unknown> {
  return apiPatch(`/salary-entries/${id}`, body);
}

export interface LivePositionOption {
  id: number;
  order_id: number;
  title: string;
  sort_order: number | null;
  job_description?: string | null;
  wage_unit?: string | null;
  shift_id?: number | null;
  order_code?: string;
  order_name?: string;
  company_name?: string;
  current_rate_amount?: number | null;
  current_day_rate?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface LiveShift {
  id: number;
  company_id: number;
  name: string;
  start_time: string;
  end_time: string;
  is_default: boolean;
}

export function fetchLiveShifts(companyId?: number): Promise<LiveShift[]> {
  const q = companyId ? `?company_id=${companyId}` : "";
  return apiGet<LiveShift[]>(`/shifts${q}`);
}

export function fetchPositionOptions(): Promise<LivePositionOption[]> {
  return apiGet("/positions/lookup");
}

export function createLiveWageRate(positionId: number, body: Record<string, unknown>): Promise<unknown> {
  return apiPost(`/positions/${positionId}/wage-rates`, body);
}

export function createLiveVendorQuota(body: Record<string, unknown>): Promise<unknown> {
  return apiPost("/vendor-quotas", body);
}

export function createLiveReconciliation(body: Record<string, unknown>): Promise<unknown> {
  return apiPost("/vendor-reconciliations", body);
}

export interface LiveQuotaAssignment {
  id: number;
  period_id: number;
  team_id: number;
  staff_id: number;
  target_qty: number;
  due_date: string | null;
  label: string | null;
}

export function fetchLiveQuotaAssignments(periodId: number, teamId: number): Promise<LiveQuotaAssignment[]> {
  return apiGet(`/quota-assignments?period=${periodId}&team=${teamId}`);
}

export function createLiveQuotaAssignment(body: Record<string, unknown>): Promise<unknown> {
  return apiPost("/quota-assignments", body);
}

export function patchLiveQuotaAssignment(id: number, body: Record<string, unknown>): Promise<unknown> {
  return apiPatch(`/quota-assignments/${id}`, body);
}

export function deleteLiveQuotaAssignment(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/quota-assignments/${id}`);
}

export function createLiveCompany(body: Record<string, unknown>): Promise<LiveCompany> {
  return apiPost("/companies", body);
}

export function patchLiveCompany(id: number, body: Record<string, unknown>): Promise<LiveCompany> {
  return apiPatch(`/companies/${id}`, body);
}

export function deleteLiveCompany(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/companies/${id}`);
}

export function createLiveSite(companyId: number, body: Record<string, unknown>): Promise<LiveSite> {
  return apiPost(`/companies/${companyId}/sites`, body);
}

export function patchLiveSite(id: number, body: Record<string, unknown>): Promise<LiveSite> {
  return apiPatch(`/sites/${id}`, body);
}

export function deleteLiveSite(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/sites/${id}`);
}

export function deleteLivePlacement(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/placements/${id}`);
}

export function createDailyNote(body: { report_date: string; order_id: number; note: string }): Promise<unknown> {
  return apiPost("/reports/daily/notes", body);
}

export function updateDailyNote(body: { report_date: string; order_id: number; note: string }): Promise<unknown> {
  return apiPatch("/reports/daily/notes", body);
}

export function deleteDailyNote(date: string, orderId: number): Promise<{ ok: boolean }> {
  return apiDelete(`/reports/daily/notes?date=${encodeURIComponent(date)}&order=${orderId}`);
}

export interface LiveDuplicateAlert {
  id: number;
  status: string | null;
  field?: string | null;
  level?: string | null;
  matched_value?: string | null;
  review_note?: string | null;
  worker_name?: string | null;
  matched_name?: string | null;
  worker_code?: string | null;
  matched_code?: string | null;
}

export function fetchDuplicateAlerts(): Promise<LiveDuplicateAlert[]> {
  return apiGet("/duplicate-alerts");
}

export function reviewDuplicateAlert(id: number, body: { status: string; review_note?: string }): Promise<unknown> {
  return apiPatch(`/duplicate-alerts/${id}`, body);
}

export function changeLivePin(oldPin: string, newPin: string): Promise<unknown> {
  return apiPost("/auth/change-pin", { old_pin: oldPin, new_pin: newPin });
}

export function setPlacementStage(id: number, stage: string): Promise<unknown> {
  return apiPatch(`/placements/${id}/stage`, { stage });
}

export function handoverAction(id: number, action: "hand-over" | "receive" | "refuse", body: Record<string, unknown>): Promise<unknown> {
  return apiPatch(`/handovers/${id}/${action}`, body);
}

export function requestDocumentUpload(workerId: number, body: { mime: string; filename: string }): Promise<{ path: string; token: string; signedUrl: string }> {
  return apiPost(`/workers/${workerId}/documents/upload-url`, body);
}

export function saveWorkerDocument(workerId: number, body: { doc_type: string; storage_path: string; mime: string }): Promise<unknown> {
  return apiPost(`/workers/${workerId}/documents`, body);
}

// ---- Supervisors (Quản lý trực tiếp đón NLĐ) ----
export interface LiveSupervisor {
  id: number;
  company_id: number;
  work_site_id?: number | null;
  full_name: string;
  phone: string;
  title?: string | null;
  department?: string | null;
}

export function fetchLiveSupervisors(companyId?: number): Promise<LiveSupervisor[]> {
  const p = new URLSearchParams();
  if (companyId) p.set("company_id", String(companyId));
  const qs = p.toString();
  return apiGet<LiveSupervisor[]>(`/supervisors${qs ? `?${qs}` : ""}`);
}

// ---- Order Workers (Danh sách NLĐ trong đơn hàng) ----
export interface LiveOrderWorker {
  order_id: number;
  order_code: string;
  placement_id: number;
  worker_id: number;
  worker_code: string;
  full_name: string;
  phone: string;
  position: string;
  stage: string;
  worker_status: string;
  start_date: string;
  end_date: string | null;
  current_daily_rate: number | string;
  work_days: number | string;
  wage_amount: number | string;
  supervisor_name: string | null;
  supervisor_phone: string | null;
  handover_status: string | null;
  recruited_by: string | null;
}

export function fetchLiveOrderWorkers(orderId: number): Promise<LiveOrderWorker[]> {
  return apiGet<LiveOrderWorker[]>(`/orders/${orderId}/workers`);
}

// ---- Daily Report Workers (NLĐ trong báo cáo ngày) ----
export interface LiveDailyWorker {
  worker_code: string;
  full_name: string;
  phone: string;
  position: string;
  start_date?: string;
  end_date?: string | null;
  status_today: string;
  day_status?: string;
  check_in_at: string | null;
  check_out_at: string | null;
  handover_status: string | null;
  supervisor_name: string | null;
  supervisor_phone: string | null;
}

export function fetchLiveDailyReportWorkers(date: string, orderId?: number): Promise<LiveDailyWorker[]> {
  const p = new URLSearchParams({ date });
  if (orderId) p.set("order", String(orderId));
  return apiGet<LiveDailyWorker[]>(`/reports/daily/workers?${p.toString()}`);
}

// ---- Salary Entry History (Lịch sử sửa dòng lương) ----
export interface LiveSalaryEntryHistory {
  id: number;
  entry_id: number;
  revision_no: number;
  changed_at: string;
  changed_by: number | null;
  change_type: string;
  work_days_old: number | null;
  work_days_new: number | null;
  daily_rate_old: number | null;
  daily_rate_new: number | null;
  amount_old: number | null;
  amount_new: number | null;
  content_old: string | null;
  content_new: string | null;
  reason: string | null;
  changed_by_staff?: { full_name: string } | null;
}

export function fetchLiveSalaryEntryHistory(entryId: number): Promise<LiveSalaryEntryHistory[]> {
  return apiGet<LiveSalaryEntryHistory[]>(`/salary-entries/${entryId}/history`);
}

// ---- Placement Pay (Lương theo từng đợt làm / công ty) ----
export interface LivePlacementPayRow {
  period_id: number;
  period_code: string;
  placement_id: number;
  worker_id: number;
  company_id: number;
  company: string;
  order_code: string;
  position: string;
  start_date: string;
  end_date: string | null;
  daily_rate: number | string;
  first_day: string;
  last_day: string;
  work_days: number | string;
  amount: number | string;
}

export function fetchLivePlacementPay(periodCode: string, workerId?: number): Promise<LivePlacementPayRow[]> {
  const p = new URLSearchParams({ period: periodCode });
  if (workerId) p.set("worker_id", String(workerId));
  return apiGet<LivePlacementPayRow[]>(`/payroll/placements?${p.toString()}`);
}

