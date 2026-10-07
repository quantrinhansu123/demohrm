"use client";

import Image from "next/image";
import { useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { ModuleId } from "@/types/hrm";
import {
  AttendanceIcon,
  AuditIcon,
  CommissionIcon,
  CompaniesIcon,
  DashboardIcon,
  FinanceIcon,
  OrdersIcon,
  PayrollIcon,
  ReportsIcon,
  VendorsIcon,
  WorkersIcon,
} from "@/components/icons";

const mainNav: { id: ModuleId; label: string; icon: typeof DashboardIcon }[] = [
  { id: "dashboard", label: "Tổng quan (Dashboard)", icon: DashboardIcon },
  { id: "orders", label: "Đơn hàng cung ứng", icon: OrdersIcon },
  { id: "workers", label: "Người lao động (Hồ sơ)", icon: WorkersIcon },
  { id: "companies", label: "Khách hàng & Địa điểm", icon: CompaniesIcon },
  { id: "vendors", label: "Quản lý Vendor & Cấp số", icon: VendorsIcon },
  { id: "attendance", label: "Chấm công (GPS)", icon: AttendanceIcon },
  { id: "payroll", label: "Lương & Tạm ứng", icon: PayrollIcon },
  { id: "finance", label: "Tài chính (Thu/Chi)", icon: FinanceIcon },
  { id: "commission", label: "Hoa hồng dự kiến", icon: CommissionIcon },
  { id: "reports", label: "Báo cáo & Thống kê", icon: ReportsIcon },
  { id: "audit", label: "Lịch sử thao tác (Audit)", icon: AuditIcon },
];

export function Sidebar() {
  const {
    currentModule, setCurrentModule,
    currentTeam, setCurrentTeam,
    currentFactory, setCurrentFactory,
    periodCode, setPeriodCode,
    teams, companies, periods,
  } = useApp();
  const { access } = useSession();
  const [navQuery, setNavQuery] = useState("");

  const visibleNav = mainNav.filter((n) => {
    if (n.id === "finance" && !access.canViewFinance) return false;
    if (n.id === "commission" && !access.canViewCommission) return false;
    if (n.id === "audit" && !access.canViewAudit) return false;
    if (navQuery.trim() && !n.label.toLowerCase().includes(navQuery.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col overflow-y-auto bg-[#0b4c8f] text-slate-100">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <Image src="/images/logo.png" alt="Trang Way" width={38} height={38} className="rounded-lg bg-white p-0.5" priority />
        <div>
          <h1 className="text-[16px] font-bold leading-tight">Trang Way</h1>
          <p className="text-[11.5px] text-[#8ec3f8]">Cung ứng nhân lực</p>
        </div>
      </div>

      <div className="px-4 pb-2 pt-1 text-[12px] text-[#8ec3f8]">Phiên đã đăng nhập</div>

      <div className="relative mx-3 mt-3">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8ec3f8]" />
        <input
          value={navQuery}
          onChange={(e) => setNavQuery(e.target.value)}
          placeholder="Tìm kiếm chức năng..."
          className="w-full rounded-lg border border-white/10 bg-white/10 py-1.5 pl-8 pr-2 text-[13px] placeholder:text-[#8ec3f8] focus:border-white/30 focus:outline-none"
        />
      </div>

      <nav className="mt-2 flex flex-col gap-0.5 px-2">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = currentModule === n.id;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setCurrentModule(n.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors",
                active ? "bg-white/15 text-white" : "text-[#e2edfb] hover:bg-white/10"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{n.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 px-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8ec3f8]">Nhóm của tôi</div>
        <div className="mt-1.5 flex flex-col gap-1">
          {teams.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => {
                setCurrentTeam(t.code);
                setCurrentModule("team");
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]",
                currentModule === "team" && currentTeam === t.code ? "bg-white/15 text-white" : "hover:bg-white/10"
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500 text-[11px] font-bold">{t.name.charAt(0)}</span>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 px-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8ec3f8]">Nhà máy đang theo dõi</div>
        <div className="mt-1.5 flex flex-col gap-1">
          {companies.map((f) => (
            <button
              key={f.code}
              type="button"
              onClick={() => {
                setCurrentFactory(f.short_name);
                setCurrentModule("factory");
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]",
                currentModule === "factory" && currentFactory === f.short_name ? "bg-white/15 text-white" : "hover:bg-white/10"
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500 text-[11px] font-bold">{f.short_name.charAt(0)}</span>
              {f.short_name}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 mt-3 px-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8ec3f8]">Chu kỳ</div>
        <div className="mt-1.5 flex flex-col gap-1">
          {periods.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                setPeriodCode(c.code);
                setCurrentModule("cycle");
              }}
              className={cn(
                "rounded-lg px-2 py-1.5 text-left text-[13px]",
                currentModule === "cycle" && periodCode === c.code ? "bg-white/15 text-white" : "hover:bg-white/10"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
