"use client";

import { useEffect, useState } from "react";
import { fetchLiveDashboard, fetchLiveOrders } from "@/lib/live";
import type { LiveOrderRow, LivePeriodDashboard } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard, ProgressBar } from "@/components/ui/kpi-card";
import { useApp } from "@/lib/store";
import { QueryState } from "@/components/ui/query-state";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";

function dayIndex(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const today = new Date();
  const span = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  const passed = Math.min(span, Math.max(1, Math.round((today.getTime() - s.getTime()) / 86400000) + 1));
  return `Ngày ${passed} / ${span} · ${start.split("-").reverse().join("/")} – ${end.split("-").reverse().join("/")}`;
}

export function DashboardView() {
  const { setCurrentModule, periodCode, periods } = useApp();
  const [dash, setDash] = useState<LivePeriodDashboard | null>(null);
  const [rows, setRows] = useState<LiveOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const periodName = periods.find((p) => p.code === periodCode)?.name ?? "Tổng quan";
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    if (!periodCode) return;
    let alive = true;
    Promise.all([fetchLiveDashboard(periodCode), fetchLiveOrders(periodCode)])
      .then(([d, o]) => {
        if (!alive) return;
        setDash(d);
        setRows(o);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được tổng quan.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode]);

  const target = dash?.target_qty ?? 0;
  const working = dash?.working_qty ?? 0;
  const pct = target > 0 ? (working / target) * 100 : 0;
  const onTrack = rows.filter((r) => r.health === "on_track").length;
  const late = rows.filter((r) => r.health === "slightly_late").length;
  const risk = rows.filter((r) => r.health === "at_risk").length;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title={periodName} />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="CHỈ TIÊU CUNG ỨNG" value={<>{target} <span className="text-[14px] font-medium text-slate-400">người</span></>} sub={`${dash?.order_count ?? 0} đơn hàng`} extra={<div className="text-[12.5px] text-slate-500">{dash ? dayIndex(dash.start_date, dash.end_date) : ""}</div>} />
            <KpiCard title="TRẠNG THÁI ĐƠN HÀNG" value={<>{dash?.order_count ?? 0} <span className="text-[14px] font-medium text-slate-400">đơn</span></>} sub={`${onTrack} đúng tiến độ · ${late} chậm tiến độ · ${risk} có rủi ro`} />
            <KpiCard
              title="TIẾN ĐỘ HIỆN TẠI"
              value={`${pct.toFixed(1).replace(".", ",")}%`}
              sub={`${working} người đã đi làm · ${dash?.total_work_days ?? 0} ngày công`}
              extra={<div className="mt-2"><ProgressBar value={pct} tone="blue" /></div>}
            />
          </div>
          <div className="mt-4 rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[14.5px] font-bold text-slate-900">Tổng chỉ tiêu {periodName}: {target} người</div>
                <div className="text-[13px] text-slate-500">Hiện tại: {working} người đã đi làm</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentModule("orders")}>Xem đơn hàng</Button>
            </div>
            <div className="mt-3"><ProgressBar value={pct} tone="blue" /></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {rows.map((r) => {
                const rowPct = r.target_qty > 0 ? (r.working_qty / r.target_qty) * 100 : 0;
                return (
                  <div key={r.order_id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <div className="text-[13.5px] font-semibold text-slate-900">{r.company} &gt; {r.name}</div>
                    <div className="text-[12px] text-slate-500">Chỉ tiêu {r.target_qty} · đã đi làm {r.working_qty}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={rowPct} tone={rowPct >= 50 ? "green" : "amber"} className="flex-1" />
                      <span className="text-[12px] font-bold text-slate-700">{rowPct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
