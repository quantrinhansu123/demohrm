"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AppProvider, useApp } from "@/lib/store";
import { SessionProvider, useSession } from "@/lib/session";
import { roleLabel } from "@/lib/access";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { Avatar } from "@/components/ui/avatar";
import { ApiStatus } from "@/components/layout/ApiStatus";
import { Button } from "@/components/ui/button";
import { ChangePinButton } from "@/components/auth/ChangePinButton";
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal";
import type { Worker } from "@/types/hrm";

const OrdersView = dynamic(() => import("@/components/modules/OrdersView").then((m) => m.OrdersView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const DashboardView = dynamic(() => import("@/components/modules/DashboardView").then((m) => m.DashboardView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const WorkersView = dynamic(() => import("@/components/workers/WorkersView").then((m) => m.WorkersView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const CompaniesView = dynamic(() => import("@/components/modules/CompaniesView").then((m) => m.CompaniesView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const VendorsView = dynamic(() => import("@/components/modules/VendorsView").then((m) => m.VendorsView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const AttendanceView = dynamic(() => import("@/components/modules/AttendanceView").then((m) => m.AttendanceView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const PayrollView = dynamic(() => import("@/components/modules/PayrollView").then((m) => m.PayrollView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const FinanceView = dynamic(() => import("@/components/modules/FinanceView").then((m) => m.FinanceView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const CommissionView = dynamic(() => import("@/components/modules/CommissionView").then((m) => m.CommissionView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const ReportsView = dynamic(() => import("@/components/modules/ReportsView").then((m) => m.ReportsView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const AuditView = dynamic(() => import("@/components/modules/AuditView").then((m) => m.AuditView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const TeamView = dynamic(() => import("@/components/modules/TeamView").then((m) => m.TeamView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const FactoryView = dynamic(() => import("@/components/modules/FactoryView").then((m) => m.FactoryView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });
const CycleView = dynamic(() => import("@/components/modules/CycleView").then((m) => m.CycleView), { ssr: false, loading: () => <p className="p-6 text-[13px] text-slate-500">Đang mở màn hình...</p> });

function Shell() {
  const { currentModule, catalogError } = useApp();
  const { staff, logout } = useSession();
  const [viewing, setViewing] = useState<Worker | null>(null);
  if (!staff) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6fa]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b bg-white px-6 py-2.5">
          <ApiStatus />
          <div className="flex items-center gap-2.5">
            <Avatar tone="avatar-blue" size="sm">{staff.full_name.trim().slice(-1).toUpperCase()}</Avatar>
            <div className="leading-tight">
              <div className="text-[13px] font-bold text-slate-900">{staff.full_name}</div>
              <div className="text-[11.5px] text-slate-500">{roleLabel(staff.role)} · {staff.code}</div>
            </div>
            <ChangePinButton />
            <Button variant="outline" size="xs" onClick={logout}>Thoát</Button>
          </div>
        </div>
        {catalogError && <p className="bg-rose-50 px-6 py-2 text-[12.5px] text-rose-700">{catalogError}</p>}
        <main className="min-h-0 flex-1">
          {currentModule === "orders" && <OrdersView onViewDetail={setViewing} />}
          {currentModule === "dashboard" && <DashboardView />}
          {currentModule === "workers" && <WorkersView onViewDetail={setViewing} />}
          {currentModule === "companies" && <CompaniesView />}
          {currentModule === "vendors" && <VendorsView />}
          {currentModule === "attendance" && <AttendanceView />}
          {currentModule === "payroll" && <PayrollView />}
          {currentModule === "finance" && <FinanceView />}
          {currentModule === "commission" && <CommissionView />}
          {currentModule === "reports" && <ReportsView />}
          {currentModule === "audit" && <AuditView />}
          {currentModule === "team" && <TeamView />}
          {currentModule === "factory" && <FactoryView />}
          {currentModule === "cycle" && <CycleView />}
        </main>
      </div>
      <WorkerDetailModal worker={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Gate() {
  const { ready, staff } = useSession();
  if (!ready) return <p className="grid min-h-screen place-items-center text-[13px] text-slate-500">Đang kiểm tra phiên...</p>;
  if (!staff) return <LoginScreen />;
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

export function AppShell() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}
