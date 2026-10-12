"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { inputClass } from "@/components/ui/modal";

function tidy(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  createLabel,
  onCreate,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  createLabel: string;
  onCreate?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLowerCase();
  const matches = suggestions.filter((item) => !query || item.toLowerCase().includes(query));
  const exact = suggestions.find((item) => item.toLowerCase() === query);
  const canCreate = tidy(value).length > 0 && !exact;

  const choose = (next: string) => {
    onChange(tidy(next));
    setOpen(false);
  };

  return (
    <div>
      <div className="flex gap-1">
        <input
          value={value}
          placeholder={placeholder}
          className={inputClass}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            onChange(exact ?? tidy(value));
            window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              choose(exact ?? value);
            }
          }}
        />
        <button
          type="button"
          aria-label="Mở gợi ý"
          aria-expanded={open}
          className="flex w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-sm">
          {matches.map((item) => (
            <li key={item}>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(item)}
              >
                {item}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[13px] font-semibold text-[#0052cc] hover:bg-slate-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const next = tidy(value);
                  if (onCreate) {
                    onChange(next);
                    setOpen(false);
                    onCreate(next);
                    return;
                  }
                  choose(value);
                }}
              >
                {createLabel}: {tidy(value)}
              </button>
            </li>
          )}
          {matches.length === 0 && !canCreate && (
            <li className="px-3 py-2 text-[13px] text-slate-400">Không có gợi ý</li>
          )}
        </ul>
      )}
    </div>
  );
}
