"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { fetchLiveDailyReport } from "@/lib/live";
import type { LiveDailyReport } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";

function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

export function ReportsView() {
  const [date, setDate] = useState(todayVN);
  const [rows, setRows] = useState<LiveDailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prevDate, setPrevDate] = useState(date);
  if (prevDate !== date) {
    setPrevDate(date);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    let alive = true;
    fetchLiveDailyReport(date)
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được báo cáo.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [date]);

  const target = rows.reduce((s, r) => s + r.target_qty, 0);
  const active = rows.reduce((s, r) => s + r.active_qty, 0);
  const attended = rows.reduce((s, r) => s + r.attended_qty, 0);
  const rate = active > 0 ? (attended / active) * 100 : 0;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Báo cáo ngày"
        actions={<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[13px]" />}
      />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="ĐI LÀM / ĐANG LÀM" value={`${rate.toFixed(1)}%`} valueClassName="text-emerald-600" sub={`${attended} có mặt / ${active} đang làm`} />
            <KpiCard title="CHỈ TIÊU TRONG NGÀY" value={<>{target} <span className="text-[14px] font-medium text-slate-400">người</span></>} sub={`${rows.length} đơn`} />
            <KpiCard title="THIẾU" value={<>{rows.reduce((s, r) => s + r.missing_qty, 0)} <span className="text-[14px] font-medium text-slate-400">người</span></>} sub="So với chỉ tiêu đơn" />
          </div>
          <div className="mt-4">
            <DataTable headers={["Đơn", "Công ty", "Chỉ tiêu", "Đang làm", "Có mặt", "Thiếu", "Đánh giá"]}>
              {rows.map((r) => {
                const pct = r.target_qty > 0 ? (r.active_qty / r.target_qty) * 100 : 0;
                const tone = pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger";
                return (
                  <tr key={r.order_id}>
                    <td><strong>{r.order_code}</strong> {r.order_name}</td>
                    <td>{r.company}</td>
                    <td>{r.target_qty}</td>
                    <td>{r.active_qty}</td>
                    <td>{r.attended_qty}</td>
                    <td>{r.missing_qty}</td>
                    <td><StatusPill tone={tone}>{pct.toFixed(0)}%</StatusPill></td>
                  </tr>
                );
              })}
              {rows.length === 0 && <EmptyRow colSpan={7} text="Không có đơn trong ngày này" />}
            </DataTable>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
