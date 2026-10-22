"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RowActionItem {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger" | "success";
  disabled?: boolean;
}

export function RowActions({ items, label = "Thao tác" }: { items: RowActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 144 });
    setOpen((value) => !value);
  };

  if (items.length === 0) return <span className="text-slate-400">—</span>;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
        aria-label={label}
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed z-50 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "block w-full px-3 py-1.5 text-left text-[13px] font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                item.tone === "danger" && "text-rose-600 hover:bg-rose-50",
                item.tone === "success" && "text-emerald-600 hover:bg-emerald-50",
                (!item.tone || item.tone === "default") && "text-slate-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
