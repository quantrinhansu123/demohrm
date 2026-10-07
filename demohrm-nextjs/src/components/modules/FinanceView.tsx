"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { fetchLiveFinance } from "@/lib/live";
import type { LiveFinanceTx } from "@/lib/live";
import { formatVND } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";

export function FinanceView() {
  const [rows, setRows] = useState<LiveFinanceTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchLiveFinance()
      .then((page) => {
        if (!alive) return;
        setRows(page.rows);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được sổ thu chi.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount || 0), 0);
  const expense = rows.filter((r) => r.type !== "income").reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title="Tài chính thu chi" sub="Số liệu từ sổ giao dịch" />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="TỔNG THU" value={formatVND(income)} valueClassName="text-emerald-600" sub={`${rows.filter((r) => r.type === "income").length} giao dịch`} />
            <KpiCard title="TỔNG CHI" value={formatVND(expense)} valueClassName="text-rose-600" sub={`${rows.filter((r) => r.type !== "income").length} giao dịch`} />
            <KpiCard title="CHÊNH LỆCH" value={formatVND(income - expense)} valueClassName="text-[#0052cc]" sub="Trên các dòng đang hiển thị" />
          </div>
          <div className="mt-4">
            <DataTable headers={["Mã", "Ngày", "Loại", "Danh mục", "Nội dung", "Đối tác", "Số tiền", "Trạng thái"]}>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td><code>{t.code}</code></td>
                  <td>{t.txn_date}</td>
                  <td><StatusPill tone={t.type === "income" ? "success" : "danger"}>{t.type === "income" ? "Thu" : "Chi"}</StatusPill></td>
                  <td>{t.category?.name ?? "—"}</td>
                  <td>{t.description ?? "—"}</td>
                  <td>{t.company?.short_name ?? t.worker?.full_name ?? "—"}</td>
                  <td><strong className={t.type === "income" ? "text-emerald-600" : "text-rose-600"}>{formatVND(Number(t.amount))}</strong></td>
                  <td><StatusPill tone="info">{t.status}</StatusPill></td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow colSpan={8} />}
            </DataTable>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
