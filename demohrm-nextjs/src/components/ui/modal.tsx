"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  badge,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn("max-h-[90vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl", wide ? "max-w-4xl" : "max-w-2xl")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
            {badge}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[12.5px] font-medium text-slate-600">{label}</span>
      {children}
      {error && <p className="mt-1 text-[11.5px] font-medium text-rose-600">{error}</p>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-900 outline-none transition-colors focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/20";

export function getInputClass(error?: string | boolean, extraClass?: string): string {
  return cn(
    "w-full rounded-lg bg-white px-3 py-2 text-[13.5px] text-slate-900 outline-none transition-colors",
    error
      ? "border border-rose-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
      : "border border-slate-200 focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/20",
    extraClass,
  );
}
