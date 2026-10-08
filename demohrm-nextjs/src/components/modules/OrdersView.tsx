"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import {
  createLiveOrder,
  deleteLiveOrder,
  patchLiveOrder,
  createLiveWageRate,
  fetchLiveDailyReport,
  fetchLiveDailyReportWorkers,
  fetchLiveOrders,
  fetchLiveOrderWorkers,
  fetchLivePositions,
  fetchLiveSites,
  fetchLiveShifts,
  fetchPositionOptions,
  toOrderSummary,
} from "@/lib/live";
import type {
  LiveDailyReport,
  LiveDailyWorker,
  LiveOrderRow,
  LiveOrderWorker,
  LivePositionOption,
  LiveSite,
  LiveShift,
} from "@/lib/live";
import type { OrderSummary as OrderCard, Worker } from "@/types/hrm";
import { ModuleHeader } from "@/components/modules/ModuleHeader";
import { StatusPill, statusToneForHealth } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { Field, Modal, getInputClass, inputClass } from "@/components/ui/modal";
import { QueryState } from "@/components/ui/query-state";
import { DataTable, EmptyRow } from "@/components/ui/data-table";
import { ApiError } from "@/lib/api";
import { formatVND } from "@/lib/format";
import { CreateOrderSchema, formatZodErrors } from "@/lib/validation";

const legendTone: Record<string, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-400",
  orange: "bg-amber-500",
  grey: "bg-slate-300",
};

const STAGE_LABELS: Record<string, string> = {
  working: "Đã đi làm",
  waiting_start: "Chờ nhận việc",
  interview: "Hẹn PV",
  applied: "Mới ứng tuyển",
  left: "Đã nghỉ việc",
};

const WAGE_UNIT_LABELS: Record<string, string> = {
  day: "Theo ngày (ngày)",
  hour: "Theo giờ (giờ)",
  month: "Theo tháng (tháng)",
  shift: "Theo ca (ca)",
  product: "Theo sản phẩm (sản phẩm)",
};

const primaryBtn = "bg-[#0052cc] text-white hover:bg-[#0747a6]";

function num(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function OrdersView({ onViewDetail }: { onViewDetail?: (w: Worker) => void }) {
  const { periodCode, periods, companies, staff, teams } = useApp();
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [sources, setSources] = useState<LiveOrderRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [wageOpen, setWageOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [sites, setSites] = useState<LiveSite[]>([]);
  const [shifts, setShifts] = useState<LiveShift[]>([]);
  const [positions, setPositions] = useState<LivePositionOption[]>([]);
  
  // Chi tiết đơn hàng & đối chiếu NLĐ
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderCard | null>(null);
  const [orderWorkers, setOrderWorkers] = useState<LiveOrderWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [workersError, setWorkersError] = useState("");
  const [workerStageFilter, setWorkerStageFilter] = useState<string>("all");
  const [workerSearch, setWorkerSearch] = useState<string>("");
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Bộ lọc ngày & Báo cáo ngày theo đơn
  const [filterDate, setFilterDate] = useState<string>("");
  const [dailyReports, setDailyReports] = useState<LiveDailyReport[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [selectedDailyOrder, setSelectedDailyOrder] = useState<{
    order: OrderCard;
    report: LiveDailyReport | null;
  } | null>(null);
  const [dailyWorkers, setDailyWorkers] = useState<LiveDailyWorker[]>([]);
  const [loadingDailyWorkers, setLoadingDailyWorkers] = useState(false);
  const [dailyWorkersError, setDailyWorkersError] = useState("");

  const period = periods.find((p) => p.code === periodCode);
  const [form, setForm] = useState({
    code: "",
    name: "",
    companyId: "",
    siteId: "",
    ownerId: "",
    teamId: "",
    start: "",
    end: "",
    target: "10",
    position: "",
    positionQty: "10",
    jobDesc: "",
    shiftDesc: "Ca hành chính",
    dayRate: "260000",
    status: "running",
  });

  // Modal đơn giá vị trí
  const [wage, setWage] = useState({
    positionId: "",
    from: "",
    to: "",
    unit: "day",
    rate: "",
    dayRate: "",
    jobDesc: "",
    shiftId: "",
    note: "",
  });
  const [wageErrors, setWageErrors] = useState<Record<string, string>>({});
  const [orderErrors, setOrderErrors] = useState<Record<string, string>>({});
  const periodName = periods.find((p) => p.code === periodCode)?.name ?? periodCode;
  const [prevPeriod, setPrevPeriod] = useState(periodCode);
  if (prevPeriod !== periodCode) {
    setPrevPeriod(periodCode);
    setLoading(true);
    setError("");
  }

  const load = useCallback(async () => {
    if (!periodCode) return;
    setLoading(true);
    try {
      const [rows, positionRows] = await Promise.all([fetchLiveOrders(periodCode), fetchLivePositions()]);
      setSources(rows);
      setOrders(rows.map((r) => toOrderSummary(r, positionRows)));
      setError("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Không tải được đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [periodCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDailyReport = useCallback(async (date: string) => {
    if (!date) {
      setDailyReports([]);
      return;
    }
    setLoadingDaily(true);
    try {
      const data = await fetchLiveDailyReport(date);
      setDailyReports(data);
    } catch {
      setDailyReports([]);
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  useEffect(() => {
    if (filterDate) {
      void loadDailyReport(filterDate);
    } else {
      setDailyReports([]);
    }
  }, [filterDate, loadDailyReport]);

  const openDailyWorkers = async (order: OrderCard, report: LiveDailyReport | null) => {
    if (!filterDate) return;
    setSelectedDailyOrder({ order, report });
    setLoadingDailyWorkers(true);
    setDailyWorkersError("");
    try {
      const data = await fetchLiveDailyReportWorkers(filterDate, order.id);
      setDailyWorkers(data);
    } catch (e) {
      setDailyWorkersError(e instanceof ApiError ? e.message : "Không tải được danh sách NLĐ theo ngày.");
      setDailyWorkers([]);
    } finally {
      setLoadingDailyWorkers(false);
    }
  };

  const openCreate = async () => {
    setEditingId(null);
    setFormError("");
    setOrderErrors({});
    setForm({
      code: "",
      name: "",
      companyId: companies[0] ? String(companies[0].id) : "",
      siteId: "",
      ownerId: staff[0] ? String(staff[0].id) : "",
      teamId: teams[0] ? String(teams[0].id) : "",
      start: period?.start_date ?? "",
      end: period?.end_date ?? "",
      target: "10",
      position: "",
      positionQty: "10",
      jobDesc: "",
      shiftDesc: "Ca hành chính",
      dayRate: "260000",
      status: "running",
    });
    setOpen(true);
    try {
      const all = await fetchLiveSites();
      setSites(all);
      const companyId = companies[0]?.id;
      const first = all.find((s) => s.company_id === companyId);
      if (first) setForm((f) => ({ ...f, siteId: String(first.id) }));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được địa điểm.");
    }
  };

  const openEdit = (id: number) => {
    const row = sources.find((r) => r.order_id === id);
    if (!row) return;
    const company = companies.find((c) => c.short_name === row.company);
    setFormError("");
    setOrderErrors({});
    setEditingId(id);
    setForm({
      code: row.code,
      name: row.name,
      companyId: company ? String(company.id) : "",
      siteId: "",
      ownerId: "",
      teamId: "",
      start: row.start_date,
      end: row.end_date,
      target: String(row.target_qty),
      position: "",
      positionQty: "10",
      jobDesc: "",
      shiftDesc: "Ca hành chính",
      dayRate: "260000",
      status: row.status || "running",
    });
    setOpen(true);
  };

  const saveOrder = async () => {
    if (!period) {
      setFormError("Chưa chọn kỳ.");
      return;
    }
    setFormError("");
    const parsed = CreateOrderSchema.safeParse(form);
    if (!parsed.success) {
      setOrderErrors(formatZodErrors(parsed.error));
      return;
    }
    setOrderErrors({});

    setBusy(true);
    setFormError("");
    try {
      if (editingId) {
        await patchLiveOrder(editingId, {
          code: form.code.trim(),
          name: form.name.trim(),
          company_id: Number(form.companyId),
          start_date: form.start,
          end_date: form.end,
          target_qty: Number(form.target) || 0,
          status: form.status,
        });
        setOpen(false);
        setEditingId(null);
        await load();
        return;
      }
      await createLiveOrder({
        code: form.code.trim(),
        name: form.name.trim(),
        company_id: Number(form.companyId),
        work_site_id: form.siteId ? Number(form.siteId) : null,
        period_id: period.id,
        owner_staff_id: form.ownerId ? Number(form.ownerId) : null,
        team_id: form.teamId ? Number(form.teamId) : null,
        start_date: form.start,
        end_date: form.end,
        target_qty: Number(form.target) || 0,
        status: "running",
        positions: [
          {
            title: form.position.trim(),
            target_qty: Number(form.positionQty) || 0,
            job_description: form.jobDesc.trim() || null,
            day_rate: form.dayRate ? Number(form.dayRate) : null,
          },
        ],
      });
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Tạo đơn thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const openWage = async (targetPositionId?: number) => {
    setFormError("");
    setWageErrors({});
    setWageOpen(true);
    try {
      const [posRows, shiftRows] = await Promise.all([
        fetchPositionOptions(),
        fetchLiveShifts(),
      ]);
      setPositions(posRows);
      setShifts(shiftRows);

      const chosen = targetPositionId
        ? posRows.find((p) => p.id === targetPositionId)
        : posRows[0];

      if (chosen) {
        setWage({
          positionId: String(chosen.id),
          from: chosen.effective_from || period?.start_date || "",
          to: chosen.effective_to || "",
          unit: chosen.wage_unit || "day",
          rate: chosen.current_rate_amount ? String(chosen.current_rate_amount) : "",
          dayRate: chosen.current_day_rate ? String(chosen.current_day_rate) : "",
          jobDesc: chosen.job_description || "",
          shiftId: chosen.shift_id ? String(chosen.shift_id) : "",
          note: "",
        });
      } else {
        setWage({
          positionId: "",
          from: period?.start_date ?? "",
          to: "",
          unit: "day",
          rate: "",
          dayRate: "",
          jobDesc: "",
          shiftId: "",
          note: "",
        });
      }
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Không tải được danh mục vị trí.");
    }
  };

  const handlePositionChange = (posIdStr: string) => {
    const chosen = positions.find((p) => String(p.id) === posIdStr);
    if (!chosen) {
      setWage((prev) => ({ ...prev, positionId: posIdStr }));
      return;
    }
    setWage((prev) => ({
      ...prev,
      positionId: posIdStr,
      from: chosen.effective_from || period?.start_date || prev.from,
      to: chosen.effective_to || "",
      unit: chosen.wage_unit || prev.unit || "day",
      rate: chosen.current_rate_amount ? String(chosen.current_rate_amount) : prev.rate,
      dayRate: chosen.current_day_rate ? String(chosen.current_day_rate) : prev.dayRate,
      jobDesc: chosen.job_description ?? prev.jobDesc,
      shiftId: chosen.shift_id ? String(chosen.shift_id) : prev.shiftId,
    }));
  };

  const handleRateChange = (rateVal: string, unitVal?: string) => {
    const currentUnit = unitVal ?? wage.unit;
    const n = Number(rateVal);
    let autoDayRate = wage.dayRate;
    if (Number.isFinite(n) && n > 0) {
      if (currentUnit === "day" || currentUnit === "shift") {
        autoDayRate = String(n);
      } else if (currentUnit === "hour") {
        autoDayRate = String(n * 8);
      } else if (currentUnit === "month") {
        autoDayRate = String(Math.round(n / 26));
      }
    }
    setWage((prev) => ({
      ...prev,
      rate: rateVal,
      dayRate: autoDayRate,
      unit: currentUnit,
    }));
  };

  const saveWage = async () => {
    setWageErrors({});
    setFormError("");

    const errors: Record<string, string> = {};
    if (!wage.positionId) errors.positionId = "Vui lòng chọn vị trí.";
    if (!wage.from) errors.from = "Vui lòng chọn ngày bắt đầu hiệu lực.";
    
    const numRate = Number(wage.rate);
    const numDayRate = Number(wage.dayRate);
    if ((!Number.isFinite(numRate) || numRate <= 0) && (!Number.isFinite(numDayRate) || numDayRate <= 0)) {
      errors.rate = "Đơn giá hoặc lương ngày phải lớn hơn 0.";
    }

    if (wage.to && wage.from && wage.to < wage.from) {
      errors.to = "Ngày kết thúc không được trước ngày bắt đầu.";
    }

    if (Object.keys(errors).length > 0) {
      setWageErrors(errors);
      return;
    }

    setBusy(true);
    try {
      await createLiveWageRate(Number(wage.positionId), {
        effective_from: wage.from,
        effective_to: wage.to || null,
        wage_unit: wage.unit,
        rate_amount: Number(wage.rate) > 0 ? Number(wage.rate) : Number(wage.dayRate),
        day_rate: Number(wage.dayRate) > 0 ? Number(wage.dayRate) : Number(wage.rate),
        job_description: wage.jobDesc.trim() || null,
        shift_id: wage.shiftId ? Number(wage.shiftId) : null,
        note: wage.note.trim() || null,
      });
      setWageOpen(false);
      await load();
      // Nếu đang mở xem chi tiết đơn hàng, cập nhật lại đơn hàng hiện tại
      if (selectedOrderDetail) {
        const updatedOrders = await fetchLiveOrders(periodCode);
        const positionRows = await fetchLivePositions();
        const found = updatedOrders.find((o) => o.order_id === selectedOrderDetail.id);
        if (found) {
          setSelectedOrderDetail(toOrderSummary(found, positionRows));
        }
      }
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Thêm đơn giá thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const removeOrder = async (order: OrderCard) => {
    if (!window.confirm(`Xóa đơn ${order.title} (${order.code})?`)) return;
    setError("");
    try {
      await deleteLiveOrder(order.id);
      await load();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Xóa đơn thất bại.");
    }
  };

  // Mở Xem chi tiết đơn hàng và tải danh sách NLĐ đối chiếu
  const openOrderDetail = async (order: OrderCard) => {
    setSelectedOrderDetail(order);
    setWorkerStageFilter("all");
    setWorkerSearch("");
    setLoadingWorkers(true);
    setWorkersError("");
    try {
      const data = await fetchLiveOrderWorkers(order.id);
      setOrderWorkers(data);
    } catch (e) {
      setWorkersError(e instanceof ApiError ? e.message : "Không tải được danh sách công nhân.");
      setOrderWorkers([]);
    } finally {
      setLoadingWorkers(false);
    }
  };

  const companySites = sites.filter((s) => String(s.company_id) === form.companyId);

  const visible = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.title.toLowerCase().includes(query.toLowerCase().trim()) ||
          o.code.toLowerCase().includes(query.toLowerCase().trim()) ||
          (o.companyName && o.companyName.toLowerCase().includes(query.toLowerCase().trim())),
      ),
    [query, orders],
  );

  // Đếm số lượng NLĐ theo từng trạng thái trong đơn đang mở
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      working: 0,
      waiting_start: 0,
      interview: 0,
      applied: 0,
      left: 0,
    };
    for (const w of orderWorkers) {
      if (w.stage in counts) counts[w.stage]++;
      else counts[w.stage] = 1;
    }
    return counts;
  }, [orderWorkers]);

  // Danh sách công nhân đã lọc trong đơn đang mở
  const filteredWorkers = useMemo(() => {
    return orderWorkers.filter((w) => {
      const matchStage = workerStageFilter === "all" || w.stage === workerStageFilter;
      const q = workerSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        w.full_name.toLowerCase().includes(q) ||
        w.worker_code.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        w.position.toLowerCase().includes(q) ||
        (w.supervisor_name && w.supervisor_name.toLowerCase().includes(q));
      return matchStage && matchSearch;
    });
  }, [orderWorkers, workerStageFilter, workerSearch]);

  const copyPhoneToClipboard = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  return (
    <section className="flex h-full flex-col">
      <ModuleHeader
        title="Đơn hàng cung ứng"
        sub={periodName}
        actions={
          <>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 shadow-2xs">
              <span className="text-[12px] font-semibold text-slate-600 whitespace-nowrap">📅 Ngày:</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="text-[12.5px] font-medium text-slate-800 outline-none bg-transparent cursor-pointer"
                title="Chọn ngày để xem số liệu chấm công & danh sách NLĐ tương ứng"
              />
              {filterDate ? (
                <button
                  type="button"
                  onClick={() => setFilterDate("")}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                  title="Xem toàn chu kỳ"
                >
                  ✕ Toàn kỳ
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
                    setFilterDate(todayStr);
                  }}
                  className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-[#0052cc] hover:bg-blue-100"
                  title="Xem số liệu ngày hôm nay"
                >
                  Hôm nay
                </button>
              )}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm đơn hàng, khách hàng..."
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] outline-none focus:border-[#0052cc]"
            />
            <Button size="sm" variant="outline" onClick={() => void openWage()}>
              + Thêm đơn giá vị trí
            </Button>
            <Button size="sm" className={primaryBtn} onClick={() => void openCreate()}>
              + Thêm đơn hàng
            </Button>
          </>
        }
      />
      <QueryState loading={loading || !periodCode || (Boolean(filterDate) && loadingDaily)} error={error}>
        <div className="page-body flex flex-col gap-4">
          {visible.map((o) => {
            const daily = filterDate
              ? dailyReports.find((r) => r.order_id === o.id || r.order_code === o.code)
              : null;
            return (
              <article key={o.id} className="grid gap-5 rounded-xl border bg-white p-5 shadow-sm lg:grid-cols-[1.1fr_1.2fr_1fr]">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StatusPill tone={o.status === "Đang chạy" ? "success" : "neutral"}>{o.status}</StatusPill>
                      <StatusPill tone={statusToneForHealth(o.health)}>{o.health}</StatusPill>
                    </div>
                    <span className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => void openOrderDetail(o)}>
                        Chi tiết
                      </Button>
                      <Button variant="outline" size="xs" onClick={() => openEdit(o.id)}>
                        Sửa
                      </Button>
                      <Button variant="destructive" size="xs" onClick={() => void removeOrder(o)}>
                        Xóa
                      </Button>
                    </span>
                  </div>
                  <h2
                    className="mt-2.5 text-[17px] font-bold text-slate-900 cursor-pointer hover:text-[#0052cc] transition-colors"
                    onClick={() => void openOrderDetail(o)}
                  >
                    {o.title}
                  </h2>
                  <div className="text-[12.5px] font-medium text-[#0052cc]">
                    {o.companyName ? `${o.companyName} · ` : ""}Địa điểm: {o.workSite || "Theo nhà máy"}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    {o.code} · {o.period} · Phụ trách: <strong>{o.manager}</strong>
                  </div>

                  {filterDate && (
                    <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 text-[12px] text-blue-950">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#0052cc]">
                          📅 Số liệu ngày {new Intl.DateTimeFormat("vi-VN").format(new Date(filterDate))}:
                        </span>
                        {daily?.note_updated_at && (
                          <span className="text-[11px] text-blue-700">
                            {new Date(daily.note_updated_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11.5px] text-slate-700">
                        Cập nhật bởi: <strong>{daily?.note_updated_by || "Hệ thống (chấm công & bàn giao)"}</strong>
                        {daily?.note_updated_at && (
                          <span className="text-slate-400"> ({new Date(daily.note_updated_at).toLocaleString("vi-VN")})</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-3 xl:grid-cols-3">
                    {filterDate
                      ? [
                          ["Chỉ tiêu đơn", `${daily ? daily.target_qty : o.target} người`],
                          ["Đang đợt làm", `${daily ? daily.active_qty : (o.arranged ?? o.working)} người`],
                          ["Đi làm (chấm công)", `${daily ? daily.attended_qty : 0} người`],
                          ["Mới vào hôm nay", `${daily?.new_joins ?? 0} người`],
                          ["Nghỉ việc hôm nay", `${daily?.left_qty ?? 0} người`],
                          [
                            "Bàn giao",
                            daily
                              ? `${daily.received_handover} nhận / ${daily.pending_handover} chờ`
                              : "—",
                          ],
                          ["Còn thiếu", `${daily ? daily.missing_qty : (o.missing ?? 0)} người`],
                          ["Vị trí tuyển", `${o.positions}`],
                          ["Vendor tham gia", `${o.vendors}`],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-2">
                            <div className="text-[11px] text-slate-500">{k}</div>
                            <div className="font-bold text-slate-900">{v}</div>
                          </div>
                        ))
                      : [
                          ["Chỉ tiêu", `${o.target} người`],
                          ["Đã bố trí", `${o.arranged ?? o.working} người`],
                          ["Đã đi làm", `${o.working} người`],
                          ["Còn thiếu", `${o.missing ?? 0} người`],
                          ["Vị trí tuyển", `${o.positions}`],
                          ["Vendor tham gia", `${o.vendors}`],
                        ].map(([k, v]) => (
                          <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-2">
                            <div className="text-[11px] text-slate-500">{k}</div>
                            <div className="font-bold text-slate-900">{v}</div>
                          </div>
                        ))}
                  </div>

                  {filterDate ? (
                    <Button
                      size="sm"
                      className="mt-3 w-full bg-[#0052cc] text-white hover:bg-[#0747a6] font-semibold flex items-center justify-center gap-1.5"
                      onClick={() => void openDailyWorkers(o, daily ?? null)}
                    >
                      <span>
                        Xem danh sách NLĐ ngày {new Intl.DateTimeFormat("vi-VN").format(new Date(filterDate))} ({daily?.attended_qty ?? 0} đi làm / {daily?.active_qty ?? 0} trong đợt)
                      </span>
                      <span>→</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full border-[#0052cc] text-[#0052cc] hover:bg-blue-50 font-semibold flex items-center justify-center gap-1.5"
                      onClick={() => void openOrderDetail(o)}
                    >
                      <span>Xem chi tiết đơn & Danh sách công nhân ({o.working} đi làm / {o.totalProfiles} hồ sơ)</span>
                      <span>→</span>
                    </Button>
                  )}
                </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold text-slate-600">
                  <span>Vị trí & Mức lương tuyển</span>
                  <span className="font-normal text-slate-400">Tiến độ giao người</span>
                </div>
                <div className="flex flex-col gap-3">
                  {o.items.map((p) => {
                    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                    return (
                      <div key={p.idx} className="rounded-lg border border-slate-100 p-2.5 hover:border-blue-200 transition-colors">
                        <div className="mb-1 flex items-center justify-between text-[13px]">
                          <span className="font-semibold text-slate-800">
                            <span className="mr-1.5 font-bold text-[#0052cc]">{p.idx}</span>
                            {p.name}
                          </span>
                          <span className="text-slate-500 font-medium">
                            {p.done}/{p.total} · {pct}%
                          </span>
                        </div>

                        {/* Thông tin đơn giá & Ca làm */}
                        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
                          {p.dayRate ? (
                            <span className="text-emerald-700 font-medium">
                              Đơn giá: <strong>{formatVND(p.dayRate)}</strong>/ngày
                              {p.rateAmount && p.wageUnit && p.wageUnit !== "day" ? (
                                <span className="text-slate-500 font-normal ml-1">
                                  ({formatVND(p.rateAmount)}/{p.wageUnit})
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Chưa có đơn giá</span>
                          )}
                          {p.shift && <span className="text-slate-600">· Ca: <strong>{p.shift}</strong></span>}
                          {p.rateFrom && (
                            <span className="text-slate-400">
                              · Áp dụng: {p.rateFrom} {p.rateTo ? `→ ${p.rateTo}` : "(hiện hành)"}
                            </span>
                          )}
                        </div>

                        {/* Mô tả công việc */}
                        {p.jobDescription && (
                          <div className="mb-1.5 text-[11.5px] text-slate-500 line-clamp-1" title={p.jobDescription}>
                            <span className="font-medium text-slate-600">Mô tả:</span> {p.jobDescription}
                          </div>
                        )}

                        <ProgressBar value={pct} tone="green" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 flex flex-col justify-between">
                <div>
                  <div className="text-[12.5px] font-semibold text-slate-600">Tổng quan hồ sơ ({o.totalProfiles})</div>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {o.funnel.map((f) => (
                      <div key={f.label} className="flex items-center justify-between text-[13px] text-slate-600">
                        <span className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${legendTone[f.tone]}`} />
                          {f.label}
                        </span>
                        <strong className="text-slate-900">{f.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-2.5 text-[13px]">
                  <span className="text-slate-500">Tiến độ giao người</span>
                  <StatusPill tone={statusToneForHealth(o.health)}>{o.health}</StatusPill>
                </div>
              </div>
            </article>
          );
        })}
        {visible.length === 0 && <p className="py-10 text-center text-slate-400">Không có đơn hàng trong kỳ này.</p>}
        </div>
      </QueryState>

      {/* MODAL CHI TIẾT ĐƠN HÀNG & ĐỐI CHIẾU DANH SÁCH NLĐ (Hình 1 & Hình 4) */}
      <Modal
        open={selectedOrderDetail !== null}
        onClose={() => setSelectedOrderDetail(null)}
        title={`Chi tiết đơn hàng: ${selectedOrderDetail?.code ?? ""} – ${selectedOrderDetail?.title ?? ""}`}
        wide
      >
        {selectedOrderDetail && (
          <div className="flex flex-col gap-5">
            {/* 1. Header tóm tắt thông tin đơn hàng */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <StatusPill tone={selectedOrderDetail.status === "Đang chạy" ? "success" : "neutral"}>
                    {selectedOrderDetail.status}
                  </StatusPill>
                  <StatusPill tone={statusToneForHealth(selectedOrderDetail.health)}>
                    {selectedOrderDetail.health}
                  </StatusPill>
                  <span className="text-[13px] text-slate-500 font-medium">Mã đơn: <strong>{selectedOrderDetail.code}</strong></span>
                </div>
                <div className="text-[12.5px] text-slate-600">
                  Kỳ hoạt động: <strong>{selectedOrderDetail.period}</strong>
                </div>
              </div>

              <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Doanh nghiệp / Khách hàng</div>
                  <div className="font-semibold text-slate-900">{selectedOrderDetail.companyName || selectedOrderDetail.title}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Địa điểm làm việc</div>
                  <div className="font-semibold text-[#0052cc]">
                    {selectedOrderDetail.workSite || "Theo nhà máy"}
                    {selectedOrderDetail.siteAddress ? ` (${selectedOrderDetail.siteAddress})` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Phụ trách đơn hàng</div>
                  <div className="font-semibold text-slate-900">
                    {selectedOrderDetail.manager}
                    {selectedOrderDetail.ownerPhone ? ` · ${selectedOrderDetail.ownerPhone}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Vendor tham gia</div>
                  <div className="font-semibold text-slate-900">{selectedOrderDetail.vendors} đối tác</div>
                </div>
              </div>
            </div>

            {/* 2. Thẻ số lượng theo từng trạng thái (Đối chiếu và bấm để lọc NLĐ) */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-bold text-slate-800">
                  Số lượng ứng viên theo trạng thái (Bấm thẻ để đối chiếu với danh sách NLĐ)
                </span>
                <span className="text-[12px] text-slate-500">
                  Tổng hồ sơ: <strong>{selectedOrderDetail.totalProfiles}</strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 text-[13px]">
                <button
                  type="button"
                  onClick={() => setWorkerStageFilter("all")}
                  className={`rounded-lg p-2.5 text-left border transition-all ${
                    workerStageFilter === "all"
                      ? "border-[#0052cc] bg-blue-50 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-[11px] text-slate-500">Tất cả hồ sơ</div>
                  <div className="text-[16px] font-bold text-slate-900">{orderWorkers.length} người</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStageFilter("working")}
                  className={`rounded-lg p-2.5 text-left border transition-all ${
                    workerStageFilter === "working"
                      ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20"
                      : "border-slate-200 bg-white hover:bg-emerald-50/50"
                  }`}
                >
                  <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Đã đi làm (đối chiếu)
                  </div>
                  <div className="text-[16px] font-bold text-emerald-700">
                    {stageCounts.working ?? selectedOrderDetail.working} người
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStageFilter("waiting_start")}
                  className={`rounded-lg p-2.5 text-left border transition-all ${
                    workerStageFilter === "waiting_start"
                      ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/20"
                      : "border-slate-200 bg-white hover:bg-sky-50/50"
                  }`}
                >
                  <div className="text-[11px] text-sky-700 font-medium flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Chờ nhận việc
                  </div>
                  <div className="text-[16px] font-bold text-sky-800">{stageCounts.waiting_start ?? 0} người</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStageFilter("interview")}
                  className={`rounded-lg p-2.5 text-left border transition-all ${
                    workerStageFilter === "interview"
                      ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20"
                      : "border-slate-200 bg-white hover:bg-amber-50/50"
                  }`}
                >
                  <div className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Hẹn PV
                  </div>
                  <div className="text-[16px] font-bold text-amber-800">{stageCounts.interview ?? 0} người</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStageFilter("applied")}
                  className={`rounded-lg p-2.5 text-left border transition-all ${
                    workerStageFilter === "applied"
                      ? "border-slate-400 bg-slate-100 ring-2 ring-slate-400/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Mới ứng tuyển
                  </div>
                  <div className="text-[16px] font-bold text-slate-700">{stageCounts.applied ?? 0} người</div>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkerStageFilter("left")}
                  className={`rounded-lg p-2.5 text-left border transition-all ${
                    workerStageFilter === "left"
                      ? "border-rose-400 bg-rose-50 ring-2 ring-rose-400/20"
                      : "border-slate-200 bg-white hover:bg-rose-50/50"
                  }`}
                >
                  <div className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Đã nghỉ việc
                  </div>
                  <div className="text-[16px] font-bold text-rose-700">{stageCounts.left ?? 0} người</div>
                </button>
              </div>
            </div>

            {/* 3. Vị trí tuyển dụng trong đơn (mô tả công việc, ca làm, mức lương, thời gian áp dụng) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13.5px] font-bold text-slate-900">
                  Vị trí tuyển dụng & Đơn giá áp dụng trong đơn
                </span>
                <Button size="xs" variant="outline" onClick={() => void openWage()}>
                  + Thêm / Sửa đơn giá vị trí
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {selectedOrderDetail.items.map((p) => {
                  const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                  return (
                    <div key={p.idx} className="flex flex-col justify-between rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-[13.5px]">
                            <span className="mr-1 text-[#0052cc]">{p.idx}</span> {p.name}
                          </span>
                          <span className="text-[12px] font-semibold text-slate-600">
                            {p.done}/{p.total} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1.5 mb-2">
                          <ProgressBar value={pct} tone="green" />
                        </div>

                        <div className="space-y-1 text-[12px]">
                          <div>
                            <span className="text-slate-500">Mức lương:</span>{" "}
                            {p.dayRate ? (
                              <strong className="text-emerald-700">
                                {formatVND(p.dayRate)}/ngày
                                {p.rateAmount && p.wageUnit && p.wageUnit !== "day" ? (
                                  <span className="font-normal text-slate-500">
                                    {" "}
                                    ({formatVND(p.rateAmount)}/{p.wageUnit})
                                  </span>
                                ) : null}
                              </strong>
                            ) : (
                              <span className="italic text-slate-400">Chưa có mức lương</span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-500">Ca làm việc:</span>{" "}
                            <strong className="text-slate-700">{p.shift || "Chưa xác định"}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500">Thời gian áp dụng:</span>{" "}
                            <span className="text-slate-700 font-medium">
                              {p.rateFrom ? `${p.rateFrom} ${p.rateTo ? `→ ${p.rateTo}` : "(đang áp dụng)"}` : "Toàn bộ chu kỳ"}
                            </span>
                          </div>
                          {p.jobDescription && (
                            <div className="pt-1 text-slate-600 border-t border-slate-200/60 mt-1.5">
                              <span className="font-medium text-slate-500">Mô tả:</span> {p.jobDescription}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200">
                        <Button
                          size="xs"
                          variant="outline"
                          className="w-full text-[12px] text-[#0052cc] border-blue-200 hover:bg-blue-50"
                          onClick={() => void openWage(p.id)}
                        >
                          Cập nhật đơn giá & mô tả vị trí này
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Danh sách Người lao động thuộc đơn & Thông tin liên hệ (Hình 1 & Hình 4) */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900">
                    Danh sách Người lao động thuộc đơn & Thông tin liên hệ
                  </h3>
                  <div className="text-[12px] text-slate-500">
                    Đang hiển thị <strong>{filteredWorkers.length}</strong> / <strong>{orderWorkers.length}</strong> hồ sơ
                    {workerStageFilter === "working" && (
                      <span className="text-emerald-700 font-semibold ml-1">
                        (Khớp chính xác với {stageCounts.working ?? selectedOrderDetail.working} người Đã đi làm)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                    placeholder="Tìm theo họ tên, SĐT, mã NLĐ..."
                    className="rounded-lg border border-slate-200 px-3 py-1 text-[12.5px] outline-none focus:border-[#0052cc] w-64"
                  />
                  {workerStageFilter !== "all" && (
                    <Button size="xs" variant="outline" onClick={() => setWorkerStageFilter("all")}>
                      Bỏ lọc ({STAGE_LABELS[workerStageFilter] || workerStageFilter})
                    </Button>
                  )}
                </div>
              </div>

              {workersError && (
                <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{workersError}</p>
              )}

              <QueryState loading={loadingWorkers} error={workersError}>
                <div className="overflow-x-auto">
                  <DataTable
                    headers={[
                      "Mã NLĐ",
                      "Họ và tên",
                      "Số điện thoại liên hệ",
                      "Vị trí",
                      "Trạng thái",
                      "Quản lý đón & SĐT",
                      "Người tuyển / Vendor",
                      "Thời gian làm việc",
                      "Đơn giá/ngày",
                      "Số ngày công",
                      "Tạm tính",
                      "",
                    ]}
                  >
                    {filteredWorkers.map((w) => (
                      <tr key={`${w.placement_id}-${w.worker_code}`} className="hover:bg-slate-50/80 transition-colors">
                        <td>
                          <code className="text-[12px] font-semibold text-slate-700">{w.worker_code}</code>
                        </td>
                        <td>
                          <strong className="text-slate-900 text-[13px]">{w.full_name}</strong>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${w.phone}`}
                              className="font-mono text-[12.5px] font-semibold text-[#0052cc] hover:underline"
                              title="Bấm để gọi"
                            >
                              {w.phone}
                            </a>
                            <button
                              type="button"
                              onClick={() => copyPhoneToClipboard(w.phone)}
                              className="rounded px-1 text-[10.5px] text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                              title="Sao chép SĐT"
                            >
                              {copiedPhone === w.phone ? "✓" : "Copy"}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className="font-medium text-slate-800">{w.position}</span>
                        </td>
                        <td>
                          <StatusPill
                            tone={
                              w.stage === "working"
                                ? "success"
                                : w.stage === "waiting_start"
                                ? "neutral"
                                : w.stage === "interview"
                                ? "warning"
                                : "neutral"
                            }
                          >
                            {STAGE_LABELS[w.stage] ?? w.stage}
                          </StatusPill>
                        </td>
                        <td>
                          {w.supervisor_name ? (
                            <div>
                              <strong className="text-slate-800 text-[12.5px]">{w.supervisor_name}</strong>
                              {w.supervisor_phone && (
                                <div className="text-[11px] font-mono text-slate-500">
                                  <a href={`tel:${w.supervisor_phone}`} className="hover:text-[#0052cc] hover:underline">
                                    {w.supervisor_phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td>
                          <span className="text-[12px] text-slate-600">{w.recruited_by || "—"}</span>
                        </td>
                        <td>
                          <span className="text-[12px] text-slate-600">
                            {w.start_date} → {w.end_date ?? "nay"}
                          </span>
                        </td>
                        <td>{w.current_daily_rate ? formatVND(num(w.current_daily_rate)) : "—"}</td>
                        <td>
                          <strong>{num(w.work_days)}</strong> ngày
                        </td>
                        <td>
                          <strong className="text-emerald-700">{formatVND(num(w.wage_amount))}</strong>
                        </td>
                        <td>
                          {onViewDetail && (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                onViewDetail({
                                  id: w.worker_id,
                                  code: w.worker_code,
                                  name: w.full_name,
                                  phone: w.phone,
                                  hometown: "",
                                  citizenId: "",
                                  company: selectedOrderDetail?.title ?? "",
                                  position: w.position,
                                  type: "Thời vụ",
                                  recruiter: w.recruited_by ?? "",
                                  status: w.stage === "working" ? "Đang làm" : "Chờ đi làm",
                                  dailyRate: num(w.current_daily_rate),
                                  workedDays: num(w.work_days),
                                  advance: 0,
                                  avatarColor: "avatar-blue",
                                  initials: w.full_name.slice(-2),
                                  supervisorName: w.supervisor_name ?? undefined,
                                  supervisorPhone: w.supervisor_phone ?? undefined,
                                });
                              }}
                            >
                              Hồ sơ
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredWorkers.length === 0 && (
                      <EmptyRow
                        colSpan={12}
                        text={
                          workerSearch || workerStageFilter !== "all"
                            ? "Không tìm thấy người lao động phù hợp với bộ lọc."
                            : "Chưa có người lao động nào thuộc đơn này."
                        }
                      />
                    )}
                  </DataTable>
                </div>
              </QueryState>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL THÊM / SỬA ĐƠN HÀNG */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Sửa đơn hàng" : "Thêm đơn hàng"}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button className={primaryBtn} onClick={() => void saveOrder()}>
              {busy ? "Đang lưu..." : editingId ? "Lưu" : "Tạo đơn"}
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mã đơn *" error={orderErrors.code}>
            <input
              className={getInputClass(orderErrors.code)}
              value={form.code}
              onChange={(e) => {
                setForm({ ...form, code: e.target.value });
                if (orderErrors.code) setOrderErrors((p) => { const n = { ...p }; delete n.code; return n; });
              }}
              placeholder="DH-2610-WESUM"
            />
          </Field>
          <Field label="Tên đơn *" error={orderErrors.name}>
            <input
              className={getInputClass(orderErrors.name)}
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (orderErrors.name) setOrderErrors((p) => { const n = { ...p }; delete n.name; return n; });
              }}
              placeholder="Lắp ráp T10"
            />
          </Field>
          <Field label="Công ty *" error={orderErrors.companyId}>
            <select
              className={getInputClass(orderErrors.companyId)}
              value={form.companyId}
              onChange={(e) => {
                const companyId = e.target.value;
                const site = sites.find((s) => String(s.company_id) === companyId);
                setForm({ ...form, companyId, siteId: site ? String(site.id) : "" });
                if (orderErrors.companyId) setOrderErrors((p) => { const n = { ...p }; delete n.companyId; return n; });
              }}
            >
              {companies.map((c) => <option key={c.id} value={c.id}>{c.short_name}</option>)}
            </select>
          </Field>
          {editingId && (
            <Field label="Trạng thái">
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Nháp</option>
                <option value="running">Đang chạy</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="closed">Đã đóng</option>
              </select>
            </Field>
          )}
          {!editingId && (
            <>
              <Field label="Địa điểm">
                <select className={inputClass} value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>
                  <option value="">— Theo nhà máy —</option>
                  {companySites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Phụ trách">
                <select className={inputClass} value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </Field>
              <Field label="Nhóm">
                <select className={inputClass} value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Từ ngày *" error={orderErrors.start}>
            <input
              type="date"
              className={getInputClass(orderErrors.start)}
              value={form.start}
              onChange={(e) => {
                setForm({ ...form, start: e.target.value });
                if (orderErrors.start) setOrderErrors((p) => { const n = { ...p }; delete n.start; return n; });
              }}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              className={inputClass}
              value={form.end}
              onChange={(e) => setForm({ ...form, end: e.target.value })}
            />
          </Field>
          <Field label="Chỉ tiêu đơn *" error={orderErrors.target}>
            <input
              className={getInputClass(orderErrors.target)}
              inputMode="numeric"
              value={form.target}
              onChange={(e) => {
                setForm({ ...form, target: e.target.value });
                if (orderErrors.target) setOrderErrors((p) => { const n = { ...p }; delete n.target; return n; });
              }}
            />
          </Field>
          {!editingId && (
            <Field label="Vị trí tuyển *" error={orderErrors.position}>
              <input
                className={getInputClass(orderErrors.position)}
                value={form.position}
                onChange={(e) => {
                  setForm({ ...form, position: e.target.value });
                  if (orderErrors.position) setOrderErrors((p) => { const n = { ...p }; delete n.position; return n; });
                }}
                placeholder="VD: Công nhân lắp ráp"
              />
            </Field>
          )}
          {!editingId && (
            <Field label="Chỉ tiêu vị trí">
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.positionQty}
                onChange={(e) => setForm({ ...form, positionQty: e.target.value })}
              />
            </Field>
          )}
          {!editingId && (
            <>
              <Field label="Mô tả công việc">
                <input
                  className={inputClass}
                  value={form.jobDesc}
                  onChange={(e) => setForm({ ...form, jobDesc: e.target.value })}
                  placeholder="VD: Lắp ráp linh kiện, đứng line 8 tiếng..."
                />
              </Field>
              <Field label="Ca làm việc">
                <input
                  className={inputClass}
                  value={form.shiftDesc}
                  onChange={(e) => setForm({ ...form, shiftDesc: e.target.value })}
                  placeholder="VD: Ca hành chính (08:00 - 17:00)"
                />
              </Field>
              <Field label="Đơn giá 1 ngày làm (VNĐ)" error={orderErrors.dayRate}>
                <input
                  className={getInputClass(orderErrors.dayRate)}
                  inputMode="numeric"
                  value={form.dayRate}
                  onChange={(e) => {
                    setForm({ ...form, dayRate: e.target.value });
                    if (orderErrors.dayRate) setOrderErrors((p) => { const n = { ...p }; delete n.dayRate; return n; });
                  }}
                  placeholder="260000"
                />
              </Field>
            </>
          )}
        </div>
      </Modal>

      {/* MODAL THÊM / CẬP NHẬT ĐƠN GIÁ VỊ TRÍ (Hình 2, Hình 3, Hình 5) */}
      <Modal
        open={wageOpen}
        onClose={() => setWageOpen(false)}
        title="Thêm / Cập nhật đơn giá vị trí"
        footer={
          <>
            <Button variant="outline" onClick={() => setWageOpen(false)}>
              Hủy
            </Button>
            <Button className={primaryBtn} onClick={() => void saveWage()}>
              {busy ? "Đang lưu..." : "Lưu đơn giá"}
            </Button>
          </>
        }
      >
        {formError && (
          <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700 border border-rose-200">
            {formError}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Vị trí tuyển dụng *" error={wageErrors.positionId}>
              <select
                className={getInputClass(wageErrors.positionId)}
                value={wage.positionId}
                onChange={(e) => handlePositionChange(e.target.value)}
              >
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} {p.order_code ? `(${p.order_code} – ${p.order_name})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Mô tả công việc (Job Description)">
              <textarea
                className={`${inputClass} min-h-[64px]`}
                value={wage.jobDesc}
                onChange={(e) => setWage({ ...wage, jobDesc: e.target.value })}
                placeholder="VD: Lắp ráp linh kiện điện tử trên chuyền, thao tác theo hướng dẫn, đứng ca 8 tiếng..."
              />
            </Field>
          </div>

          <Field label="Ca làm việc">
            <select
              className={inputClass}
              value={wage.shiftId}
              onChange={(e) => setWage({ ...wage, shiftId: e.target.value })}
            >
              <option value="">— Mặc định theo nhà máy —</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Đơn vị tính lương *">
            <select
              className={inputClass}
              value={wage.unit}
              onChange={(e) => handleRateChange(wage.rate, e.target.value)}
            >
              {Object.entries(WAGE_UNIT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Mức lương theo đơn vị (VNĐ) *" error={wageErrors.rate}>
            <input
              className={getInputClass(wageErrors.rate)}
              inputMode="numeric"
              value={wage.rate}
              onChange={(e) => handleRateChange(e.target.value)}
              placeholder="VD: 280000 hoặc 35000"
            />
          </Field>

          <Field label="Lương ngày quy đổi (VNĐ) *">
            <input
              className={inputClass}
              inputMode="numeric"
              value={wage.dayRate}
              onChange={(e) => setWage({ ...wage, dayRate: e.target.value })}
              placeholder="VD: 280000"
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Dùng để chấm công & tính lương ngày (tự tính theo đơn vị hoặc tự điều chỉnh).
            </span>
          </Field>

          <Field label="Hiệu lực từ ngày *" error={wageErrors.from}>
            <input
              type="date"
              className={getInputClass(wageErrors.from)}
              value={wage.from}
              onChange={(e) => setWage({ ...wage, from: e.target.value })}
            />
          </Field>

          <Field label="Đến ngày (tuỳ chọn)" error={wageErrors.to}>
            <input
              type="date"
              className={getInputClass(wageErrors.to)}
              value={wage.to}
              onChange={(e) => setWage({ ...wage, to: e.target.value })}
            />
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              Để trống nếu áp dụng vô thời hạn / đến khi có đơn giá mới.
            </span>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Ghi chú áp dụng">
              <input
                className={inputClass}
                value={wage.note}
                onChange={(e) => setWage({ ...wage, note: e.target.value })}
                placeholder="VD: Tăng đơn giá đợt cao điểm từ giữa tháng 10..."
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Modal xem danh sách NLĐ theo ngày lọc */}
      <Modal
        open={Boolean(selectedDailyOrder)}
        onClose={() => setSelectedDailyOrder(null)}
        title={`Danh sách NLĐ ngày ${filterDate ? new Intl.DateTimeFormat("vi-VN").format(new Date(filterDate)) : ""} — ${selectedDailyOrder?.order.title} (${selectedDailyOrder?.order.code})`}
        wide
      >
        {dailyWorkersError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{dailyWorkersError}</p>}
        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-[12.5px] text-blue-900">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>Chỉ tiêu đơn: <strong>{selectedDailyOrder?.report?.target_qty ?? selectedDailyOrder?.order.target} người</strong></div>
            <div>Đang trong đợt làm: <strong className="text-blue-700">{selectedDailyOrder?.report?.active_qty ?? 0} người</strong></div>
            <div>Thực tế đi làm (chấm công): <strong className="text-emerald-700">{selectedDailyOrder?.report?.attended_qty ?? 0} người</strong></div>
            <div>Còn thiếu: <strong className="text-rose-700">{selectedDailyOrder?.report?.missing_qty ?? 0} người</strong></div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between border-t border-blue-200/50 pt-2 text-[11.5px] text-blue-800">
            <div>
              Bàn giao: <strong>{selectedDailyOrder?.report?.received_handover ?? 0} đã nhận</strong> · <strong>{selectedDailyOrder?.report?.pending_handover ?? 0} chờ bàn giao</strong>
              · Mới vào: <strong>{selectedDailyOrder?.report?.new_joins ?? 0}</strong> · Nghỉ việc: <strong>{selectedDailyOrder?.report?.left_qty ?? 0}</strong>
            </div>
            <div>
              Người cập nhật: <strong>{selectedDailyOrder?.report?.note_updated_by || "Hệ thống"}</strong>
              {selectedDailyOrder?.report?.note_updated_at && ` lúc ${new Date(selectedDailyOrder.report.note_updated_at).toLocaleString("vi-VN")}`}
            </div>
          </div>
        </div>
        <QueryState loading={loadingDailyWorkers} error={dailyWorkersError}>
          <div className="overflow-x-auto">
            <DataTable headers={["Mã NLĐ", "Họ và tên", "Số ĐT", "Vị trí", "Đợt làm việc", "Trạng thái ngày", "Chấm công vào/ra", "Bàn giao", "Quản lý đón", ""]}>
              {dailyWorkers.map((w) => (
                <tr key={`${w.worker_code}`}>
                  <td><code>{w.worker_code}</code></td>
                  <td><strong>{w.full_name}</strong></td>
                  <td><code className="text-[12px]">{w.phone}</code></td>
                  <td>{w.position}</td>
                  <td>
                    <span className="text-[12px] text-slate-600">
                      {w.start_date} → {w.end_date ?? "nay"}
                    </span>
                  </td>
                  <td>
                    <StatusPill
                      tone={
                        w.status_today === "Đi làm"
                          ? "success"
                          : w.status_today === "Mới vào"
                            ? "info"
                            : w.status_today === "Nghỉ/ra"
                              ? "danger"
                              : "warning"
                      }
                    >
                      {w.status_today}
                    </StatusPill>
                  </td>
                  <td>
                    <span className="text-[12px] font-mono text-slate-700">
                      {w.check_in_at ? w.check_in_at.slice(0, 5) : "—"} ~ {w.check_out_at ? w.check_out_at.slice(0, 5) : "—"}
                    </span>
                  </td>
                  <td>
                    {w.handover_status ? (
                      <StatusPill
                        tone={
                          w.handover_status === "received"
                            ? "success"
                            : w.handover_status === "handed_over"
                              ? "info"
                              : "warning"
                        }
                      >
                        {w.handover_status === "received"
                          ? "Đã nhận"
                          : w.handover_status === "handed_over"
                            ? "Đã bàn giao"
                            : "Chờ bàn giao"}
                      </StatusPill>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td>
                    {w.supervisor_name ? (
                      <div>
                        <strong className="text-slate-800">{w.supervisor_name}</strong>
                        {w.supervisor_phone && <div className="text-[11px] text-slate-400">{w.supervisor_phone}</div>}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td>
                    {onViewDetail && (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          onViewDetail({
                            id: 0,
                            code: w.worker_code,
                            name: w.full_name,
                            phone: w.phone,
                            hometown: "",
                            citizenId: "",
                            company: selectedDailyOrder?.order.title ?? "",
                            position: w.position,
                            type: "Thời vụ",
                            recruiter: "",
                            status: "Đang làm",
                            dailyRate: 0,
                            workedDays: 0,
                            advance: 0,
                            avatarColor: "avatar-blue",
                            initials: w.full_name.slice(-2),
                            supervisorName: w.supervisor_name ?? undefined,
                            supervisorPhone: w.supervisor_phone ?? undefined,
                          });
                        }}
                      >
                        Hồ sơ
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {dailyWorkers.length === 0 && (
                <EmptyRow colSpan={10} text={`Không có người lao động nào ghi nhận trong ngày ${filterDate ? new Intl.DateTimeFormat("vi-VN").format(new Date(filterDate)) : ""}.`} />
              )}
            </DataTable>
          </div>
        </QueryState>
      </Modal>
    </section>
  );
}
