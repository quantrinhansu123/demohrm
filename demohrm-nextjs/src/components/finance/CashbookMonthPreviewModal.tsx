"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { fetchLiveCashbook } from "@/lib/live";
import type { LiveCashbookEntry } from "@/lib/live";
import { formatMonthLabel } from "@/lib/advance-months";
import { cashbookGroupDisplay, formatCashbookDate } from "@/lib/cashbook";
import { formatVND } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusPill } from "@/components/ui/badge";

export function CashbookMonthPreviewModal({
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
  onExport?: (monthCode: string) => void;
  exporting?: boolean;
}) {
  const [rows, setRows] = useState<LiveCashbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !monthCode) return;
    let alive = true;
    setLoading(true);
    setError("");
    fetchLiveCashbook({ month: monthCode, limit: 500 })
      .then((page) => {
        if (!alive) return;
        setRows(page.rows);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setRows([]);
        setError(e instanceof ApiError ? e.message : "Không tải được phiếu chi.");
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={monthCode ? `Phiếu chi tháng ${formatMonthLabel(monthCode)}` : "Phiếu chi"}
      badge={
        monthClosed ? (
          <StatusPill tone="neutral">Đã kết thúc</StatusPill>
        ) : (
          <StatusPill tone="success">Đang mở</StatusPill>
        )
      }
      footer={
        <>
          {monthCode && onExport ? (
            <Button variant="outline" disabled={exporting} onClick={() => onExport(monthCode)}>
              {exporting ? "Đang xuất..." : "Xuất Excel"}
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </>
      }
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-[13px] text-slate-500">Đang tải...</p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-slate-600">
            {rows.length} khoản · Tổng <strong className="text-rose-600">{formatVND(total)}</strong>
          </p>
          <div className="max-h-[60vh] overflow-auto rounded-xl border">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead className="sticky top-0 bg-slate-50 text-[12px] font-semibold text-slate-600">
                <tr>
                  <th className="border-b px-3 py-2">STT</th>
                  <th className="border-b px-3 py-2">Ngày chi</th>
                  <th className="border-b px-3 py-2">Nhóm</th>
                  <th className="border-b px-3 py-2">Nội dung</th>
                  <th className="border-b px-3 py-2">Người nhận</th>
                  <th className="border-b px-3 py-2">Công ty</th>
                  <th className="border-b px-3 py-2 text-right">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-2">{formatCashbookDate(row.entry_date)}</td>
                    <td className="px-3 py-2">{cashbookGroupDisplay(row.group_code, row.group_name)}</td>
                    <td className="px-3 py-2">{row.content}</td>
                    <td className="px-3 py-2">{row.full_name || "—"}</td>
                    <td className="px-3 py-2">{row.company_name || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-rose-600">
                      {formatVND(Number(row.amount))}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                      Chưa có phiếu chi trong tháng này
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
