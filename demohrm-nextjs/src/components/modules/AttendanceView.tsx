"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ApiError } from "@/lib/api";
import {
  checkInLive,
  checkOutLive,
  deleteLiveAttendance,
  fetchLiveAttendances,
  fetchLiveWorkers,
  patchLiveAttendance,
} from "@/lib/live";
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
  return new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  valid: { label: "Hợp lệ", tone: "success" },
  present: { label: "Hợp lệ", tone: "success" },
  late: { label: "Đi muộn", tone: "warning" },
  early_leave: { label: "Về sớm", tone: "warning" },
  out_of_range: { label: "Cảnh báo GPS", tone: "danger" },
  gps_warning: { label: "Cảnh báo GPS", tone: "danger" },
  missing_checkout: { label: "Thiếu ra ca", tone: "warning" },
  rejected: { label: "Không hợp lệ", tone: "danger" },
  invalid: { label: "Không hợp lệ", tone: "danger" },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: "info" as const };
}

export function AttendanceView() {
  const { periodCode, periods } = useApp();
  const currentPeriod = useMemo(
    () => periods.find((p) => p.code === periodCode),
    [periods, periodCode],
  );

  const [rows, setRows] = useState<LiveAttendance[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [workerOptions, setWorkerOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<LiveAttendance | null>(null);
  const [units, setUnits] = useState("");
  const [status, setStatus] = useState("valid");

  // Load available workers for select filter & check-in
  useEffect(() => {
    fetchLiveWorkers({ limit: 200 })
      .then((page) => {
        const opts = page.rows.map((w) => ({ id: w.id, label: `${w.code} - ${w.full_name}` }));
        setWorkerOptions(opts);
      })
      .catch(() => {});
  }, []);

  // Set default date range to current period once period is available
  useEffect(() => {
    if (currentPeriod?.start_date && currentPeriod?.end_date && !fromDate && !toDate) {
      setFromDate(currentPeriod.start_date);
      setToDate(currentPeriod.end_date);
    }
  }, [currentPeriod, fromDate, toDate]);

  const load = useCallback(
    async (from: string, to: string, worker: string, st: string) => {
      setLoading(true);
      try {
        const page = await fetchLiveAttendances({
          from: from || undefined,
          to: to || undefined,
          worker: worker || undefined,
          status: st || undefined,
          limit: 1000,
        });
        setRows(page.rows);
        setError("");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Không tải được chấm công.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(fromDate, toDate, selectedWorkerId, statusFilter);
  }, [fromDate, toDate, selectedWorkerId, statusFilter, load]);

  const locate = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Trình duyệt không có GPS."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Cần quyền vị trí.")), {
        enableHighAccuracy: true,
        timeout: 8000,
      });
    });

  const checkOut = async (id: number) => {
    setError("");
    try {
      const pos = await locate();
      await checkOutLive(id, { check_out_lat: pos.coords.latitude, check_out_lng: pos.coords.longitude });
      await load(fromDate, toDate, selectedWorkerId, statusFilter);
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
      setWorkerOptions(opts);
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
      await load(fromDate, toDate, selectedWorkerId, statusFilter);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Check-in thất bại.");
    } finally {
      setBusy(false);
    }
  };

  // Filter rows by quick search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((r) => {
      const name = r.worker?.full_name?.toLowerCase() ?? "";
      const code = r.worker?.code?.toLowerCase() ?? "";
      const site = r.site?.name?.toLowerCase() ?? "";
      const shift = r.shift?.name?.toLowerCase() ?? "";
      return name.includes(q) || code.includes(q) || site.includes(q) || shift.includes(q);
    });
  }, [rows, searchQuery]);

  // Summary stats
  const totalWorkUnits = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (Number(r.work_units) || 0), 0),
    [filteredRows],
  );
  const validCount = useMemo(
    () => filteredRows.filter((r) => r.status === "valid" || r.status === "present").length,
    [filteredRows],
  );
  const warningCount = useMemo(
    () => filteredRows.filter((r) => r.status !== "valid" && r.status !== "present").length,
    [filteredRows],
  );

  const applyPeriodPreset = () => {
    if (currentPeriod?.start_date && currentPeriod?.end_date) {
      setFromDate(currentPeriod.start_date);
      setToDate(currentPeriod.end_date);
    }
  };

  const applyTodayPreset = () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    setFromDate(today);
    setToDate(today);
  };

  const applyAllPreset = () => {
    setFromDate("");
    setToDate("");
  };

  const openEdit = (a: LiveAttendance) => {
    setEditing(a);
    setUnits(a.work_units == null ? "" : String(a.work_units));
    const initialStatus =
      a.status === "invalid"
        ? "rejected"
        : a.status === "gps_warning"
        ? "out_of_range"
        : a.status === "present"
        ? "valid"
        : a.status;
    setStatus(initialStatus);
    setFormError("");
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Chấm công GPS"
        sub="Danh sách lấy từ bảng công theo chu kỳ hoặc khoảng ngày. Check-in ghi giờ và tọa độ GPS thực tế."
        actions={
          <Button size="sm" className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void openForm()}>
            + Check-in
          </Button>
        }
      />

      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick presets */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-[12px]">
            <button
              type="button"
              onClick={applyPeriodPreset}
              className={`rounded px-2.5 py-1 font-medium transition ${
                currentPeriod?.start_date === fromDate && currentPeriod?.end_date === toDate
                  ? "bg-white font-semibold text-[#0052cc] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chu kỳ {periodCode || "hiện tại"}
            </button>
            <button
              type="button"
              onClick={applyTodayPreset}
              className="rounded px-2.5 py-1 font-medium text-slate-600 hover:text-slate-900"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={applyAllPreset}
              className={`rounded px-2.5 py-1 font-medium transition ${
                !fromDate && !toDate
                  ? "bg-white font-semibold text-[#0052cc] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-1 text-[13px] text-slate-600">
            <span>Từ:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
            <span>Đến:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
          </div>

          {/* Worker filter */}
          <select
            value={selectedWorkerId}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
          >
            <option value="">Tất cả NLĐ</option>
            {workerOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="valid">Hợp lệ</option>
            <option value="late">Đi muộn</option>
            <option value="early_leave">Về sớm</option>
            <option value="out_of_range">Cảnh báo GPS</option>
            <option value="missing_checkout">Thiếu ra ca</option>
            <option value="rejected">Không hợp lệ</option>
          </select>

          {/* Search box */}
          <input
            type="text"
            placeholder="Tìm theo tên, mã, ca..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
          />
        </div>

        {/* Summary banner */}
        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[12px] text-slate-500">
          <span>
            Tổng bản ghi: <strong className="text-slate-900">{filteredRows.length}</strong>
          </span>
          <span>
            Tổng ngày công: <strong className="text-emerald-700">{totalWorkUnits.toFixed(1)} công</strong>
          </span>
          <span>
            Hợp lệ: <strong className="text-emerald-600">{validCount}</strong>
          </span>
          {warningCount > 0 && (
            <span>
              Cần chú ý / Không hợp lệ: <strong className="text-rose-600">{warningCount}</strong>
            </span>
          )}
        </div>
      </div>

      <QueryState loading={loading} error={error}>
        <div className="page-body">
          <DataTable
            headers={[
              "Ngày",
              "Họ tên & Mã",
              "Địa điểm",
              "Ca",
              "Giờ vào",
              "Giờ ra",
              "GPS",
              "Công",
              "Trạng thái",
              "Thao tác",
            ]}
          >
            {filteredRows.map((a) => {
              const meta = getStatusMeta(a.status);
              return (
                <tr key={a.id}>
                  <td>
                    <strong className="text-slate-800">{formatDateDisplay(a.work_date)}</strong>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <Avatar tone="avatar-blue" size="sm">
                        {initialsOf(a.worker?.full_name ?? "?")}
                      </Avatar>
                      <div>
                        <strong className="block text-slate-900">{a.worker?.full_name ?? "—"}</strong>
                        <span className="font-mono text-[11px] text-slate-500">{a.worker?.code}</span>
                      </div>
                    </span>
                  </td>
                  <td>{a.site?.name ?? "—"}</td>
                  <td>{a.shift?.name ?? "—"}</td>
                  <td>
                    <strong className="text-emerald-600">{clock(a.check_in_at)}</strong>
                  </td>
                  <td>
                    {a.check_out_at ? (
                      clock(a.check_out_at)
                    ) : (
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-[#0052cc] hover:underline"
                        onClick={() => void checkOut(a.id)}
                      >
                        Ra ca
                      </button>
                    )}
                  </td>
                  <td>
                    <code className="text-[11.5px]">
                      {a.check_in_lat ?? "—"}, {a.check_in_lng ?? "—"}{" "}
                      {a.check_in_distance_m != null ? `(${a.check_in_distance_m}m)` : ""}
                    </code>
                  </td>
                  <td>
                    <strong className="text-slate-800">{a.work_units ?? "—"}</strong>
                  </td>
                  <td>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </td>
                  <td>
                    <span className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => openEdit(a)}>
                        Sửa
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() =>
                          void (async () => {
                            if (!window.confirm("Xóa dòng chấm công này?")) return;
                            try {
                              await deleteLiveAttendance(a.id);
                              await load(fromDate, toDate, selectedWorkerId, statusFilter);
                            } catch (e) {
                              window.alert(e instanceof ApiError ? e.message : "Xóa chấm công thất bại.");
                            }
                          })()
                        }
                      >
                        Xóa
                      </Button>
                    </span>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && <EmptyRow colSpan={10} text="Không có bản ghi chấm công phù hợp" />}
          </DataTable>
        </div>
      </QueryState>

      {/* Modal Check-in */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Check-in GPS"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button className="bg-[#0052cc] text-white hover:bg-[#0747a6]" onClick={() => void submit()}>
              {busy ? "Đang ghi..." : "Ghi nhận"}
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <Field label="Người lao động đang làm">
          <select className={inputClass} value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workerOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
      </Modal>

      {/* Modal Sửa chấm công */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Sửa chấm công"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button
              className="bg-[#0052cc] text-white hover:bg-[#0747a6]"
              onClick={() =>
                void (async () => {
                  if (!editing) return;
                  setBusy(true);
                  setFormError("");
                  try {
                    await patchLiveAttendance(editing.id, {
                      work_units: units === "" ? undefined : Number(units),
                      status,
                    });
                    setEditing(null);
                    await load(fromDate, toDate, selectedWorkerId, statusFilter);
                  } catch (e) {
                    setFormError(e instanceof ApiError ? e.message : "Sửa chấm công thất bại.");
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              {busy ? "Đang lưu..." : "Lưu"}
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Công">
            <input
              className={inputClass}
              inputMode="decimal"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              placeholder="VD: 1.0"
            />
          </Field>
          <Field label="Trạng thái">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="valid">Hợp lệ</option>
              <option value="late">Đi muộn</option>
              <option value="early_leave">Về sớm</option>
              <option value="out_of_range">Cảnh báo GPS (Ngoài phạm vi)</option>
              <option value="missing_checkout">Thiếu ra ca</option>
              <option value="rejected">Không hợp lệ</option>
            </select>
          </Field>
        </div>
      </Modal>
    </section>
  );
}
