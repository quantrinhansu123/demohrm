"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { LiveStaff } from "@/lib/live";

interface Props {
  value: number | null;
  onChange: (id: number | null) => void;
  staff: LiveStaff[];
  placeholder?: string;
  inputId?: string;
}

function labelOf(person: LiveStaff): string {
  return `${person.full_name} · ${person.code}`;
}

function matchQuery(person: LiveStaff, q: string): boolean {
  const hay = `${person.full_name} ${person.code} ${person.title ?? ""} ${person.role ?? ""}`.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((part) => hay.includes(part));
}

export function SearchableStaffSelect({ value, onChange, staff, placeholder, inputId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, above: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => staff.find((s) => s.id === value) ?? null, [staff, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => matchQuery(s, q));
  }, [staff, query]);

  const updatePos = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelH = Math.min(320, 48 + Math.min(filtered.length, 8) * 52);
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < panelH + 12 && rect.top > panelH + 12;
    setPos({
      top: above ? rect.top - panelH - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      above,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onScroll = () => setOpen(false);
    const onResize = () => updatePos();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    // Đóng khi scroll (kể cả scroll trong modal) để không lệch vị trí
    window.addEventListener("scroll", onScroll, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open ]);

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
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13.5px] text-slate-900 outline-none",
          "focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/20"
        )}
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>
          {selected ? labelOf(selected) : (placeholder ?? "— Chọn người phụ trách —")}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Xóa lựa chọn"
              className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                pick(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
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
            style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 280) }}
          >
            <div className="border-b border-slate-100 p-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const hit = filtered[highlight];
                    if (hit) pick(hit.id);
                  }
                }}
                placeholder="Gõ để tìm tên, mã NV, chức danh..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
              />
            </div>
            <div className="max-h-[260px] overflow-y-auto p-1">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-[12.5px] text-slate-400">Không tìm thấy nhân sự.</p>
              )}
              {filtered.map((person, idx) => {
                const active = person.id === value;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => pick(person.id)}
                    onMouseEnter={() => setHighlight(idx)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
                      idx === highlight ? "bg-[#0052cc]/10" : "bg-white",
                      active && "ring-1 ring-inset ring-[#0052cc]/40"
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0052cc]/10 text-[12px] font-bold text-[#0052cc]">
                      {person.full_name.trim().slice(-1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-900">{person.full_name}</span>
                      <span className="block truncate text-[12px] text-slate-500">
                        {person.code}
                        {person.title ? ` · ${person.title}` : ""}
                      </span>
                    </span>
                    {active && <span className="shrink-0 text-[13px] font-bold text-[#0052cc]">✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11.5px] text-slate-500">
              {filtered.length}/{staff.length} nhân sự · Enter để chọn · Esc để đóng
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
