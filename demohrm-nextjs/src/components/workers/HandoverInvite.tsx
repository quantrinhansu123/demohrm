"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { handoverAction } from "@/lib/live";

// Nut tao/copy link xac nhan ban giao cho quan ly (docs rule 13).
// Dat trong dong dot lam viec cua WorkerDetailModal (che do LIVE).
export function HandoverInvite({ placementId }: { placementId: number }) {
  const [handoverId, setHandoverId] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const h = await apiGet<{ id: number }>(`/handovers/by-placement/${placementId}`);
        if (alive) setHandoverId(h.id);
      } catch {
        if (alive) setMissing(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [placementId]);

  if (missing) return <span className="text-[11.5px] text-slate-400">Chưa có phiếu bàn giao</span>;

  const act = async (action: "hand-over" | "receive" | "refuse") => {
    if (handoverId === null) return;
    setMsg("");
    const extra: Record<string, unknown> = {};
    if (action === "receive") {
      const name = window.prompt("Tên người nhận:");
      if (!name) return;
      extra["received_by_name"] = name;
    }
    if (action === "refuse") {
      const reason = window.prompt("Lý do từ chối:");
      if (!reason) return;
      extra["refuse_reason"] = reason;
    }
    try {
      await handoverAction(handoverId, action, extra);
      setMsg(action === "hand-over" ? "Đã bàn giao" : action === "receive" ? "Đã nhận" : "Đã từ chối");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Thao tác thất bại.");
    }
  };

  const copy = async () => {
    if (handoverId === null) return;
    setMsg("");
    try {
      const r = await apiPost<{ url: string }>(`/handovers/${handoverId}/invite`, {});
      await navigator.clipboard.writeText(r.url);
      setMsg("Đã copy link!");
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Tạo link thất bại.");
    }
  };

  return (
    <span className="flex items-center gap-1.5">
      <button type="button" onClick={() => void act("hand-over")} className="text-[12px] font-semibold text-slate-700 hover:underline">Bàn giao</button>
      <button type="button" onClick={() => void act("receive")} className="text-[12px] font-semibold text-emerald-700 hover:underline">Đã nhận</button>
      <button type="button" onClick={() => void act("refuse")} className="text-[12px] font-semibold text-rose-600 hover:underline">Từ chối</button>
      <button type="button" onClick={() => void copy()} className="text-[12px] font-semibold text-[#0052cc] hover:underline">
        Copy link xác nhận
      </button>
      {msg && <span className="text-[11.5px] text-emerald-600">{msg}</span>}
    </span>
  );
}
