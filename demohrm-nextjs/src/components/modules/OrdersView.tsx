"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fetchLiveOrders, fetchLivePositions, toOrderSummary } from "@/lib/live";
import type { OrderSummary } from "@/types/hrm";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { StatusPill, statusToneForHealth } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/kpi-card";
import { QueryState } from "@/components/ui/query-state";
import { ApiError } from "@/lib/api";

const legendTone: Record<string, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-400",
  orange: "bg-amber-500",
  grey: "bg-slate-300",
};

export function OrdersView() {
  const { periodCode, periods } = useApp();
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
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
    Promise.all([fetchLiveOrders(periodCode), fetchLivePositions()])
      .then(([rows, positions]) => {
        if (alive) {
          setOrders(rows.map((r) => toOrderSummary(r, positions)));
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được đơn hàng.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [periodCode]);

  const visible = useMemo(
    () => orders.filter((o) => o.title.toLowerCase().includes(query.toLowerCase().trim()) || o.code.toLowerCase().includes(query.toLowerCase().trim())),
    [query, orders]
  );

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Đơn hàng cung ứng"
        sub={periodName}
        actions={
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm đơn hàng..."
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
          />
        }
      />
      <QueryState loading={loading || !periodCode} error={error}>
        <div className="page-body flex flex-col gap-4">
          {visible.map((o) => (
            <article key={o.code} className="grid gap-5 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-[1.1fr_1.2fr_1fr]">
              <div>
                <StatusPill tone={o.status === "Đang chạy" ? "success" : "neutral"}>{o.status}</StatusPill>
                <h2 className="mt-2 text-[17px] font-bold text-slate-900">{o.title}</h2>
                <div className="text-[12.5px] text-slate-500">{o.code} · {o.period}</div>
                <div className="text-[12.5px] text-slate-500">Phụ trách: {o.manager}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Chỉ tiêu", `${o.target} người`],
                    ["Đã đi làm", `${o.working}`],
                    ["Vị trí tuyển", `${o.positions}`],
                    ["Vendor tham gia", `${o.vendors}`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <div className="text-[11px] text-slate-500">{k}</div>
                      <div className="font-bold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold text-slate-600">
                  <span>Vị trí tuyển chính</span>
                  <span className="font-normal text-slate-400">Tiến độ giao người</span>
                </div>
                <div className="flex flex-col gap-3">
                  {o.items.map((p) => {
                    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                    return (
                      <div key={p.idx}>
                        <div className="mb-1 flex items-center justify-between text-[13px]">
                          <span><span className="mr-1.5 font-bold text-[#0052cc]">{p.idx}</span>{p.name}</span>
                          <span className="text-slate-500">{p.done}/{p.total} · {pct}%</span>
                        </div>
                        <ProgressBar value={pct} tone="green" />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-[12.5px] font-semibold text-slate-600">Tổng quan hồ sơ ({o.totalProfiles})</div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {o.funnel.map((f) => (
                    <div key={f.label} className="flex items-center gap-2 text-[13px] text-slate-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${legendTone[f.tone]}`} />
                      {f.label} ({f.value})
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-2 text-[13px]">
                  <span className="text-slate-500">Tiến độ</span>
                  <StatusPill tone={statusToneForHealth(o.health)}>{o.health}</StatusPill>
                </div>
              </div>
            </article>
          ))}
          {visible.length === 0 && <p className="py-10 text-center text-slate-400">Không có đơn hàng trong kỳ này.</p>}
        </div>
      </QueryState>
    </section>
  );
}
