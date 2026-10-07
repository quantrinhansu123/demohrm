"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { fetchLivePayroll } from "@/lib/live";
import type { LivePayrollRow } from "@/lib/live";
import { formatVND } from "@/lib/format";
import { initialsOf } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";

function num(v: number | string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function PayrollView() {
  const { periodCode, periods } = useApp();
  const [rows, setRows] = useState<LivePayrollRow[]>([]);
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
    fetchLivePayroll(periodCode)
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được bảng lương.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode]);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title="Lương & tạm ứng" sub={periodName} />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <DataTable headers={["Họ tên", "Công ty", "Ngày công", "Lương", "Phụ cấp", "Khấu trừ", "Tạm ứng", "Thực lĩnh"]}>
            {rows.map((w) => (
              <tr key={w.code}>
                <td>
                  <span className="flex items-center gap-2">
                    <Avatar tone="avatar-blue" size="sm">{initialsOf(w.full_name)}</Avatar>
                    <strong>{w.full_name}</strong>
                  </span>
                </td>
                <td>{w.companies ?? "—"}</td>
                <td><strong>{num(w.work_days)}</strong></td>
                <td>{formatVND(num(w.wage_amount))}</td>
                <td>{formatVND(num(w.extra_amount))}</td>
                <td>{formatVND(num(w.deduction))}</td>
                <td>{formatVND(num(w.advance_amount))}</td>
                <td><strong className="text-emerald-600">{formatVND(num(w.net_amount))}</strong></td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} text="Chưa có dòng lương trong kỳ này" />}
          </DataTable>
        </div>
      </QueryState>
    </section>
  );
}
