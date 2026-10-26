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
  xl,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** Extra-wide dialog for spreadsheet-style previews */
  xl?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-hidden rounded-2xl bg-white shadow-2xl",
          xl ? "max-w-[96vw]" : wide ? "max-w-4xl" : "max-w-2xl",
        )}
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
        <div className={cn("max-h-[68vh] overflow-y-auto px-5 py-4", xl && "overflow-x-auto")}>{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // Use div (not label): wrapping custom button/select controls in <label>
  // can double-fire click in some browsers and instantly toggle the panel shut.
  return (
    <div className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-slate-600">{label}</span>
      {children}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] text-slate-900 outline-none focus:border-[#0052cc] focus:ring-2 focus:ring-[#0052cc]/20";
