"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { fetchLiveOrders, fetchLiveSites } from "@/lib/live";
import type { LiveOrderRow, LiveSite } from "@/lib/live";
import { formatVND } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard, ProgressBar } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill, statusToneForHealth } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";

const HEALTH: Record<string, string> = {
  on_track: "Đúng tiến độ",
  slightly_late: "Chậm tiến độ",
  at_risk: "Có rủi ro",
};

export function FactoryView() {
  const { currentFactory, companies, periodCode } = useApp();
  const company = companies.find((c) => c.short_name === currentFactory) ?? companies[0];
  const [orders, setOrders] = useState<LiveOrderRow[]>([]);
  const [sites, setSites] = useState<LiveSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const queryKey = `${periodCode}|${company?.short_name ?? ""}`;
  const [prevKey, setPrevKey] = useState(queryKey);
  if (prevKey !== queryKey) {
    setPrevKey(queryKey);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    if (!periodCode || !company) return;
    let alive = true;
    Promise.all([fetchLiveOrders(periodCode), fetchLiveSites(company.id)])
      .then(([orderRows, siteRows]) => {
        if (!alive) return;
        setOrders(orderRows.filter((o) => o.company === company.short_name));
        setSites(siteRows);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được nhà máy.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode, company]);

  const target = orders.reduce((s, o) => s + o.target_qty, 0);
  const working = orders.reduce((s, o) => s + o.working_qty, 0);
  const pct = target > 0 ? (working / target) * 100 : 0;
  const site = sites[0];

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title={company?.name ?? "Nhà máy"}
        sub={site ? `${site.address ?? site.name} · Bán kính ${site.geofence_radius_m ?? "—"}m` : company?.hotline ?? ""}
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="ĐANG LÀM / CHỈ TIÊU" value={<>{working} / {target}</>} sub={`${pct.toFixed(1)}%`} extra={<div className="mt-2"><ProgressBar value={pct} tone="green" /></div>} />
            <KpiCard title="ĐỊA ĐIỂM" value={<span className="text-[18px]">{sites.length}</span>} sub={site ? `${site.latitude ?? ""}, ${site.longitude ?? ""}` : "Chưa có work site"} />
            <KpiCard title="ĐƠN GIÁ" value={company?.bill_rate_per_day ? formatVND(company.bill_rate_per_day) : "—"} sub="bill_rate_per_day" />
          </div>
          <div className="mt-4">
            <DataTable headers={["Mã đơn", "Tên", "Chỉ tiêu", "Đang làm", "Tiến độ"]}>
              {orders.map((o) => (
                <tr key={o.order_id}>
                  <td><code>{o.code}</code></td>
                  <td><strong>{o.name}</strong></td>
                  <td>{o.target_qty}</td>
                  <td>{o.working_qty}</td>
                  <td><StatusPill tone={statusToneForHealth(HEALTH[o.health] ?? "Có rủi ro")}>{HEALTH[o.health] ?? o.health}</StatusPill></td>
                </tr>
              ))}
              {orders.length === 0 && <EmptyRow colSpan={5} text="Không có đơn trong kỳ này" />}
            </DataTable>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
