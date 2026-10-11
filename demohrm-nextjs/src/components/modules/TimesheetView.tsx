"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ApiError } from "@/lib/api";
import { useApp } from "@/lib/store";
import { fetchLiveAttendancesRange } from "@/lib/live";
import type { LiveAttendance } from "@/lib/live";
import { initialsOf } from "@/lib/format";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { QueryState } from "@/components/ui/query-state";
import { cn } from "@/lib/utils";

type CellTone = "ok" | "late" | "bad" | "open";

interface DayCell {
  units: number;
  tone: CellTone;
  records: LiveAttendance[];
}

interface SheetRow {
  key: string;
  code: string;
  name: string;
  sites: string[];
  days: Map<string, DayCell>;
  total: number;
  late: number;
  open: number;
}

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const TONE_RANK: Record<CellTone, number> = { ok: 1, open: 2, late: 3, bad: 4 };
const CELL_CLASS: Record<CellTone, string> = {
  ok: "bg-emerald-50 text-emerald-800",
  late: "bg-amber-50 text-amber-800",
  bad: "bg-rose-50 text-rose-700",
  open: "bg-slate-100 text-slate-500",
};

function currentMonthVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()).slice(0, 7);
}

function todayVN(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const next = new Date(y, (m - 1) + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(ym: string): { from: string; to: string; days: string[] } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const days = Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
  return { from: days[0] ?? `${ym}-01`, to: days[days.length - 1] ?? `${ym}-01`, days };
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAY[new Date(y, m - 1, d).getDay()] ?? "";
}

function isWeekend(iso: string): boolean {
  const label = weekdayLabel(iso);
  return label === "CN" || label === "T7";
}

function clock(iso: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
}

function showDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function related<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unitsOf(row: LiveAttendance): number {
  if (row.work_units !== null && row.work_units !== "") {
    const n = Number(row.work_units);
    if (Number.isFinite(n)) return n;
  }
  return row.check_in_at && row.check_out_at ? 1 : 0;
}

function toneOf(row: LiveAttendance): CellTone {
  if (row.status === "invalid" || row.status === "gps_warning") return "bad";
  if (row.status === "late") return "late";
  if (!row.check_out_at) return "open";
  return "ok";
}

function formatUnits(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (rounded <= 0) return "";
  return rounded.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function statusLabel(status: string): string {
  if (status === "valid" || status === "present") return "Hợp lệ";
  if (status === "late") return "Đi muộn";
  if (status === "gps_warning") return "Cảnh báo GPS";
  if (status === "invalid") return "Không hợp lệ";
  if (status === "open") return "Đang làm";
  return status;
}

function pillTone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "valid" || status === "present") return "success";
  if (status === "late") return "warning";
  if (status === "gps_warning" || status === "invalid") return "danger";
  return "info";
}

function personOf(row: LiveAttendance): { code: string; full_name: string } | null {
  return related(row.worker as { code: string; full_name: string } | { code: string; full_name: string }[] | null);
}

function siteName(row: LiveAttendance): string {
  return related(row.site as { name: string } | { name: string }[] | null)?.name ?? "";
}

function shiftName(row: LiveAttendance): string {
  return related(row.shift as { name: string } | { name: string }[] | null)?.name ?? "";
}

export function TimesheetView() {
  const { periodCode, periods } = useApp();
  const period = periods.find((item) => item.code === periodCode);
  const periodMonth = period?.start_date?.slice(0, 7) ?? "";
  const [month, setMonth] = useState("");
  const [query, setQuery] = useState("");
  const [site, setSite] = useState("");
  const [rows, setRows] = useState<LiveAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ key: string; day: string } | null>(null);
  const activeMonth = month || periodMonth || currentMonthVN();
  const [prevMonth, setPrevMonth] = useState(activeMonth);
  if (prevMonth !== activeMonth) {
    setPrevMonth(activeMonth);
    setLoading(true);
    setError("");
    setSelected(null);
  }

  const bounds = useMemo(() => monthBounds(activeMonth), [activeMonth]);
  const today = todayVN();

  useEffect(() => {
    let alive = true;
    fetchLiveAttendancesRange(bounds.from, bounds.to)
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError("");
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "Không tải được bảng công.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bounds.from, bounds.to]);

  const sites = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) {
      const name = siteName(row);
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const activeSite = sites.includes(site) ? site : "";

  const sheet = useMemo(() => {
    const q = query.trim().toLowerCase();
    const grouped = new Map<string, SheetRow>();
    for (const row of rows) {
      if (activeSite && siteName(row) !== activeSite) continue;
      const person = personOf(row);
      const name = person?.full_name ?? "Không rõ";
      const code = person?.code ?? "";
      if (q && !`${name} ${code}`.toLowerCase().includes(q)) continue;
      const key = row.worker_id ? `w-${row.worker_id}` : code ? `c-${code}` : `n-${name}`;
      const day = row.work_date.slice(0, 10);
      let line = grouped.get(key);
      if (!line) {
        line = { key, code, name, sites: [], days: new Map(), total: 0, late: 0, open: 0 };
        grouped.set(key, line);
      }
      const place = siteName(row);
      if (place && !line.sites.includes(place)) line.sites.push(place);
      const units = unitsOf(row);
      const tone = toneOf(row);
      const cell = line.days.get(day) ?? { units: 0, tone, records: [] };
      cell.units += units;
      cell.tone = cell.records.length === 0 ? tone : (TONE_RANK[tone] > TONE_RANK[cell.tone] ? tone : cell.tone);
      cell.records.push(row);
      line.days.set(day, cell);
      line.total += units;
      if (tone === "late") line.late += 1;
      if (tone === "open") line.open += 1;
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [activeSite, query, rows]);

  const picked = useMemo(() => {
    if (!selected) return null;
    const line = sheet.find((row) => row.key === selected.key);
    const cell = line?.days.get(selected.day);
    if (!line || !cell) return null;
    return { line, day: selected.day, cell };
  }, [selected, sheet]);

  const totalUnits = sheet.reduce((sum, row) => sum + row.total, 0);
  const lateCount = sheet.reduce((sum, row) => sum + row.late, 0);
  const openCount = sheet.reduce((sum, row) => sum + row.open, 0);

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Bảng công"
        sub={`${monthLabel(activeMonth)} · công lấy từ chấm công${period ? ` · kỳ ${period.name}` : ""}`}
        actions={
          <>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Tháng trước" onClick={() => setMonth(shiftMonth(activeMonth, -1))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input type="month" value={activeMonth} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[13px]" />
              <button type="button" aria-label="Tháng sau" onClick={() => setMonth(shiftMonth(activeMonth, 1))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {sites.length > 1 && (
              <select value={activeSite} onChange={(e) => setSite(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[13px]">
                <option value="">Mọi địa điểm</option>
                {sites.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên, mã..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
          </>
        }
      />
      <QueryState loading={loading} error={error}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="grid gap-3 px-6 pt-4 md:grid-cols-4">
            <KpiCard title="NGƯỜI CÓ CHẤM CÔNG" value={sheet.length} sub={activeSite || "Mọi địa điểm"} />
            <KpiCard title="TỔNG CÔNG" value={formatUnits(totalUnits) || "0"} valueClassName="text-emerald-600" sub="Theo work_units, ca đủ giờ tính 1" />
            <KpiCard title="ĐI MUỘN" value={lateCount} valueClassName="text-amber-600" sub="Số lượt trong tháng" />
            <KpiCard title="CHƯA CHECK-OUT" value={openCount} sub="Đã vào, chưa ra" />
          </div>
          <div className="flex flex-wrap items-center gap-3 px-6 pb-1 pt-3 text-[12px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Hợp lệ</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-100 ring-1 ring-amber-200" /> Đi muộn</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-200" /> GPS / không hợp lệ</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200" /> … chưa check-out</span>
          </div>
          {picked && (
            <div className="mx-6 mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <div className="text-[14px] font-bold text-slate-900">{picked.line.name}</div>
                  <div className="text-[12px] text-slate-500">{picked.line.code || "—"} · {showDay(picked.day)} · {weekdayLabel(picked.day)}</div>
                </div>
                <div className="text-[13px] font-semibold text-emerald-700">Công {formatUnits(picked.cell.units) || "0"}</div>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {picked.cell.records.map((record) => (
                  <div key={record.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-600">
                    <span className="font-semibold tabular-nums text-slate-800">{clock(record.check_in_at)} – {clock(record.check_out_at)}</span>
                    <span>{shiftName(record) || "Ca"}</span>
                    <span>{siteName(record) || "Chưa có địa điểm"}</span>
                    <span>{record.check_in_distance_m ?? "—"}m</span>
                    <StatusPill tone={pillTone(record.status)}>{statusLabel(record.status)}</StatusPill>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
            <div className="data-table-card">
              <table className="w-max min-w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b bg-[#f8fafc] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nhân sự</th>
                    {bounds.days.map((day) => (
                      <th
                        key={day}
                        className={cn(
                          "sticky top-0 z-20 w-10 border-b px-0 py-2 text-center text-[11px] font-semibold",
                          day === today ? "bg-sky-50 text-[#0052cc]" : isWeekend(day) ? "bg-slate-50 text-slate-400" : "bg-[#f8fafc] text-slate-500"
                        )}
                      >
                        <div>{weekdayLabel(day)}</div>
                        <div className="text-[12px]">{Number(day.slice(8, 10))}</div>
                      </th>
                    ))}
                    <th className="sticky right-0 top-0 z-30 min-w-[72px] border-b bg-[#f8fafc] px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.18)]">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.map((line) => (
                    <tr key={line.key} className="hover:bg-slate-50/80">
                      <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar tone="avatar-blue" size="sm">{initialsOf(line.name)}</Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">{line.name}</div>
                            <div className="truncate text-[11.5px] text-slate-500">{line.code || "—"}{line.sites.length > 0 ? ` · ${line.sites.join(", ")}` : ""}</div>
                          </div>
                        </div>
                      </td>
                      {bounds.days.map((day) => {
                        const cell = line.days.get(day);
                        const label = cell ? formatUnits(cell.units) || (cell.tone === "open" ? "…" : "") : "";
                        const active = picked?.line.key === line.key && picked.day === day;
                        return (
                          <td key={day} className={cn("border-b border-slate-100 p-0.5 text-center", isWeekend(day) && !cell && "bg-slate-50/70", day === today && !cell && "bg-sky-50/40")}>
                            {cell ? (
                              <button
                                type="button"
                                title={`${clock(cell.records[0]?.check_in_at ?? null)} – ${clock(cell.records[0]?.check_out_at ?? null)}`}
                                onClick={() => setSelected({ key: line.key, day })}
                                className={cn(
                                  "grid h-8 w-full place-items-center rounded-md text-[12px] font-semibold tabular-nums",
                                  CELL_CLASS[cell.tone],
                                  active && "ring-2 ring-[#0052cc]"
                                )}
                              >
                                {label || "·"}
                              </button>
                            ) : null}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-2 py-2 text-right font-bold tabular-nums text-slate-900 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]" title={`Đi muộn ${line.late} · chưa ra ${line.open}`}>
                        {formatUnits(line.total) || "0"}
                      </td>
                    </tr>
                  ))}
                  {sheet.length > 0 && (
                    <tr>
                      <td className="sticky left-0 z-10 border-t bg-slate-50 px-3 py-2 font-semibold text-slate-700">Tổng ngày</td>
                      {bounds.days.map((day) => {
                        const sum = sheet.reduce((total, line) => total + (line.days.get(day)?.units ?? 0), 0);
                        return <td key={day} className="border-t bg-slate-50 px-0 py-2 text-center text-[11.5px] font-semibold tabular-nums text-slate-600">{formatUnits(sum)}</td>;
                      })}
                      <td className="sticky right-0 z-10 border-t bg-slate-50 px-2 py-2 text-right font-bold tabular-nums text-emerald-700 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]">{formatUnits(totalUnits) || "0"}</td>
                    </tr>
                  )}
                  {sheet.length === 0 && (
                    <tr>
                      <td colSpan={bounds.days.length + 2} className="px-3 py-10 text-center text-slate-400">Chưa có chấm công trong {monthLabel(activeMonth).toLowerCase()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </QueryState>
    </section>
  );
}
