"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError, apiGet, apiPatch } from "@/lib/api";
import { StatusPill } from "@/components/ui/badge";

interface Board {
  handover_id: number;
  status: string;
  worker_code: string;
  full_name: string;
  phone: string;
  company: string;
  position: string;
  handed_by: string | null;
  supervisor_name: string;
  supervisor_phone: string;
  handed_over_at: string | null;
  received_at: string | null;
  start_date: string;
}

export default function HandoverConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [info, setInfo] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setInfo(await apiGet<Board>(`/handovers/by-token/${token}`));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Link không hợp lệ.");
      }
    })();
  }, [token]);

  const act = async (action: "receive" | "refuse") => {
    if (action === "receive" && !name.trim()) {
      setError("Nhập tên người xác nhận.");
      return;
    }
    if (action === "refuse" && !reason.trim()) {
      setError("Nhập lý do từ chối.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiPatch(`/handovers/by-token/${token}/${action}`, {
        received_by_name: name.trim() || null,
        refuse_reason: reason.trim() || null,
      });
      setDone(action === "receive" ? "Đã xác nhận tiếp nhận." : "Đã ghi nhận từ chối.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6fa] p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-[18px] font-bold text-slate-900">Xác nhận bàn giao lao động</h1>
        <p className="mt-0.5 text-[12.5px] text-slate-500">Trang Way — dành cho quản lý nhà máy (không cần đăng nhập)</p>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
        {done && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{done}</p>}
        {!info && !error && <p className="mt-3 text-[13px] text-slate-400">Đang tải phiếu bàn giao...</p>}
        {info && !done && (
          <div className="mt-3 flex flex-col gap-2 text-[13.5px]">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[16px] font-bold">{info.full_name} <span className="font-normal text-slate-500">({info.worker_code})</span></div>
              <div className="text-slate-600">{info.position} · {info.company}</div>
              <div className="text-slate-500">Ngày vào: {info.start_date} · Người giao: {info.handed_by ?? "—"}</div>
              <div className="mt-1"><StatusPill tone={info.status === "received" ? "success" : "warning"}>{info.status}</StatusPill></div>
            </div>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Tên người xác nhận *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Phạm Văn Đông" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-[#0052cc]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12.5px] font-medium text-slate-600">Lý do từ chối (nếu từ chối)</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Thiếu hồ sơ..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-[#0052cc]" />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => void act("receive")} className="flex-1 rounded-lg bg-[#0052cc] px-3 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0747a6]">
                {busy ? "..." : "Xác nhận tiếp nhận"}
              </button>
              <button type="button" onClick={() => void act("refuse")} className="flex-1 rounded-lg border border-rose-200 px-3 py-2 text-[13.5px] font-semibold text-rose-600 hover:bg-rose-50">
                Từ chối
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
