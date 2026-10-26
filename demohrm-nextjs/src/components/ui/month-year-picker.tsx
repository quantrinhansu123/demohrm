"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  { value: "01", label: "01" },
  { value: "02", label: "02" },
  { value: "03", label: "03" },
  { value: "04", label: "04" },
  { value: "05", label: "05" },
  { value: "06", label: "06" },
  { value: "07", label: "07" },
  { value: "08", label: "08" },
  { value: "09", label: "09" },
  { value: "10", label: "10" },
  { value: "11", label: "11" },
  { value: "12", label: "12" },
] as const;

function parseMonthCode(value: string): { year: number; month: string } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: match[2] };
}

function toDisplay(value: string): string {
  const parsed = parseMonthCode(value);
  if (!parsed) return "";
  return `${parsed.month}/${parsed.year}`;
}

export function MonthYearPicker({
  value,
  onChange,
  placeholder = "mm/yyyy",
  className,
}: {
  /** YYYY-MM hoặc rỗng */
  value: string;
  onChange: (monthCode: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const parsed = parseMonthCode(value);
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? new Date().getFullYear());

  useEffect(() => {
    if (!open) return;
    const next = parseMonthCode(value);
    setViewYear(next?.year ?? new Date().getFullYear());
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-40 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13px] outline-none hover:border-slate-300 focus:border-[#0052cc]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "font-medium text-slate-800" : "text-slate-400"}>
          {value ? toDisplay(value) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              onClick={() => setViewYear((year) => year - 1)}
              aria-label="Năm trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[13px] font-semibold text-slate-800">{viewYear}</span>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              onClick={() => setViewYear((year) => year + 1)}
              aria-label="Năm sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((month) => {
              const code = `${viewYear}-${month.value}`;
              const selected = value === code;
              return (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => {
                    onChange(code);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-lg px-2 py-2 text-[13px] font-medium transition",
                    selected
                      ? "bg-[#0052cc] text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {month.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">Định dạng hiển thị: mm/yyyy</p>
        </div>
      ) : null}
    </div>
  );
}
