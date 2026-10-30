"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface Props {
  values: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
  /** Text khi chưa chọn gì — mặc định = placeholder. */
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

function matchOption(option: string, q: string): boolean {
  const hay = option.toLowerCase();
  return q.split(/\s+/).filter(Boolean).every((part) => hay.includes(part));
}

/** Multi-select gợi ý (kiểu Select2), UI khớp filter hiện có của dự án. */
export function SearchableMultiSelect({
  values,
  onChange,
  options,
  placeholder = "Chọn...",
  emptyLabel,
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => matchOption(item, q));
  }, [options, query]);

  const summary = useMemo(() => {
    if (values.length === 0) return emptyLabel || placeholder;
    if (values.length === 1) return values[0];
    if (values.length <= 2) return values.join(", ");
    return `${values.length} công ty`;
  }, [values, emptyLabel, placeholder]);

  const updatePos = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const panelH = Math.min(320, 48 + Math.min(Math.max(filtered.length, 1), 8) * 40);
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

  const toggle = (option: string) => {
    if (selectedSet.has(option)) {
      onChange(values.filter((item) => item !== option));
      return;
    }
    onChange([...values, option]);
  };

  const clearAll = () => onChange([]);

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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openPanel();
        }}
        className={cn(
          "flex min-h-[34px] w-full min-w-[160px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[13px] outline-none focus:border-[#0052cc]",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-400",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", values.length === 0 && "text-slate-400")}>
          {summary}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {values.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              className="grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={(event) => {
                event.stopPropagation();
                clearAll();
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
            style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 260) }}
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
                    if (hit) toggle(hit);
                  }
                }}
                placeholder="Gõ để lọc công ty..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#0052cc]"
              />
            </div>
            {values.length > 0 && (
              <div className="flex flex-wrap gap-1 border-b border-slate-100 px-2 py-1.5">
                {values.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggle(item)}
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-[#0052cc]/10 px-2 py-0.5 text-[12px] font-medium text-[#0052cc]"
                    title="Bỏ chọn"
                  >
                    <span className="truncate">{item}</span>
                    <span className="opacity-70">×</span>
                  </button>
                ))}
              </div>
            )}
            <div className="max-h-[240px] overflow-y-auto p-1">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-[12.5px] text-slate-400">Không tìm thấy công ty.</p>
              )}
              {filtered.map((option, index) => {
                const active = selectedSet.has(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggle(option)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px]",
                      index === highlight ? "bg-[#0052cc]/10" : "bg-white",
                      active && "font-semibold text-[#0052cc]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]",
                        active
                          ? "border-[#0052cc] bg-[#0052cc] text-white"
                          : "border-slate-300 bg-white text-transparent",
                      )}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11.5px] text-slate-500">
              <span>
                {values.length}/{options.length} đã chọn · Enter để chọn
              </span>
              {values.length > 0 && (
                <button type="button" className="font-medium text-[#0052cc] hover:underline" onClick={clearAll}>
                  Bỏ chọn hết
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
