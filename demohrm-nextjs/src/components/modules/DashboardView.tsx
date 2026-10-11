"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Grid3X3,
  Layers,
  List,
  PieChart,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import { fetchLiveDashboard, fetchLiveOrders, fetchLiveRecruiters } from "@/lib/live";
import type { LiveOrderRow, LivePeriodDashboard, LiveRecruiter } from "@/lib/live";
import { useApp } from "@/lib/store";
import { QueryState } from "@/components/ui/query-state";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { ApiError } from "@/lib/api";
import { formatVND, initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CyclePacingAreaChart,
  EnterpriseBarChart,
  InteractiveFunnelChart,
  OrderHealthDonutChart,
} from "@/components/modules/dashboard/DashboardCharts";

function parseTimeline(start?: string, end?: string) {
  if (!start || !end) return { passed: 0, total: 30, pct: 0, remaining: 0, label: "" };
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const today = new Date();
  const total = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  const passed = Math.min(total, Math.max(1, Math.round((today.getTime() - s.getTime()) / 86400000) + 1));
  const remaining = Math.max(0, total - passed);
  const pct = Math.round((passed / total) * 100);
  const fmt = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
  return {
    passed,
    total,
    remaining,
    pct,
    label: `${fmt(start)} – ${fmt(end)}/${start.split("-")[0]}`,
  };
}

export function DashboardView() {
  const { setCurrentModule, periodCode, setPeriodCode, periods } = useApp();
  const [dash, setDash] = useState<LivePeriodDashboard | null>(null);
  const [rows, setRows] = useState<LiveOrderRow[]>([]);
  const [recruiters, setRecruiters] = useState<LiveRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [analyticsTab, setAnalyticsTab] = useState<"charts" | "funnel" | "pacing" | "recruiters">("charts");

  const currentPeriod = periods.find((p) => p.code === periodCode) ?? null;
  const periodName = currentPeriod?.name ?? "Tổng quan chu kỳ";

  const loadData = useCallback(async (isSilent = false) => {
    if (!periodCode) return;
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [d, o, r] = await Promise.all([
        fetchLiveDashboard(periodCode),
        fetchLiveOrders(periodCode),
        fetchLiveRecruiters().catch(() => [] as LiveRecruiter[]),
      ]);
      setDash(d);
      setRows(o);
      setRecruiters(r);
      setError("");
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Không thể tải dữ liệu bảng điều khiển.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [periodCode]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  // Derived Metrics
  const target = dash?.target_qty ?? 0;
  const working = dash?.working_qty ?? 0;
  const fulfillmentPct = target > 0 ? (working / target) * 100 : 0;
  const gap = Math.max(0, target - working);

  const onTrackRows = useMemo(() => rows.filter((r) => r.health === "on_track"), [rows]);
  const lateRows = useMemo(() => rows.filter((r) => r.health === "slightly_late"), [rows]);
  const riskRows = useMemo(() => rows.filter((r) => r.health === "at_risk"), [rows]);

  const onTrackCount = onTrackRows.length;
  const lateCount = lateRows.length;
  const riskCount = riskRows.length;
  const slaRate = rows.length > 0 ? ((onTrackCount / rows.length) * 100).toFixed(0) : "100";

  // Pipeline Metrics Aggregate
  const totalProfiles = useMemo(() => rows.reduce((acc, r) => acc + (r.total_profiles || 0), 0), [rows]);
  const totalApplied = useMemo(() => rows.reduce((acc, r) => acc + (r.applied_qty || 0), 0), [rows]);
  const totalInterview = useMemo(() => rows.reduce((acc, r) => acc + (r.interview_qty || 0), 0), [rows]);
  const totalWaiting = useMemo(() => rows.reduce((acc, r) => acc + (r.waiting_qty || 0), 0), [rows]);

  // Timeline
  const timeline = useMemo(
    () => parseTimeline(dash?.start_date, dash?.end_date),
    [dash?.start_date, dash?.end_date]
  );

  // Grouped by company for charts & lists
  const companyChartData = useMemo(() => {
    const map = new Map<
      string,
      { company: string; target: number; working: number; waiting: number; orders: number; health: string }
    >();
    for (const r of rows) {
      const c = r.company || "Khác";
      const existing = map.get(c) || {
        company: c,
        target: 0,
        working: 0,
        waiting: 0,
        orders: 0,
        health: r.health,
      };
      existing.target += r.target_qty || 0;
      existing.working += r.working_qty || 0;
      existing.waiting += r.waiting_qty || 0;
      existing.orders += 1;
      map.set(c, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.target - a.target);
  }, [rows]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return rows.filter((r) => {
      if (healthFilter !== "all" && r.health !== healthFilter) return false;
      if (companyFilter !== "all" && r.company !== companyFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name?.toLowerCase().includes(q);
        const matchCode = r.code?.toLowerCase().includes(q);
        const matchComp = r.company?.toLowerCase().includes(q);
        const matchOwner = r.owner?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchComp && !matchOwner) return false;
      }
      return true;
    });
  }, [rows, healthFilter, companyFilter, searchQuery]);

  return (
    <section className="flex h-full flex-col overflow-hidden bg-[#f4f7fb]">
      {/* SaaS Executive Command Bar */}
      <header className="border-b border-slate-200/90 bg-white/95 px-5 py-3.5 backdrop-blur-md md:px-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0052cc] to-[#3b82f6] text-white shadow-sm shadow-blue-500/20">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[19px] font-bold tracking-tight text-slate-900">
                  Tổng quan Vận hành & Cung ứng
                </h1>
                <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700 sm:inline-flex">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Trực tuyến
                </span>
              </div>
              <p className="text-[12.5px] text-slate-500">
                Theo dõi thời gian thực tiến độ tuyển dụng, biểu đồ chỉ tiêu & phân bổ nhân sự
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Switcher Select */}
            <div className="relative">
              <select
                aria-label="Chọn chu kỳ làm việc"
                value={periodCode}
                onChange={(e) => setPeriodCode(e.target.value)}
                className="h-9 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50/80 pl-3 pr-8 text-[13px] font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-100/90 focus:border-[#0052cc] focus:bg-white focus:outline-none"
              >
                {periods.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} {p.status === "open" ? "• Đang mở" : p.status === "closed" ? "• Đã đóng" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Reload button */}
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              title="Làm mới số liệu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin text-[#0052cc]")} />
            </button>

            {/* Quick Action Button */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setCurrentModule("orders")}
              className="h-9 gap-1.5 bg-[#0052cc] font-medium shadow-sm hover:bg-[#0747a6]"
            >
              <span>Quản lý Đơn hàng</span>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body space-y-5 p-4 md:p-6">
          {/* Period Progress & SLA Ribbon */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white via-white to-blue-50/50 p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-blue-700 ring-1 ring-inset ring-blue-200/60">
                  <Calendar className="h-4 w-4 shrink-0 text-blue-600" />
                  <span className="text-[12.5px] font-semibold">{timeline.label || periodName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12.5px] text-slate-600">
                  <span className="font-semibold text-slate-900">Ngày {timeline.passed}</span>
                  <span className="text-slate-400">/</span>
                  <span>{timeline.total} ngày</span>
                  <span className="mx-1 text-slate-300">•</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-600">
                    Còn {timeline.remaining} ngày
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="text-slate-500">Tiến độ kỳ:</span>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100 sm:w-44">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                      style={{ width: `${timeline.pct}%` }}
                    />
                  </div>
                  <span className="font-bold text-slate-700">{timeline.pct}%</span>
                </div>

                <div className="hidden h-4 w-px bg-slate-200 sm:block" />

                <div className="hidden items-center gap-2 text-[12.5px] sm:flex">
                  <span className="text-slate-500">Tỷ lệ SLA:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {slaRate}% chuẩn tiến độ
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Executive KPI Cards (Bento Grid) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Target vs Working */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  Chỉ tiêu Cung ứng
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-105">
                  <Users className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold tracking-tight text-slate-900">
                  {working}
                </span>
                <span className="text-[14px] font-medium text-slate-400">/ {target} người</span>
              </div>

              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="text-slate-500">Đạt chỉ tiêu</span>
                  <span className="font-bold text-blue-700">{fulfillmentPct.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, fulfillmentPct)}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px]">
                <span className="text-slate-500">Còn thiếu:</span>
                <span className={cn("font-semibold", gap > 0 ? "text-amber-600" : "text-emerald-600")}>
                  {gap > 0 ? `${gap} người` : "Đã hoàn thành"}
                </span>
              </div>
            </div>

            {/* Card 2: Order Health & SLA */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  Sức khỏe Đơn hàng
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-105">
                  <Activity className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold tracking-tight text-slate-900">
                  {rows.length}
                </span>
                <span className="text-[14px] font-medium text-slate-400">đơn đang chạy</span>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <div className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 py-1 text-[11px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {onTrackCount} chuẩn
                </div>
                <div className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-50 py-1 text-[11px] font-bold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {lateCount} chậm
                </div>
                <div className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-rose-50 py-1 text-[11px] font-bold text-rose-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {riskCount} rủi ro
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px]">
                <span className="text-slate-500">Tỷ lệ đạt SLA:</span>
                <span className="font-semibold text-emerald-700">{slaRate}%</span>
              </div>
            </div>

            {/* Card 3: Recruitment Funnel Aggregate */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-sky-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  Phễu Tuyển dụng
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 transition-transform group-hover:scale-105">
                  <Layers className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold tracking-tight text-slate-900">
                  {totalProfiles}
                </span>
                <span className="text-[14px] font-medium text-slate-400">hồ sơ tiếp nhận</span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11.5px]">
                <div className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-slate-600">
                  <span>Chờ việc:</span>
                  <span className="font-bold text-sky-600">{totalWaiting}</span>
                </div>
                <div className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-slate-600">
                  <span>Phỏng vấn:</span>
                  <span className="font-bold text-amber-600">{totalInterview}</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px]">
                <span className="text-slate-500">Mới ứng tuyển:</span>
                <span className="font-semibold text-slate-700">{totalApplied} hồ sơ</span>
              </div>
            </div>

            {/* Card 4: Operations & Financial Advances */}
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-purple-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  Công & Tạm ứng
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition-transform group-hover:scale-105">
                  <Wallet className="h-4.5 w-4.5" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold tracking-tight text-slate-900">
                  {dash?.total_work_days ?? 0}
                </span>
                <span className="text-[14px] font-medium text-slate-400">ngày công chu kỳ</span>
              </div>

              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-purple-50/60 px-2.5 py-1.5 text-[11.5px]">
                <span className="text-purple-900">Tạm ứng đã duyệt:</span>
                <span className="font-bold text-purple-700">
                  {formatVND(dash?.approved_advances ?? 0)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px]">
                <span className="text-slate-500">NLĐ nhận tạm ứng:</span>
                <span className="font-semibold text-purple-700">
                  {dash?.advance_workers ?? 0} người
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PROFESSIONAL SAAS ANALYTICS HUB (CHART SUITE) */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16.5px] font-bold text-slate-900">
                    Bản đồ Dữ liệu & Phân tích Trực quan
                  </h2>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    SaaS Analytics
                  </span>
                </div>
                <p className="text-[12.5px] text-slate-500">
                  Biểu đồ trực quan hóa chỉ tiêu, tỷ lệ tuân thủ SLA, phễu tuyển dụng & tốc độ hoàn thành
                </p>
              </div>

              {/* Analytics tab toggles */}
              <div className="flex flex-wrap rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAnalyticsTab("charts")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all",
                    analyticsTab === "charts"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                  <span>Chỉ tiêu Doanh nghiệp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab("funnel")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all",
                    analyticsTab === "funnel"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Layers className="h-3.5 w-3.5 text-sky-600" />
                  <span>Phễu & Sức khỏe SLA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab("pacing")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all",
                    analyticsTab === "pacing"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Tốc độ Chu kỳ (Pacing)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsTab("recruiters")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all",
                    analyticsTab === "recruiters"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <UserCheck className="h-3.5 w-3.5 text-purple-600" />
                  <span>Đội Tuyển dụng</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Enterprise Grouped Bar Chart */}
            {analyticsTab === "charts" && (
              <div className="pt-4 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[14px] font-bold text-slate-800">
                      So sánh Chỉ tiêu Yêu cầu vs Thực tế Cung ứng theo Khách hàng
                    </h3>
                    <span className="text-[12px] text-slate-400">Rê chuột vào cột để xem chi tiết</span>
                  </div>
                  <EnterpriseBarChart
                    data={companyChartData}
                    onSelectCompany={(c) => setCompanyFilter(c)}
                  />
                </div>

                {/* Company Mini Performance Cards */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 border-t border-slate-100 pt-4">
                  {companyChartData.map((c) => {
                    const compPct = c.target > 0 ? (c.working / c.target) * 100 : 0;
                    return (
                      <div
                        key={c.company}
                        onClick={() => setCompanyFilter(c.company)}
                        className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-all hover:border-blue-300 hover:bg-white hover:shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-[13px] font-bold text-blue-700">
                            {c.company.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600">
                              {c.company}
                            </div>
                            <div className="text-[11.5px] text-slate-400">
                              {c.orders} đơn • Chỉ tiêu: {c.target}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[13px] font-bold text-slate-900">{compPct.toFixed(0)}%</div>
                          <div className="text-[11px] text-emerald-600 font-semibold">{c.working} đi làm</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: Funnel Flow & Donut SLA Chart */}
            {analyticsTab === "funnel" && (
              <div className="pt-4 space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Left 2 Cols: Funnel Flow */}
                  <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[14px] font-bold text-slate-800">
                        Phễu Chuyển đổi Dòng Tuyển dụng
                      </h3>
                      <span className="text-[12px] text-slate-400">Từ Ứng tuyển đến Đi làm</span>
                    </div>
                    <InteractiveFunnelChart
                      applied={totalApplied}
                      interview={totalInterview}
                      waiting={totalWaiting}
                      working={working}
                      target={target}
                    />
                  </div>

                  {/* Right Col: SLA Donut Chart */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="mb-2">
                      <h3 className="text-[14px] font-bold text-slate-800">Tỷ lệ Tuân thủ SLA</h3>
                      <p className="text-[11.5px] text-slate-500">Phân bố trạng thái đúng hạn của các đơn</p>
                    </div>
                    <OrderHealthDonutChart
                      onTrack={onTrackCount}
                      late={lateCount}
                      risk={riskCount}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Cycle Pacing & Burndown Area Chart */}
            {analyticsTab === "pacing" && (
              <div className="pt-4 space-y-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <CyclePacingAreaChart
                      passedDays={timeline.passed}
                      totalDays={timeline.total}
                      currentWorking={working}
                      target={target}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-[12.5px] space-y-3">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      <span>Đánh giá Nhịp độ (Pacing Analysis)</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      Chu kỳ đã đi qua <strong>{timeline.passed}</strong> / <strong>{timeline.total} ngày</strong> ({timeline.pct}%).
                      Hiện tại đang có <strong>{working}</strong> lao động đã làm việc trên chỉ tiêu <strong>{target}</strong> người.
                    </p>
                    <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Cần bổ sung:</span>
                        <strong className="text-amber-600">{gap} người</strong>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Thời gian còn lại:</span>
                        <strong className="text-slate-800">{timeline.remaining} ngày</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Recruiters Performance */}
            {analyticsTab === "recruiters" && (
              <div className="pt-4">
                {recruiters.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-slate-400">
                    Chưa có thông tin nhân sự tuyển dụng.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recruiters.map((rec) => (
                      <div
                        key={rec.source_code}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 transition-all hover:bg-white hover:shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-[12px] font-bold text-white">
                            {initialsOf(rec.source_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-bold text-slate-900">
                              {rec.source_name}
                            </div>
                            <div className="text-[11.5px] text-slate-500">{rec.source_code}</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-white p-2 text-center text-[11px] shadow-2xs">
                          <div>
                            <div className="text-slate-400">Tổng NLĐ</div>
                            <div className="font-bold text-slate-800">{rec.total_workers}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Đang làm</div>
                            <div className="font-bold text-emerald-600">{rec.working}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Chờ việc</div>
                            <div className="font-bold text-sky-600">{rec.waiting_start}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Operational Orders Performance Hub */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            {/* Filter & View Switcher Toolbar */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">Danh mục Đơn hàng Cung ứng</h2>
                <p className="text-[12px] text-slate-500">
                  Hiển thị {filteredOrders.length} / {rows.length} đơn hàng trong chu kỳ {periodName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên đơn, mã, công ty..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8.5 pr-3 text-[12.5px] outline-none transition-all placeholder:text-slate-400 focus:border-[#0052cc] focus:bg-white"
                  />
                </div>

                {/* Company filter */}
                <select
                  aria-label="Lọc theo doanh nghiệp"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-[12.5px] font-medium text-slate-700 outline-none focus:border-[#0052cc] focus:bg-white"
                >
                  <option value="all">Tất cả Doanh nghiệp</option>
                  {companyChartData.map((c) => (
                    <option key={c.company} value={c.company}>
                      {c.company} ({c.orders})
                    </option>
                  ))}
                </select>

                {/* Health pills filter */}
                <div className="flex rounded-lg border border-slate-200 bg-slate-50/70 p-0.5">
                  <button
                    type="button"
                    onClick={() => setHealthFilter("all")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all",
                      healthFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setHealthFilter("on_track")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all",
                      healthFilter === "on_track"
                        ? "bg-emerald-500 text-white shadow-2xs"
                        : "text-slate-600 hover:text-emerald-700"
                    )}
                  >
                    Đúng hạn ({onTrackCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHealthFilter("slightly_late")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all",
                      healthFilter === "slightly_late"
                        ? "bg-amber-500 text-white shadow-2xs"
                        : "text-slate-600 hover:text-amber-700"
                    )}
                  >
                    Chậm ({lateCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHealthFilter("at_risk")}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-all",
                      healthFilter === "at_risk"
                        ? "bg-rose-500 text-white shadow-2xs"
                        : "text-slate-600 hover:text-rose-700"
                    )}
                  >
                    Rủi ro ({riskCount})
                  </button>
                </div>

                {/* View Mode Toggle */}
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    aria-label="Xem dạng thẻ"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-all",
                      viewMode === "grid" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Xem dạng bảng"
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md transition-all",
                      viewMode === "table" ? "bg-white text-blue-600 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Orders Presentation */}
            {filteredOrders.length === 0 ? (
              <div className="my-10 flex flex-col items-center justify-center text-center">
                <Briefcase className="h-10 w-10 text-slate-300" />
                <h3 className="mt-2 text-[14px] font-bold text-slate-700">Không tìm thấy đơn hàng phù hợp</h3>
                <p className="mt-0.5 text-[12.5px] text-slate-400">
                  Hãy thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm
                </p>
                {(healthFilter !== "all" || companyFilter !== "all" || searchQuery) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setHealthFilter("all");
                      setCompanyFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Xóa toàn bộ bộ lọc
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredOrders.map((r) => {
                  const rowPct = r.target_qty > 0 ? (r.working_qty / r.target_qty) * 100 : 0;
                  const isHealthGood = r.health === "on_track";
                  const isHealthLate = r.health === "slightly_late";

                  return (
                    <div
                      key={r.order_id}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    >
                      <div>
                        {/* Header Badge Row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11.5px] font-bold text-blue-700 ring-1 ring-inset ring-blue-200/60">
                              {r.company}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                              #{r.code}
                            </span>
                          </div>

                          {isHealthGood ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Đúng tiến độ
                            </span>
                          ) : isHealthLate ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Chậm tiến độ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Rủi ro cao
                            </span>
                          )}
                        </div>

                        {/* Title & Manager */}
                        <div className="mt-3">
                          <h3 className="line-clamp-1 text-[15px] font-bold text-slate-900 group-hover:text-blue-700">
                            {r.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500">
                            <span>Phụ trách:</span>
                            <strong className="font-semibold text-slate-700">{r.owner}</strong>
                          </div>
                        </div>

                        {/* Target & Working Progress */}
                        <div className="mt-4 rounded-xl bg-slate-50/80 p-3">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-slate-600">
                              Chỉ tiêu: <strong className="text-slate-900">{r.target_qty}</strong>
                            </span>
                            <span className="text-slate-600">
                              Đi làm: <strong className="text-blue-700">{r.working_qty}</strong>
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-2.5">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  rowPct >= 80 ? "bg-emerald-500" : rowPct >= 40 ? "bg-blue-600" : "bg-amber-500"
                                )}
                                style={{ width: `${Math.min(100, rowPct)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11.5px] font-bold text-slate-700">
                              {rowPct.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Funnel mini counters */}
                        <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10.5px]">
                          <div className="rounded bg-emerald-50/80 py-1 font-semibold text-emerald-800">
                            <div>{r.working_qty}</div>
                            <div className="text-[9.5px] text-emerald-600">Đi làm</div>
                          </div>
                          <div className="rounded bg-sky-50/80 py-1 font-semibold text-sky-800">
                            <div>{r.waiting_qty}</div>
                            <div className="text-[9.5px] text-sky-600">Chờ việc</div>
                          </div>
                          <div className="rounded bg-amber-50/80 py-1 font-semibold text-amber-800">
                            <div>{r.interview_qty}</div>
                            <div className="text-[9.5px] text-amber-600">Hẹn PV</div>
                          </div>
                          <div className="rounded bg-slate-100 py-1 font-semibold text-slate-700">
                            <div>{r.applied_qty}</div>
                            <div className="text-[9.5px] text-slate-500">Ứng tuyển</div>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
                          {r.video_url && (
                            <span className="flex items-center gap-0.5 text-blue-600" title="Có video mô tả">
                              <Video className="h-3.5 w-3.5" />
                              <span>Video</span>
                            </span>
                          )}
                          <span>{r.position_count || 1} vị trí</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setCurrentModule("orders")}
                          className="h-7 gap-1 font-semibold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span>Chi tiết</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Table View */
              <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                <table className="custom-table w-full text-left">
                  <thead>
                    <tr>
                      <th className="w-20">Mã đơn</th>
                      <th>Khách hàng & Tên đơn hàng</th>
                      <th>Người phụ trách</th>
                      <th>Thời gian</th>
                      <th className="text-center">Chỉ tiêu / Đi làm</th>
                      <th className="w-36">Tiến độ</th>
                      <th>Sức khỏe SLA</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((r) => {
                      const rowPct = r.target_qty > 0 ? (r.working_qty / r.target_qty) * 100 : 0;
                      return (
                        <tr key={r.order_id} className="transition-colors hover:bg-slate-50/80">
                          <td className="font-mono text-[12px] font-semibold text-slate-600">#{r.code}</td>
                          <td>
                            <div className="font-bold text-slate-900">{r.name}</div>
                            <div className="text-[12px] text-blue-600">{r.company}</div>
                          </td>
                          <td className="text-[12.5px] font-medium text-slate-700">{r.owner}</td>
                          <td className="text-[12px] text-slate-500">
                            {r.start_date.split("-").reverse().join("/")} –{" "}
                            {r.end_date.split("-").reverse().join("/")}
                          </td>
                          <td className="text-center">
                            <span className="font-bold text-blue-700">{r.working_qty}</span>
                            <span className="text-slate-400"> / {r.target_qty}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    rowPct >= 80 ? "bg-emerald-500" : rowPct >= 40 ? "bg-blue-600" : "bg-amber-500"
                                  )}
                                  style={{ width: `${Math.min(100, rowPct)}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-bold text-slate-700">
                                {rowPct.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td>
                            {r.health === "on_track" ? (
                              <StatusPill tone="success">Đúng tiến độ</StatusPill>
                            ) : r.health === "slightly_late" ? (
                              <StatusPill tone="warning">Chậm tiến độ</StatusPill>
                            ) : (
                              <StatusPill tone="danger">Có rủi ro</StatusPill>
                            )}
                          </td>
                          <td className="text-right">
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setCurrentModule("orders")}
                              className="h-7 text-[12px]"
                            >
                              Xem đơn
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Speed Dial Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                ⚡
              </span>
              <span>Lối tắt điều hành nhanh:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentModule("workers")}
                className="gap-1 text-[12px]"
              >
                <Users className="h-3.5 w-3.5 text-slate-500" />
                <span>Người lao động</span>
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentModule("attendance")}
                className="gap-1 text-[12px]"
              >
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Chấm công GPS</span>
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentModule("payroll")}
                className="gap-1 text-[12px]"
              >
                <Wallet className="h-3.5 w-3.5 text-slate-500" />
                <span>Lương & Tạm ứng</span>
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setCurrentModule("companies")}
                className="gap-1 text-[12px]"
              >
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>Khách hàng & Địa điểm</span>
              </Button>
            </div>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
