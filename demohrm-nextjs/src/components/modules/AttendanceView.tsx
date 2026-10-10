"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { ApiError } from "@/lib/api";
import { checkInLive, fetchLiveAttendances, fetchLiveWorkers } from "@/lib/live";
import type { LiveAttendance } from "@/lib/live";
import { initialsOf } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Modal, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";

function clock(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function tone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "valid" || status === "present") return "success";
  if (status === "late") return "warning";
  if (status === "gps_warning" || status === "invalid") return "danger";
  return "info";
}

function statusLabel(status: string): string {
  if (status === "valid" || status === "present") return "Hợp lệ";
  if (status === "late") return "Đi muộn";
  if (status === "gps_warning") return "Cảnh báo GPS";
  if (status === "invalid") return "Không hợp lệ";
  return status;
}

export function AttendanceView({ embedded = false }: { embedded?: boolean }) {
  const [rows, setRows] = useState<LiveAttendance[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [options, setOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const page = await fetchLiveAttendances(day || undefined);
      setRows(page.rows);
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được chấm công.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const openForm = async () => {
    setOpen(true);
    setFormError("");
    try {
      const page = await fetchLiveWorkers({ statusEn: "working", limit: 100 });
      const opts = page.rows.map((w) => ({ id: w.id, label: `${w.code} - ${w.full_name}` }));
      setOptions(opts);
      setWorkerId(opts[0] ? String(opts[0].id) : "");
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được danh sách NLĐ.");
    }
  };

  const submit = async () => {
    if (!workerId) return;
    setBusy(true);
    setFormError("");
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Trình duyệt không có GPS."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Cần quyền vị trí để check-in.")), { enableHighAccuracy: true, timeout: 8000 });
      });
      await checkInLive({
        worker_id: Number(workerId),
        check_in_lat: pos.coords.latitude,
        check_in_lng: pos.coords.longitude,
      });
      setOpen(false);
      await load(date);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Check-in thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={embedded ? "flex min-h-0 flex-1 flex-col bg-[#f4f6fa]" : "flex h-full flex-col bg-[#f4f6fa]"}>
      <header className="border-b bg-white px-4 py-3 md:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold text-slate-900 md:text-[20px]">{embedded ? "Chấm công" : "Chấm công GPS"}</h1>
            <p className="mt-0.5 text-[12px] text-slate-500">Check-in bằng vị trí điện thoại</p>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[13px]" />
        </div>
      </header>
      <QueryState loading={loading} error={error}>
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:px-6">
          {rows.length === 0 && <p className="py-10 text-center text-[13px] text-slate-400">Không có bản ghi chấm công</p>}
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            {rows.map((a) => (
              <article key={a.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar tone="avatar-blue" size="sm">{initialsOf(a.worker?.full_name ?? "?")}</Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold text-slate-900">{a.worker?.full_name ?? "—"}</div>
                    <div className="truncate text-[12px] text-slate-500">{a.worker?.code} · {a.site?.name ?? "Chưa có địa điểm"}</div>
                  </div>
                  <StatusPill tone={tone(a.status)}>{statusLabel(a.status)}</StatusPill>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 px-2 py-2">
                    <div className="text-[11px] text-emerald-700">Vào</div>
                    <div className="text-[15px] font-bold text-emerald-800">{clock(a.check_in_at)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-2 py-2">
                    <div className="text-[11px] text-slate-500">Ra</div>
                    <div className="text-[15px] font-bold text-slate-800">{clock(a.check_out_at)}</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-2 py-2">
                    <div className="text-[11px] text-slate-500">Công</div>
                    <div className="text-[15px] font-bold text-slate-800">{a.work_units ?? "—"}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[12px] text-slate-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{a.shift?.name ?? "Ca"} · {a.check_in_distance_m ?? "—"}m</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </QueryState>
      <div className="sticky bottom-0 border-t bg-white/95 px-4 py-3 backdrop-blur">
        <Button className="h-12 w-full rounded-2xl bg-[#0052cc] text-[16px] text-white hover:bg-[#0747a6]" onClick={() => void openForm()}>
          Check-in GPS
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Check-in"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void submit()}>{busy ? "Đang ghi..." : "Ghi nhận"}</Button>
          </>
        }
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <Field label="Người lao động đang làm">
          <select className={inputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {options.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
        </Field>
      </Modal>
    </section>
  );
}
