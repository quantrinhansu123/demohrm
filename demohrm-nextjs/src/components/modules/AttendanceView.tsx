"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { checkInLive, checkOutLive, deleteLiveAttendance, fetchLiveAttendances, fetchLiveWorkers, patchLiveAttendance } from "@/lib/live";
import type { LiveAttendance } from "@/lib/live";
import { initialsOf } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
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

export function AttendanceView() {
  const [rows, setRows] = useState<LiveAttendance[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [options, setOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<LiveAttendance | null>(null);
  const [units, setUnits] = useState("");
  const [status, setStatus] = useState("valid");

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

  const locate = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không có GPS."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Cần quyền vị trí.")), { enableHighAccuracy: true, timeout: 8000 });
  });

  const checkOut = async (id: number) => {
    setError("");
    try {
      const pos = await locate();
      await checkOutLive(id, { check_out_lat: pos.coords.latitude, check_out_lng: pos.coords.longitude });
      await load(date);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Check-out thất bại.");
    }
  };

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
      const pos = await locate();
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
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Chấm công GPS"
        sub="Danh sách lấy từ bảng công. Check-in ghi giờ và tọa độ trên máy chủ."
        actions={
          <>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[13px]" />
            <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void openForm()}>+ Check-in</Button>
          </>
        }
      />
      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <DataTable headers={["Họ tên", "Địa điểm", "Ca", "Giờ vào", "Giờ ra", "GPS", "Công", "Trạng thái", ""]}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <span className="flex items-center gap-2">
                    <Avatar tone="avatar-blue" size="sm">{initialsOf(a.worker?.full_name ?? "?")}</Avatar>
                    <strong>{a.worker?.full_name ?? "—"}</strong>
                  </span>
                </td>
                <td>{a.site?.name ?? "—"}</td>
                <td>{a.shift?.name ?? "—"}</td>
                <td><strong className="text-emerald-600">{clock(a.check_in_at)}</strong></td>
                <td>
                  {a.check_out_at ? clock(a.check_out_at) : (
                    <button type="button" className="text-[12px] font-semibold text-[#0052cc] hover:underline" onClick={() => void checkOut(a.id)}>Ra ca</button>
                  )}
                </td>
                <td><code>{a.check_in_lat ?? "—"}, {a.check_in_lng ?? "—"} ({a.check_in_distance_m ?? "—"}m)</code></td>
                <td>{a.work_units ?? "—"}</td>
                <td><StatusPill tone={tone(a.status)}>{a.status}</StatusPill></td>
                <td>
                  <span className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => { setEditing(a); setUnits(a.work_units == null ? "" : String(a.work_units)); setStatus(a.status); setFormError(""); }}>Sửa</Button>
                    <Button variant="destructive" size="xs" onClick={() => void (async () => {
                      if (!window.confirm("Xóa dòng chấm công này?")) return;
                      try {
                        await deleteLiveAttendance(a.id);
                        await load(date);
                      } catch (e) {
                        window.alert(e instanceof ApiError ? e.message : "Xóa chấm công thất bại.");
                      }
                    })()}>Xóa</Button>
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={9} text="Không có bản ghi chấm công" />}
          </DataTable>
        </div>
      </QueryState>
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
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Sửa chấm công"
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button><Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void (async () => {
          if (!editing) return;
          setBusy(true);
          setFormError("");
          try {
            await patchLiveAttendance(editing.id, { work_units: units === "" ? undefined : Number(units), status });
            setEditing(null);
            await load(date);
          } catch (e) {
            setFormError(e instanceof ApiError ? e.message : "Sửa chấm công thất bại.");
          } finally {
            setBusy(false);
          }
        })()}>{busy ? "Đang lưu..." : "Lưu"}</Button></>}
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Công"><input className={inputClass} inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value)} /></Field>
          <Field label="Trạng thái">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="valid">Hợp lệ</option>
              <option value="late">Đi muộn</option>
              <option value="gps_warning">Cảnh báo GPS</option>
              <option value="invalid">Không hợp lệ</option>
            </select>
          </Field>
        </div>
      </Modal>
    </section>
  );
}
