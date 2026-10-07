"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { fetchLiveCommissions } from "@/lib/live";
import type { LiveCommission } from "@/lib/live";
import { formatVND, initialsOf } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";

function num(v: number | string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function CommissionView() {
  const { periodCode, periods } = useApp();
  const [rows, setRows] = useState<LiveCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const periodName = periods.find((p) => p.code === periodCode)?.name ?? periodCode;
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    if (!periodCode) return;
    let alive = true;
    fetchLiveCommissions(periodCode)
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được hoa hồng.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode]);

  const total = rows.reduce((s, r) => s + num(r.commission_amount), 0);
  const days = rows.reduce((s, r) => s + num(r.work_days), 0);
  const avg = days > 0 ? Math.round(total / days) : 0;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title="Hoa hồng dự kiến" sub={periodName} />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="TỔNG HOA HỒNG" value={formatVND(total)} valueClassName="text-violet-700" sub={`${rows.length} dòng`} />
            <KpiCard title="ĐƠN GIÁ BÌNH QUÂN" value={formatVND(avg)} sub="Tổng hoa hồng / tổng công" />
            <KpiCard title="TỔNG CÔNG" value={<>{days} <span className="text-[14px] font-medium text-slate-400">ngày</span></>} sub="Từ ước tính hoa hồng" />
          </div>
          <div className="mt-4">
            <DataTable headers={["Họ tên", "Công ty", "Kỳ", "Ngày công", "Đơn giá", "Hoa hồng"]}>
              {rows.map((w, i) => (
                <tr key={`${w.period_code}-${w.code}-${w.company ?? ""}-${i}`}>
                  <td>
                    <span className="flex items-center gap-2">
                      <Avatar tone="avatar-purple" size="sm">{initialsOf(w.full_name)}</Avatar>
                      <strong>{w.full_name}</strong>
                    </span>
                  </td>
                  <td>{w.company ?? "—"}</td>
                  <td>{w.period_code}</td>
                  <td>{num(w.work_days)}</td>
                  <td>{formatVND(num(w.rate_per_day))}</td>
                  <td><strong className="text-violet-700">{formatVND(num(w.commission_amount))}</strong></td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow colSpan={6} />}
            </DataTable>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
