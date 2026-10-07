"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { fetchLiveVendorQuotas, fetchLiveVendors } from "@/lib/live";
import type { LiveVendor, LiveVendorQuota } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";

export function VendorsView() {
  const [vendors, setVendors] = useState<LiveVendor[]>([]);
  const [quotas, setQuotas] = useState<LiveVendorQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([fetchLiveVendors(), fetchLiveVendorQuotas()])
      .then(([v, q]) => {
        if (!alive) return;
        setVendors(v);
        setQuotas(q);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được vendor.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const quotaSum = quotas.reduce((s, q) => s + q.quota_qty, 0);
  const active = vendors.filter((v) => v.contract_active).length;

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title="Vendor và hạn mức" />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="ĐỐI TÁC" value={<>{vendors.length}</>} sub={`${active} hợp đồng hiệu lực`} />
            <KpiCard title="HẠN MỨC ĐÃ CẤP" value={<>{quotaSum}</>} sub={`${quotas.length} dòng hạn mức`} />
            <KpiCard title="SLA TRUNG BÌNH" value={`${quotas.length ? Math.round(quotas.reduce((s, q) => s + (q.sla_target_pct ?? 0), 0) / quotas.length) : 0}%`} sub="Mục tiêu trên hạn mức" />
          </div>
          <div className="mt-4">
            <DataTable headers={["Vendor", "Nhà máy", "Hạn mức", "SLA", "Hạn bàn giao", "Phụ trách", "SĐT", "Trạng thái"]}>
              {quotas.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.vendor?.short_name ?? q.vendor?.name ?? "—"}</strong></td>
                  <td>{q.company?.short_name ?? "—"}</td>
                  <td>{q.quota_qty}</td>
                  <td>{q.sla_target_pct ?? "—"}%</td>
                  <td>{q.handover_deadline ?? "—"}</td>
                  <td>{q.vendor?.representative ?? "—"}</td>
                  <td><code>{q.vendor?.phone ?? "—"}</code></td>
                  <td><StatusPill tone="info">{q.vendor?.status ?? "—"}</StatusPill></td>
                </tr>
              ))}
              {quotas.length === 0 && <EmptyRow colSpan={8} />}
            </DataTable>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
