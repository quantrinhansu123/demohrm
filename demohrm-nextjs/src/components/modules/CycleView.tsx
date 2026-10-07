"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { closeLivePeriod, fetchLiveDashboard } from "@/lib/live";
import type { LivePeriodDashboard } from "@/lib/live";
import { formatVND } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard, ProgressBar } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/ui/query-state";

export function CycleView() {
  const { periodCode, periods } = useApp();
  const { access } = useSession();
  const period = periods.find((p) => p.code === periodCode);
  const [dash, setDash] = useState<LivePeriodDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!periodCode) return;
    let alive = true;
    setLoading(true);
    fetchLiveDashboard(periodCode)
      .then((d) => {
        if (!alive) return;
        setDash(d);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được chu kỳ.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode]);

  const close = async () => {
    if (!periodCode || !window.confirm(`Chốt kỳ ${periodCode}?`)) return;
    setBusy(true);
    setNote("");
    try {
      await closeLivePeriod(periodCode);
      setNote("Đã gửi lệnh chốt kỳ.");
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : "Không chốt được kỳ.");
    } finally {
      setBusy(false);
    }
  };

  const pct = dash && dash.target_qty > 0 ? (dash.working_qty / dash.target_qty) * 100 : 0;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title={period?.name ?? periodCode}
        sub={dash ? `${dash.start_date} – ${dash.end_date}` : ""}
        actions={access.canClosePeriod ? <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void close()}>{busy ? "Đang chốt..." : "Chốt kỳ"}</Button> : undefined}
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          {note && <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">{note}</p>}
          <div className="mb-3"><StatusPill tone={dash?.status === "open" ? "success" : "neutral"}>{dash?.status ?? "—"}</StatusPill></div>
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="THỰC ĐẠT" value={<>{dash?.working_qty ?? 0} / {dash?.target_qty ?? 0}</>} sub={`${pct.toFixed(1)}%`} extra={<div className="mt-2"><ProgressBar value={pct} tone="green" /></div>} />
            <KpiCard title="NGÀY CÔNG" value={<>{dash?.total_work_days ?? 0}</>} sub={`${dash?.order_count ?? 0} đơn`} />
            <KpiCard title="TẠM ỨNG ĐÃ DUYỆT" value={formatVND(dash?.approved_advances ?? 0)} sub={`${dash?.advance_workers ?? 0} người`} />
          </div>
        </div>
      </QueryState>
    </section>
  );
}
