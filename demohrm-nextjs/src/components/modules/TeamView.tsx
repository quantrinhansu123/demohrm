"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import { fetchLiveRecruiters } from "@/lib/live";
import type { LiveRecruiter } from "@/lib/live";
import { createLiveQuotaAssignment, deleteLiveQuotaAssignment, fetchLiveQuotaAssignments, patchLiveQuotaAssignment } from "@/lib/live";
import type { LiveQuotaAssignment } from "@/lib/live";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { KpiCard, ProgressBar } from "@/components/ui/kpi-card";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";

function leaderName(leader: { full_name: string } | { full_name: string }[] | null): string {
  if (!leader) return "—";
  if (Array.isArray(leader)) return leader[0]?.full_name ?? "—";
  return leader.full_name;
}

export function TeamView() {
  const { currentTeam, teams, staff, periods, periodCode } = useApp();
  const team = teams.find((t) => t.code === currentTeam) ?? teams[0];
  const period = periods.find((p) => p.code === periodCode);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({ staffId: "", qty: "10", due: "", label: "" });
  const [rows, setRows] = useState<LiveRecruiter[]>([]);
  const [assignments, setAssignments] = useState<LiveQuotaAssignment[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
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

  useEffect(() => {
    if (!period || !team) return;
    let alive = true;
    fetchLiveQuotaAssignments(period.id, team.id)
      .then((data) => {
        if (alive) setAssignments(data);
      })
      .catch(() => {
        if (alive) setAssignments([]);
      });
    return () => {
      alive = false;
    };
  }, [period, team, open]);

  const working = rows.reduce((s, r) => s + r.working, 0);
  const total = rows.reduce((s, r) => s + r.total_workers, 0);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title={team?.name ?? "Nhóm tuyển dụng"}
        sub={team ? `${team.region ?? ""} · Trưởng nhóm: ${leaderName(team.leader)}` : ""}
        actions={<Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => { setEditingId(null); setFormError(""); setForm({ staffId: staff[0] ? String(staff[0].id) : "", qty: "10", due: period?.end_date ?? "", label: "" }); setOpen(true); }}>Giao chỉ tiêu</Button>}
      />
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
            <div className="mt-4">
              <DataTable headers={["Nhân sự", "Chỉ tiêu", "Hạn", "Nhãn", ""]}>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{staff.find((s) => s.id === a.staff_id)?.full_name ?? a.staff_id}</td>
                    <td>{a.target_qty}</td>
                    <td>{a.due_date ?? "—"}</td>
                    <td>{a.label ?? "—"}</td>
                    <td>
                      <span className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={() => { setEditingId(a.id); setForm({ staffId: String(a.staff_id), qty: String(a.target_qty), due: a.due_date ?? "", label: a.label ?? "" }); setFormError(""); setOpen(true); }}>Sửa</Button>
                        <Button variant="destructive" size="xs" onClick={() => void (async () => {
                          if (!window.confirm("Xóa chỉ tiêu này?")) return;
                          try {
                            await deleteLiveQuotaAssignment(a.id);
                            setAssignments((list) => list.filter((x) => x.id !== a.id));
                          } catch (e) {
                            window.alert(e instanceof ApiError ? e.message : "Xóa chỉ tiêu thất bại.");
                          }
                        })()}>Xóa</Button>
                      </span>
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && <EmptyRow colSpan={5} text="Chưa giao chỉ tiêu trong kỳ này" />}
              </DataTable>
            </div>
          </div>
        </div>
      </QueryState>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Sửa chỉ tiêu" : "Giao chỉ tiêu"}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void (async () => {
          if (!period || !team || !form.staffId) return;
          setBusy(true);
          setFormError("");
          try {
            const payload = {
              staff_id: Number(form.staffId),
              target_qty: Number(form.qty) || 0,
              due_date: form.due || null,
              label: form.label.trim() || null,
            };
            if (editingId) await patchLiveQuotaAssignment(editingId, payload);
            else await createLiveQuotaAssignment({ ...payload, period_id: period.id, team_id: team.id });
            setOpen(false);
          } catch (e) {
            setFormError(e instanceof ApiError ? e.message : "Giao chỉ tiêu thất bại.");
          } finally {
            setBusy(false);
          }
        })()}>{busy ? "Đang lưu..." : editingId ? "Lưu" : "Giao"}</Button></>}
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3">
          <Field label="Nhân sự">
            <select className={inputClass} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
          <Field label="Chỉ tiêu"><input className={inputClass} inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></Field>
          <Field label="Hạn"><input type="date" className={inputClass} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
          <Field label="Nhãn"><input className={inputClass} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ví dụ: Lắp ráp tuần 2" /></Field>
        </div>
      </Modal>
    </section>
  );
}
