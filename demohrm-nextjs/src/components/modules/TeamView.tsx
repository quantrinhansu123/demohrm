"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { fetchLiveRecruiters } from "@/lib/live";
import type { LiveRecruiter } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard, ProgressBar } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";

function leaderName(leader: { full_name: string } | { full_name: string }[] | null): string {
  if (!leader) return "—";
  if (Array.isArray(leader)) return leader[0]?.full_name ?? "—";
  return leader.full_name;
}

export function TeamView() {
  const { currentTeam, teams } = useApp();
  const team = teams.find((t) => t.code === currentTeam) ?? teams[0];
  const [rows, setRows] = useState<LiveRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchLiveRecruiters()
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được nguồn tuyển.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const working = rows.reduce((s, r) => s + r.working, 0);
  const total = rows.reduce((s, r) => s + r.total_workers, 0);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title={team?.name ?? "Nhóm tuyển dụng"} sub={team ? `${team.region ?? ""} · Trưởng nhóm: ${leaderName(team.leader)}` : ""} />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="NGUỒN TUYỂN" value={<>{rows.length}</>} sub="Toàn hệ thống, không tách theo nhóm" />
            <KpiCard title="ĐANG LÀM" value={<>{working}</>} sub={`Trên ${total} hồ sơ gắn nguồn`} extra={<div className="mt-2"><ProgressBar value={total ? (working / total) * 100 : 0} tone="green" /></div>} />
            <KpiCard title="CHỜ ĐI LÀM" value={<>{rows.reduce((s, r) => s + r.waiting_start, 0)}</>} />
          </div>
          <div className="mt-4">
            <DataTable headers={["Nguồn", "Mã", "Loại", "Tổng hồ sơ", "Đang làm", "Chờ đi làm", "Ngừng"]}>
              {rows.map((r) => (
                <tr key={`${r.source_type}-${r.source_id}`}>
                  <td><strong>{r.source_name}</strong></td>
                  <td><code>{r.source_code}</code></td>
                  <td>{r.source_type}</td>
                  <td>{r.total_workers}</td>
                  <td>{r.working}</td>
                  <td>{r.waiting_start}</td>
                  <td>{r.inactive}</td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow colSpan={7} />}
            </DataTable>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
