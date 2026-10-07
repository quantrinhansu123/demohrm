import {
  Banknote,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

export function DashboardIcon(props: LucideProps) {
  return <LayoutDashboard {...props} />;
}

export function OrdersIcon(props: LucideProps) {
  return <ClipboardList {...props} />;
}

export function WorkersIcon(props: LucideProps) {
  return <Users {...props} />;
}

export function CompaniesIcon(props: LucideProps) {
  return <Building2 {...props} />;
}

export function VendorsIcon(props: LucideProps) {
  return <Handshake {...props} />;
}

export function AttendanceIcon(props: LucideProps) {
  return <MapPin {...props} />;
}

export function PayrollIcon(props: LucideProps) {
  return <Wallet {...props} />;
}

export function FinanceIcon(props: LucideProps) {
  return <Banknote {...props} />;
}

export function CommissionIcon(props: LucideProps) {
  return <Briefcase {...props} />;
}

export function ReportsIcon(props: LucideProps) {
  return <BarChart3 {...props} />;
}

export function AuditIcon(props: LucideProps) {
  return <ShieldCheck {...props} />;
}

export function CheckInIcon(props: LucideProps) {
  return <CalendarCheck {...props} />;
}
