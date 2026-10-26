"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { LiveWorkerRow } from "@/lib/live";

interface Props {
  value: number | null;
  onChange: (id: number | null) => void;
  workers: LiveWorkerRow[];
  placeholder?: string;
  inputId?: string;
  disabled?: boolean;
  /** Mặc định hiện avatar chữ cái; tắt khi dùng làm form gọn. */
  showAvatar?: boolean;
}

function labelOf(worker: LiveWorkerRow): string {
  return `${worker.full_name} (${worker.code})`;
}

function matchQuery(worker: LiveWorkerRow, q: string): boolean {
  const hay = `${worker.full_name} ${worker.code} ${worker.phone} ${worker.company ?? ""} ${worker.current_position ?? ""}`.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((part) => hay.includes(part));
}

export function SearchableWorkerSelect({ value, onChange, workers, placeholder, inputId, disabled, showAvatar = true }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => workers.find((worker) => worker.id === value) ?? null, [workers, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((worker) => matchQuery(worker, q));
  }, [workers, query]);

  const updatePos = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelH = Math.min(320, 48 + Math.min(filtered.length, 8) * 56);
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < panelH + 12 && rect.top > panelH + 12;
    setPos({
      top: above ? rect.top - panelH - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
    });
  };

  const openPanel = () => {
    updatePos();
    setQuery("");
    setHighlight(0);
    setOpen(true);
  };

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
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (id: number | null) => {
    onChange(id);
    setQuery("");
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
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13.5px] text-slate-900 outline-none",
          "focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/20",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
        )}
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>
          {selected ? labelOf(selected) : placeholder ?? "Chọn người lao động"}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Xóa lựa chọn"
              className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={(event) => {
                event.stopPropagation();
                pick(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  pick(null);
                }
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
                placeholder="Gõ để tìm tên, mã, SĐT, công ty..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
              />
            </div>
            <div className="max-h-[280px] overflow-y-auto p-1">
              {filtered.length === 0 && (
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
              {filtered.length}/{workers.length} người lao động · Enter để chọn · Esc để đóng
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
