"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { fetchLivePayroll, generateLivePayroll } from "@/lib/live";
import type { LivePayrollRow } from "@/lib/live";
import { formatVND } from "@/lib/format";
import { initialsOf } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";
import { Button } from "@/components/ui/button";

function num(v: number | string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function PayrollView() {
  const { periodCode, periods } = useApp();
  const { access } = useSession();
  const [rows, setRows] = useState<LivePayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const periodName = periods.find((p) => p.code === periodCode)?.name ?? periodCode;

  useEffect(() => {
    if (!periodCode) return;
    let alive = true;
    setLoading(true);
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
  }, [periodCode, reloadKey]);

  const generate = async () => {
    if (!periodCode) return;
    if (!window.confirm(`Tính lương kỳ ${periodName}? Hệ thống sẽ sinh lương theo bảng công hiện có.`)) return;
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      await generateLivePayroll(periodCode);
      setNotice("Đã tính lương kỳ này.");
      setReloadKey((value) => value + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Tính lương thất bại.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Lương"
        sub={periodName}
        actions={
          access.canClosePeriod ? (
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" disabled={generating || !periodCode} onClick={() => void generate()}>
              {generating ? "Đang tính..." : "Tính lương kỳ"}
            </Button>
          ) : undefined
        }
      />
      <QueryState loading={loading || !periodCode} error={error && rows.length === 0 ? error : ""}>
        <div className="page-body">
          {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">{notice}</p>}
          {error && rows.length > 0 && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
          <DataTable headers={["Họ tên", "Công ty", "Ngày công", "Lương", "Phụ cấp", "Khấu trừ", "Tạm ứng", "Thực lãnh"]}>
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
