"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =========================================================================
// 1. BIỂU ĐỒ CỘT SO SÁNH CHỈ TIÊU & THỰC TẾ (Enterprise Fulfillment Grouped Bar)
// =========================================================================

interface CompanyChartItem {
  company: string;
  target: number;
  working: number;
  waiting: number;
  orders: number;
  health: string;
}

export function EnterpriseBarChart({
  data,
  onSelectCompany,
}: {
  data: CompanyChartItem[];
  onSelectCompany?: (company: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute maximum value for scaling Y axis
  const maxVal = useMemo(() => {
    if (data.length === 0) return 100;
    const peak = Math.max(...data.map((d) => Math.max(d.target, d.working + d.waiting)));
    // Round up to nearest nice round number
    return Math.max(10, Math.ceil(peak / 20) * 20);
  }, [data]);

  const yTicks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];

  const chartHeight = 220;
  const paddingBottom = 40;
  const usableHeight = chartHeight - paddingBottom;

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-[13px] text-slate-400">
        Chưa có dữ liệu đơn hàng cho doanh nghiệp
      </div>
    );
  }

  return (
    <div className="relative w-full select-none">
      {/* Legend Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-gradient-to-tr from-slate-400 to-slate-300" />
            <span className="text-slate-600">Chỉ tiêu yêu cầu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-gradient-to-tr from-blue-600 to-indigo-500" />
            <span className="text-slate-600">Thực tế đi làm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-gradient-to-tr from-sky-400 to-sky-300" />
            <span className="text-slate-600">Chờ nhận việc</span>
          </div>
        </div>
        <span className="text-[11.5px] text-slate-400">Đơn vị: Người</span>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-x-auto">
        <div className="min-w-[500px]">
          <svg viewBox={`0 0 600 ${chartHeight}`} className="h-60 w-full overflow-visible">
            <defs>
              <linearGradient id="barTargetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
              <linearGradient id="barWorkingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="barWaitingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {yTicks.map((tick) => {
              const y = usableHeight - (tick / maxVal) * usableHeight + 10;
              return (
                <g key={tick} className="text-slate-300">
                  <line x1="40" y1={y} x2="590" y2={y} stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" />
                  <text x="32" y={y + 3.5} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                    {tick}
                  </text>
                </g>
              );
            })}

            {/* Bars for each company */}
            {data.map((item, idx) => {
              const colWidth = (540 - 20) / data.length;
              const groupX = 45 + idx * colWidth;
              const barWidth = Math.min(22, (colWidth - 20) / 3);
              const isHovered = hoveredIdx === idx;

              const targetH = Math.max(2, (item.target / maxVal) * usableHeight);
              const workingH = Math.max(2, (item.working / maxVal) * usableHeight);
              const waitingH = Math.max(2, (item.waiting / maxVal) * usableHeight);

              const targetY = usableHeight - targetH + 10;
              const workingY = usableHeight - workingH + 10;
              const waitingY = usableHeight - waitingH + 10;

              return (
                <g
                  key={item.company}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectCompany?.(item.company)}
                >
                  {/* Backdrop Hover Highlight */}
                  {isHovered && (
                    <rect
                      x={groupX}
                      y="10"
                      width={colWidth}
                      height={usableHeight}
                      rx="8"
                      className="fill-blue-50/50"
                    />
                  )}

                  {/* Target Bar */}
                  <rect
                    x={groupX + colWidth / 2 - barWidth * 1.5 - 2}
                    y={targetY}
                    width={barWidth}
                    height={targetH}
                    rx="3"
                    fill="url(#barTargetGrad)"
                    className={cn("transition-all duration-300", isHovered ? "opacity-100" : "opacity-85")}
                  />

                  {/* Working Bar */}
                  <rect
                    x={groupX + colWidth / 2 - barWidth * 0.5}
                    y={workingY}
                    width={barWidth}
                    height={workingH}
                    rx="3"
                    fill="url(#barWorkingGrad)"
                    className={cn("transition-all duration-300", isHovered ? "opacity-100" : "opacity-90")}
                  />

                  {/* Waiting Bar */}
                  <rect
                    x={groupX + colWidth / 2 + barWidth * 0.5 + 2}
                    y={waitingY}
                    width={barWidth}
                    height={waitingH}
                    rx="3"
                    fill="url(#barWaitingGrad)"
                    className={cn("transition-all duration-300", isHovered ? "opacity-100" : "opacity-90")}
                  />

                  {/* Company Name Label */}
                  <text
                    x={groupX + colWidth / 2}
                    y={usableHeight + 26}
                    textAnchor="middle"
                    className={cn(
                      "text-[11px] font-semibold transition-colors",
                      isHovered ? "fill-blue-700 font-bold" : "fill-slate-600"
                    )}
                  >
                    {item.company}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Floating Tooltip */}
          {hoveredIdx !== null && data[hoveredIdx] && (
            <div
              className="pointer-events-none absolute -top-2 rounded-xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur-md transition-all duration-150"
              style={{
                left: `${Math.min(75, Math.max(10, ((hoveredIdx + 0.5) / data.length) * 100))}%`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span>{data[hoveredIdx].company}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.2 font-normal text-[10.5px] text-slate-500">
                  {data[hoveredIdx].orders} đơn
                </span>
              </div>
              <div className="mt-2 space-y-1 text-[11.5px]">
                <div className="flex items-center justify-between gap-4 text-slate-500">
                  <span>Chỉ tiêu:</span>
                  <strong className="text-slate-800">{data[hoveredIdx].target} người</strong>
                </div>
                <div className="flex items-center justify-between gap-4 text-blue-600">
                  <span>Đã đi làm:</span>
                  <strong className="font-bold">{data[hoveredIdx].working} người</strong>
                </div>
                <div className="flex items-center justify-between gap-4 text-sky-600">
                  <span>Chờ nhận việc:</span>
                  <strong className="font-bold">{data[hoveredIdx].waiting} người</strong>
                </div>
                <div className="mt-1 border-t border-slate-100 pt-1 text-[11px] text-slate-400">
                  Đạt:{" "}
                  <strong className="text-slate-700">
                    {data[hoveredIdx].target > 0
                      ? ((data[hoveredIdx].working / data[hoveredIdx].target) * 100).toFixed(1)
                      : 0}
                    %
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 2. BIỂU ĐỒ VÀNH KHUYÊN SỨC KHỎE ĐƠN HÀNG (SLA & Order Health Donut Chart)
// =========================================================================

export function OrderHealthDonutChart({
  onTrack,
  late,
  risk,
}: {
  onTrack: number;
  late: number;
  risk: number;
}) {
  const [activeSegment, setActiveSegment] = useState<string | null>(null);

  const total = onTrack + late + risk;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;

  // Percentages
  const pOnTrack = total > 0 ? (onTrack / total) * 100 : 100;
  const pLate = total > 0 ? (late / total) * 100 : 0;
  const pRisk = total > 0 ? (risk / total) * 100 : 0;

  // Offsets
  const dashOnTrack = (pOnTrack / 100) * circumference;
  const dashLate = (pLate / 100) * circumference;
  const dashRisk = (pRisk / 100) * circumference;

  const offsetOnTrack = 0;
  const offsetLate = -dashOnTrack;
  const offsetRisk = -(dashOnTrack + dashLate);

  const slaRate = total > 0 ? ((onTrack / total) * 100).toFixed(0) : "100";

  return (
    <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-center">
      {/* Donut graphic */}
      <div className="relative flex shrink-0 items-center justify-center">
        <svg className="h-44 w-44 -rotate-90 transform" viewBox="0 0 160 160">
          {/* Base track */}
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="16" />

          {/* On Track Segment */}
          {onTrack > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#10b981"
              strokeWidth={activeSegment === "on_track" ? "20" : "16"}
              strokeDasharray={`${dashOnTrack} ${circumference}`}
              strokeDashoffset={offsetOnTrack}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveSegment("on_track")}
              onMouseLeave={() => setActiveSegment(null)}
            />
          )}

          {/* Slightly Late Segment */}
          {late > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={activeSegment === "late" ? "20" : "16"}
              strokeDasharray={`${dashLate} ${circumference}`}
              strokeDashoffset={offsetLate}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveSegment("late")}
              onMouseLeave={() => setActiveSegment(null)}
            />
          )}

          {/* At Risk Segment */}
          {risk > 0 && (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#ef4444"
              strokeWidth={activeSegment === "risk" ? "20" : "16"}
              strokeDasharray={`${dashRisk} ${circumference}`}
              strokeDashoffset={offsetRisk}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setActiveSegment("risk")}
              onMouseLeave={() => setActiveSegment(null)}
            />
          )}
        </svg>

        {/* Center Content */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[26px] font-extrabold tracking-tight text-slate-900">{slaRate}%</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Đạt SLA</span>
        </div>
      </div>

      {/* Legend & Breakdown stats */}
      <div className="flex w-full flex-col gap-2.5 sm:max-w-xs">
        {/* On track pill */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border p-2.5 transition-all cursor-pointer",
            activeSegment === "on_track"
              ? "border-emerald-300 bg-emerald-50/70 shadow-sm"
              : "border-slate-100 bg-slate-50/60 hover:bg-white"
          )}
          onMouseEnter={() => setActiveSegment("on_track")}
          onMouseLeave={() => setActiveSegment(null)}
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            <span className="text-[12.5px] font-medium text-slate-700">Đúng tiến độ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-900">{onTrack} đơn</span>
            <span className="text-[11px] text-slate-400">({pOnTrack.toFixed(0)}%)</span>
          </div>
        </div>

        {/* Slightly late pill */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border p-2.5 transition-all cursor-pointer",
            activeSegment === "late"
              ? "border-amber-300 bg-amber-50/70 shadow-sm"
              : "border-slate-100 bg-slate-50/60 hover:bg-white"
          )}
          onMouseEnter={() => setActiveSegment("late")}
          onMouseLeave={() => setActiveSegment(null)}
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-amber-200" />
            <span className="text-[12.5px] font-medium text-slate-700">Chậm tiến độ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-900">{late} đơn</span>
            <span className="text-[11px] text-slate-400">({pLate.toFixed(0)}%)</span>
          </div>
        </div>

        {/* At risk pill */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl border p-2.5 transition-all cursor-pointer",
            activeSegment === "risk"
              ? "border-rose-300 bg-rose-50/70 shadow-sm"
              : "border-slate-100 bg-slate-50/60 hover:bg-white"
          )}
          onMouseEnter={() => setActiveSegment("risk")}
          onMouseLeave={() => setActiveSegment(null)}
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-200" />
            <span className="text-[12.5px] font-medium text-slate-700">Có rủi ro SLA</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-slate-900">{risk} đơn</span>
            <span className="text-[11px] text-slate-400">({pRisk.toFixed(0)}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 3. BIỂU ĐỒ DÒNG CHẢY PHỄU TUYỂN DỤNG (Interactive Pipeline Funnel Flow)
// =========================================================================

export function InteractiveFunnelChart({
  applied,
  interview,
  waiting,
  working,
  target,
}: {
  applied: number;
  interview: number;
  waiting: number;
  working: number;
  target: number;
}) {
  const steps = [
    {
      id: "applied",
      label: "Ứng tuyển ban đầu",
      sub: "Hồ sơ tiếp nhận",
      count: applied,
      color: "from-blue-600 to-indigo-600",
      textColor: "text-blue-700",
      bgColor: "bg-blue-50",
      badgeColor: "bg-blue-100 text-blue-800",
      ratio: "100%",
    },
    {
      id: "interview",
      label: "Lịch phỏng vấn",
      sub: "DN hẹn phỏng vấn",
      count: interview,
      color: "from-amber-500 to-amber-600",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50",
      badgeColor: "bg-amber-100 text-amber-800",
      ratio: applied > 0 ? `${((interview / applied) * 100).toFixed(0)}%` : "0%",
    },
    {
      id: "waiting",
      label: "Chờ nhận việc",
      sub: "Trúng tuyển chờ ngày",
      count: waiting,
      color: "from-sky-500 to-cyan-600",
      textColor: "text-sky-700",
      bgColor: "bg-sky-50",
      badgeColor: "bg-sky-100 text-sky-800",
      ratio: interview > 0 ? `${((waiting / interview) * 100).toFixed(0)}%` : "0%",
    },
    {
      id: "working",
      label: "Chính thức đi làm",
      sub: "Tại các nhà máy",
      count: working,
      color: "from-emerald-500 to-teal-600",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50",
      badgeColor: "bg-emerald-100 text-emerald-800",
      ratio: target > 0 ? `${((working / target) * 100).toFixed(0)}% chỉ tiêu` : "0%",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 4 Connected Flow Columns */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* Top Accent line */}
            <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", step.color)} />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
                  Bước {idx + 1}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", step.badgeColor)}>
                  {step.ratio}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold tracking-tight text-slate-900">{step.count}</span>
                <span className="text-[12px] text-slate-400">NLĐ</span>
              </div>

              <h4 className="mt-1 text-[13.5px] font-bold text-slate-800">{step.label}</h4>
              <p className="text-[11.5px] text-slate-500">{step.sub}</p>
            </div>

            {/* Connection Arrow indicator for all except last */}
            {idx < steps.length - 1 && (
              <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 shadow-xs text-slate-400">
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Visual Pipeline Bar */}
      <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-slate-700">Tỷ lệ quy đổi dòng phễu tuyển dụng</span>
          <span className="text-[11.5px] text-slate-500">Chỉ tiêu toàn chu kỳ: <strong>{target} người</strong></span>
        </div>

        <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="bg-emerald-500 transition-all duration-500"
            title={`Đã đi làm: ${working}`}
            style={{ width: `${target > 0 ? (working / target) * 100 : 0}%` }}
          />
          <div
            className="bg-sky-400 transition-all duration-500"
            title={`Chờ việc: ${waiting}`}
            style={{ width: `${target > 0 ? (waiting / target) * 100 : 0}%` }}
          />
          <div
            className="bg-amber-400 transition-all duration-500"
            title={`Phỏng vấn: ${interview}`}
            style={{ width: `${target > 0 ? (interview / target) * 100 : 0}%` }}
          />
          <div
            className="bg-blue-300 transition-all duration-500"
            title={`Ứng tuyển: ${applied}`}
            style={{ width: `${target > 0 ? (applied / target) * 100 : 0}%` }}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Đã đi làm ({working})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <span>Chờ việc ({waiting})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Phỏng vấn ({interview})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-300" />
            <span>Ứng tuyển ({applied})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 4. BIỂU ĐỒ DIỄN BIẾN TIẾN ĐỘ CHU KỲ (Pacing & Burndown Area Chart)
// =========================================================================

export function CyclePacingAreaChart({
  passedDays,
  totalDays,
  currentWorking,
  target,
}: {
  passedDays: number;
  totalDays: number;
  currentWorking: number;
  target: number;
}) {
  const points = useMemo(() => {
    // Generate simulated/paced milestones for the timeline
    const count = 7;
    const pts: { day: number; expected: number; actual: number | null }[] = [];
    for (let i = 0; i < count; i++) {
      const d = Math.round((i / (count - 1)) * totalDays);
      const expected = Math.round((d / totalDays) * target);
      // actual pace
      const isPast = d <= passedDays;
      const actual = isPast ? Math.round((d / Math.max(1, passedDays)) * currentWorking) : null;
      pts.push({ day: d, expected, actual });
    }
    return pts;
  }, [passedDays, totalDays, currentWorking, target]);

  const maxVal = Math.max(target, 10);
  const width = 500;
  const height = 140;

  // Build SVG path for expected line
  const expectedPoints = points
    .map((p, idx) => {
      const x = 30 + (idx / (points.length - 1)) * (width - 40);
      const y = height - (p.expected / maxVal) * (height - 30) - 15;
      return `${x},${y}`;
    })
    .join(" ");

  // Build SVG path for actual points
  const actualPoints = points
    .filter((p) => p.actual !== null)
    .map((p, idx, arr) => {
      const originalIdx = points.indexOf(p);
      const x = 30 + (originalIdx / (points.length - 1)) * (width - 40);
      const y = height - ((p.actual ?? 0) / maxVal) * (height - 30) - 15;
      return { x, y };
    });

  const actualPath = actualPoints.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

  const actualAreaPath =
    actualPoints.length > 0
      ? `${actualPath} L ${actualPoints[actualPoints.length - 1]?.x} ${height - 15} L ${actualPoints[0]?.x} ${
          height - 15
        } Z`
      : "";

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="font-semibold text-slate-700">Đường chuẩn tốc độ cung ứng (Pacing Trend)</span>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-slate-300" style={{ borderTop: "2px dashed #94a3b8" }} />
            <span className="text-slate-500">Kế hoạch kỳ vọng</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-slate-700 font-semibold">Tốc độ thực tế</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
          <defs>
            <linearGradient id="actualAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="30" y1={height - 15} x2={width - 10} y2={height - 15} stroke="#e2e8f0" strokeWidth="1" />
          <line x1="30" y1={15} x2={width - 10} y2={15} stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />

          {/* Target boundary line */}
          <polyline fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" points={expectedPoints} />

          {/* Actual Area */}
          {actualAreaPath && <path d={actualAreaPath} fill="url(#actualAreaGrad)" />}

          {/* Actual Stroke */}
          {actualPath && <path d={actualPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />}

          {/* Actual Nodes */}
          {actualPoints.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === actualPoints.length - 1 ? "4.5" : "3"}
              className="fill-white stroke-blue-600"
              strokeWidth="2"
            />
          ))}

          {/* Axis labels */}
          <text x="30" y={height - 2} className="fill-slate-400 text-[10px]">
            Ngày 01
          </text>
          <text x={width - 15} y={height - 2} textAnchor="end" className="fill-slate-400 text-[10px]">
            Ngày {totalDays}
          </text>
        </svg>
      </div>
    </div>
  );
}
