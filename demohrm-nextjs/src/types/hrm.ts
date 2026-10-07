export type RoleId =
  | "DIRECTOR"
  | "VICE_DIRECTOR"
  | "ACCOUNTANT"
  | "RECRUITER"
  | "LEAD_SALES";

export type ModuleId =
  | "dashboard"
  | "orders"
  | "workers"
  | "companies"
  | "vendors"
  | "attendance"
  | "payroll"
  | "finance"
  | "commission"
  | "reports"
  | "audit"
  | "team"
  | "factory"
  | "cycle";

export type WorkerStatus =
  | "Đang làm"
  | "Chờ đi làm"
  | "Tạm nghỉ"
  | "Nghỉ việc"
  | "Không đi làm"
  | "Ứng viên";

export type WorkerType = "Thời vụ" | "Chính thức";

export interface WorkAssignment {
  id: string;
  company: string;
  orderCode: string;
  position: string;
  startDate: string;
  endDate: string | null;
  recruiter: string;
}

export interface Worker {
  id: number;
  code: string;
  name: string;
  phone: string;
  hometown: string;
  citizenId: string;
  company: string;
  position: string;
  type: WorkerType;
  recruiter: string;
  status: WorkerStatus;
  dailyRate: number;
  workedDays: number;
  advance: number;
  avatarColor: string;
  initials: string;
  assignments?: WorkAssignment[];
}

export interface Attendance {
  code: string;
  name: string;
  company: string;
  shift: string;
  in: string;
  out: string;
  gps: string;
  days: string;
  status: "PRESENT" | "LATE" | "GPS_WARNING";
}

export interface FinanceTx {
  code: string;
  date: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  desc: string;
  party: string;
  amount: string;
  user: string;
  status: string;
}

export interface AuditLog {
  time: string;
  user: string;
  role: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}

export interface FactoryOrder {
  code: string;
  name: string;
  count: number;
  filled: number;
  pct: string;
  shift: string;
  salary: string;
  status: string;
}

export interface FactoryVendor {
  name: string;
  count: number;
  lead: string;
  phone: string;
  status: string;
}

export interface Factory {
  code: string;
  name: string;
  avatar: string;
  colorClass: string;
  address: string;
  hotline: string;
  lead: string;
  target: number;
  actual: number;
  pct: string;
  attRate: string;
  attDetail: string;
  geofenceRadius: number;
  rate: string;
  revenue: string;
  gps: { lat: string; lng: string; address: string };
  orders: FactoryOrder[];
  vendors: FactoryVendor[];
}

export interface TeamMember {
  name: string;
  role: string;
  target: number;
  actual: number;
  progress: string;
  passRate: string;
  avatar: string;
  colorClass: string;
  rating: string;
  phone: string;
}

export interface TeamOrder {
  factory: string;
  orderName: string;
  lead: string;
  target: number;
  actual: number;
  pct: string;
  status: string;
}

export interface TeamInterview {
  candidate: string;
  phone: string;
  factory: string;
  date: string;
  recruiter: string;
  status: string;
}

export interface Team {
  id: string;
  name: string;
  lead: string;
  subtitle: string;
  target: number;
  actual: number;
  pct: string;
  factoryCount: number;
  factoryList: string;
  factoryStatus: string;
  weeklyCandidate: number;
  weeklyInterview: number;
  weeklyWaiting: number;
  members: TeamMember[];
  orders: TeamOrder[];
  interviews: TeamInterview[];
}

export interface Cycle {
  id: string;
  title: string;
  quarter: string;
  range: string;
  deadline: string;
  status: string;
  statusClass: string;
  target: number;
  actual: number;
  pct: string;
  progressText: string;
  revenue: string;
  expense: string;
  profit: string;
  totalDays: string;
  advance: string;
  advanceCount: number;
}

export interface OrderPosition {
  idx: string;
  name: string;
  done: number;
  total: number;
}

export interface OrderSummary {
  id: number;
  title: string;
  period: string;
  manager: string;
  target: number;
  working: number;
  positions: number;
  vendors: number;
  code: string;
  status: string;
  health: "Đúng tiến độ" | "Chậm tiến độ" | "Có rủi ro";
  items: OrderPosition[];
  funnel: { label: string; value: number; tone: "green" | "blue" | "orange" | "grey" }[];
  totalProfiles: number;
}

export interface CompanyRow {
  code: string;
  name: string;
  address: string;
  contact: string;
  phone: string;
  gps: string;
  radius: string;
  working: number;
  demand: number;
}

export interface RoleProfile {
  id: RoleId;
  avatar: string;
  name: string;
  role: string;
}
