"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { fetchLiveAudit } from "@/lib/live";
import type { LiveAudit } from "@/lib/live";
import { useApp } from "@/lib/store";
import { roleLabel } from "@/lib/access";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";

export function AuditView() {
  const { staff } = useApp();
  const [rows, setRows] = useState<LiveAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const names = new Map(staff.map((s) => [s.id, s.full_name]));

  useEffect(() => {
    let alive = true;
    fetchLiveAudit()
      .then((page) => {
        if (!alive) return;
        setRows(page.rows);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được nhật ký.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader title="Nhật ký thao tác" sub="100 dòng gần nhất" />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <DataTable headers={["Thời gian", "Người dùng", "Vai trò", "Hành động", "Bảng", "Chi tiết", "IP"]}>
            {rows.map((log) => (
              <tr key={log.id}>
                <td><span className="text-[12px] text-slate-500">{new Date(log.occurred_at).toLocaleString("vi-VN")}</span></td>
                <td><strong>{log.actor_id ? names.get(log.actor_id) ?? `#${log.actor_id}` : "—"}</strong></td>
                <td><StatusPill tone="info">{log.actor_role ? roleLabel(log.actor_role) : "—"}</StatusPill></td>
                <td><code>{log.action}</code></td>
                <td>{log.table_name ?? "—"} {log.record_id ?? ""}</td>
                <td>{log.detail ?? "—"}</td>
                <td><code>{log.ip_address ?? "—"}</code></td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={7} />}
          </DataTable>
        </div>
      </QueryState>
    </section>
  );
}
