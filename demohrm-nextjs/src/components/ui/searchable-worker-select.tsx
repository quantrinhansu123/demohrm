"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { LiveWorkerRow } from "@/lib/live";
import { loadWorkerOptions, peekWorkerOptionsCache } from "@/lib/worker-options";

interface Props {
  value: number | null;
  onChange: (id: number | null) => void;
  /** Danh sách local. Bỏ qua khi remote=true. */
  workers?: LiveWorkerRow[];
  placeholder?: string;
  inputId?: string;
  disabled?: boolean;
  /** Mặc định hiện avatar chữ cái; tắt khi dùng làm form gọn. */
  showAvatar?: boolean;
  /**
   * Tìm trên server (API /workers/options) — nhanh, scale tốt.
   * Không cần truyền workers đầy đủ.
   */
  remote?: boolean;
  /** Lọc theo tên công ty (API options). Không lọc trạng thái. */
  company?: string | null;
}

function labelOf(worker: LiveWorkerRow): string {
  return `${worker.full_name} (${worker.code})`;
}

function matchQuery(worker: LiveWorkerRow, q: string): boolean {
  const hay = `${worker.full_name} ${worker.code} ${worker.phone} ${worker.company ?? ""} ${worker.current_position ?? ""}`.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((part) => hay.includes(part));
}

const REMOTE_LIMIT = 40;
const REMOTE_LIMIT_BY_COMPANY = 100;

export function SearchableWorkerSelect({
  value,
  onChange,
  workers = [],
  placeholder,
  inputId,
  disabled,
  showAvatar = true,
  remote = false,
  company = null,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const companyKey = company?.trim() || null;
  const remoteLimit = companyKey ? REMOTE_LIMIT_BY_COMPANY : REMOTE_LIMIT;
  const [remoteRows, setRemoteRows] = useState<LiveWorkerRow[]>(() =>
    remote ? peekWorkerOptionsCache("", remoteLimit, companyKey) ?? [] : [],
  );
  const [remoteLoading, setRemoteLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  const source = remote
    ? remoteRows
    : companyKey
      ? workers.filter((worker) => (worker.company ?? "").trim() === companyKey)
      : workers;
  const selected = useMemo(() => source.find((worker) => worker.id === value) ?? null, [source, value]);

  const filtered = useMemo(() => {
    if (remote) return source;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((worker) => matchQuery(worker, q));
  }, [remote, source, query]);

  const updatePos = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelH = Math.min(320, 48 + Math.min(Math.max(filtered.length, 1), 8) * 56);
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < panelH + 12 && rect.top > panelH + 12;
    setPos({
      top: above ? rect.top - panelH - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
    });
  };

  const runRemoteSearch = (q: string, selectedId: number | null) => {
    const seq = ++searchSeq.current;
    setRemoteLoading(true);
    void loadWorkerOptions({ q, limit: remoteLimit, id: selectedId, company: companyKey })
      .then((rows) => {
        if (seq !== searchSeq.current) return;
        setRemoteRows(rows);
      })
      .catch(() => {
        if (seq !== searchSeq.current) return;
        setRemoteRows([]);
      })
      .finally(() => {
        if (seq === searchSeq.current) setRemoteLoading(false);
      });
  };

  const openPanel = () => {
    updatePos();
    setQuery("");
    setHighlight(0);
    setOpen(true);
    if (remote) {
      const cached = peekWorkerOptionsCache("", remoteLimit, companyKey);
      if (cached?.length) setRemoteRows(cached);
      runRemoteSearch("", value);
    }
  };

  useEffect(() => {
    if (!open || !remote) return;
    const handle = window.setTimeout(() => {
      runRemoteSearch(query.trim(), value);
    }, query.trim() ? 200 : 0);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ search khi đổi query/công ty lúc panel mở
  }, [open, remote, query, companyKey]);

  // Prefetch khi đổi công ty (kể cả lúc panel đóng) để list sẵn sàng.
  useEffect(() => {
    if (!remote) return;
    const cached = peekWorkerOptionsCache("", remoteLimit, companyKey);
    if (cached?.length) setRemoteRows(cached);
    runRemoteSearch("", value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ refetch khi đổi công ty
  }, [remote, companyKey, remoteLimit]);

  // Đảm bảo label người đã chọn hiện khi remote (edit phiếu).
  useEffect(() => {
    if (!remote || value == null) return;
    let alive = true;
    void loadWorkerOptions({ limit: 1, id: value }).then((rows) => {
      if (!alive || rows.length === 0) return;
      setRemoteRows((prev) => {
        if (prev.some((row) => row.id === value)) return prev;
        return [...rows, ...prev];
      });
    });
    return () => {
      alive = false;
    };
  }, [remote, value]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      updatePos();
    };
    const onResize = () => updatePos();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    const onPointer = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered.length]);

  const pick = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openPanel();
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13px] outline-none focus:border-[#0052cc]",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-400",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-slate-400")}>
          {selected ? labelOf(selected) : placeholder || "Chọn người lao động"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value != null && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
              }}
            >
              ×
            </span>
          )}
          <span className="text-[11px] text-slate-400">▾</span>
        </span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[100] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 300) }}
          >
            <div className="border-b border-slate-100 p-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlight((current) => Math.max(current - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const hit = filtered[highlight];
                    if (hit) pick(hit.id);
                  }
                }}
                placeholder="Gõ để tìm tên, mã, SĐT..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
              />
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1">
              {remoteLoading && filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-[12.5px] text-slate-400">Đang tìm...</p>
              )}
              {!remoteLoading && filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-[12.5px] text-slate-400">Không tìm thấy người lao động.</p>
              )}
              {filtered.map((worker, index) => {
                const active = worker.id === value;
                return (
                  <button
                    key={worker.id}
                    type="button"
                    onClick={() => pick(worker.id)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
                      index === highlight ? "bg-[#0052cc]/10" : "bg-white",
                      active && "ring-1 ring-inset ring-[#0052cc]/40",
                    )}
                  >
                    {showAvatar && (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0052cc]/10 text-[12px] font-bold text-[#0052cc]">
                        {worker.full_name.trim().slice(-1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">{worker.full_name}</span>
                      <span className="block truncate text-[12px] text-slate-500">
                        {worker.code}
                        {worker.company ? ` · ${worker.company}` : ""}
                        {worker.phone ? ` · ${worker.phone}` : ""}
                      </span>
                    </span>
                    {active && <span className="shrink-0 text-[13px] font-bold text-[#0052cc]">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11.5px] text-slate-500">
              {remote
                ? `${filtered.length} kết quả${remoteLoading ? " · đang tìm..." : ""} · gõ để lọc server`
                : `${filtered.length}/${workers.length} người lao động · Enter để chọn · Esc để đóng`}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
