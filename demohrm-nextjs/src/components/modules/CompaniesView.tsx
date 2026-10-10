"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { fetchLiveOrders, fetchLiveSites } from "@/lib/live";
import type { LiveOrderRow, LiveSite } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";

export function CompaniesView() {
  const { companies, periodCode } = useApp();
  const [orders, setOrders] = useState<LiveOrderRow[]>([]);
  const [sites, setSites] = useState<LiveSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    if (!periodCode) return;
    let alive = true;
    Promise.all([fetchLiveOrders(periodCode), fetchLiveSites()])
      .then(([orderRows, siteRows]) => {
        if (!alive) return;
        setOrders(orderRows);
        setSites(siteRows);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được công ty.");
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
      <ModuleHeader title="Công ty khách hàng" sub="Địa điểm và tiến độ đơn trong kỳ đang chọn" />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body">
          <DataTable headers={["Mã", "Tên", "Liên hệ", "Địa điểm", "Đang làm", "Chỉ tiêu", "Đơn giá/ngày"]}>
            {companies.map((c) => {
              const mine = orders.filter((o) => o.company === c.short_name);
              const site = sites.find((s) => s.company_id === c.id);
              return (
                <tr key={c.id}>
                  <td><strong>{c.short_name}</strong></td>
                  <td>{c.name}</td>
                  <td>{c.contact_name ?? "—"} <span className="text-slate-400">{c.contact_phone ?? c.hotline ?? ""}</span></td>
                  <td>{site ? `${site.name} · ${site.address ?? ""}` : "—"}</td>
                  <td><StatusPill tone="info">{mine.reduce((s, o) => s + o.working_qty, 0)}</StatusPill></td>
                  <td>{mine.reduce((s, o) => s + o.target_qty, 0)}</td>
                  <td>{c.bill_rate_per_day ?? "—"}</td>
                </tr>
              );
            })}
            {companies.length === 0 && <EmptyRow colSpan={7} />}
          </DataTable>
        </div>
      </QueryState>
    </section>
  );
}
