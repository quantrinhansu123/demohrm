"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { fetchLiveAdvances } from "@/lib/live";
import type { LiveAdvance } from "@/lib/live";
import { formatVND } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  requested: "Chờ duyệt",
  approved: "Đã duyệt",
  paid: "Đã chi",
  settled: "Đã quyết toán",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", { hour12: false });
}

function personCode(row: LiveAdvance): string {
  return row.subject_type === "staff" ? "" : row.worker_code || "";
}

function personName(row: LiveAdvance): string {
  return (row.subject_type === "staff" ? row.staff_name : row.worker_name) || "";
}

const HEADERS = [
  "STT",
  "Mã phiếu",
  "Ngày",
  "Giờ",
  "Đối tượng",
  "Mã người nhận",
  "Tên người nhận",
  "Công ty",
  "Lý do",
  "Số tiền",
  "Trạng thái",
  "Người đưa tiền",
  "Người duyệt",
  "Ngày chi",
  "Ngày quyết toán",
  "Số quyết toán",
  "Ghi chú",
] as const;

export function AdvanceMonthPreviewModal({
  open,
  monthCode,
  monthClosed,
  onClose,
  onExport,
  exporting,
}: {
  open: boolean;
  monthCode: string | null;
  monthClosed: boolean;
  onClose: () => void;
  onExport: (monthCode: string) => void;
  exporting?: boolean;
}) {
  const [rows, setRows] = useState<LiveAdvance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !monthCode) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetchLiveAdvances({ month: monthCode, limit: 500 })
      .then((data) => {
        if (!alive) return;
        setRows(data);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setRows([]);
        setError(e instanceof ApiError ? e.message : "Không tải được phiếu tạm ứng.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, monthCode]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [rows],
  );

  if (!monthCode) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Danh sách tạm ứng · ${monthCode}`}
      xl
      badge={
        <StatusPill tone={monthClosed ? "neutral" : "success"}>
          {monthClosed ? "Đóng" : "Mở"}
        </StatusPill>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button
            variant="outline"
            disabled={exporting || loading}
            onClick={() => onExport(monthCode)}
          >
            {exporting ? "Đang xuất..." : "Xuất Excel"}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>
      ) : null}
      {loading ? (
        <p className="py-8 text-center text-[13px] text-slate-500">Đang tải phiếu...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1400px] w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {HEADERS.map((header) => (
                  <th
                    key={header}
                    className="sticky top-0 whitespace-nowrap border border-slate-200 bg-[#0052cc] px-2 py-2 text-center font-semibold text-white"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-600">{index + 1}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap font-mono text-slate-800">{row.code}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{formatDay(row.advance_date)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{(row.advance_time || "").slice(0, 5)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">
                    {row.subject_type === "staff" ? "Nhân viên" : "Người lao động"}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{personCode(row)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap font-medium text-slate-800">{personName(row)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{row.company_name || ""}</td>
                  <td className="border border-slate-200 px-2 py-1.5 max-w-[220px] truncate" title={row.reason || ""}>{row.reason || ""}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap text-right font-semibold text-[#0052cc]">
                    {formatVND(Number(row.amount) || 0)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{STATUS_LABEL[row.status] ?? row.status}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{row.giver_name || ""}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{row.approver_name || ""}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{formatDateTime(row.paid_at)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap">{formatDateTime(row.settled_at)}</td>
                  <td className="border border-slate-200 px-2 py-1.5 whitespace-nowrap text-right">
                    {row.settled_amount == null ? "" : formatVND(Number(row.settled_amount) || 0)}
                  </td>
                  <td className="border border-slate-200 px-2 py-1.5 max-w-[200px] truncate" title={row.note || ""}>{row.note || ""}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={HEADERS.length} className="border border-slate-200 px-3 py-8 text-center text-slate-500">
                    Chưa có phiếu tạm ứng trong tháng này
                  </td>
                </tr>
              ) : (
                <tr className="bg-blue-50 font-semibold">
                  <td colSpan={9} className="border border-slate-200 px-2 py-2 text-right text-slate-700">
                    TỔNG CỘNG: {rows.length} phiếu
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-right text-[#0052cc]">{formatVND(total)}</td>
                  <td colSpan={7} className="border border-slate-200 px-2 py-2" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
