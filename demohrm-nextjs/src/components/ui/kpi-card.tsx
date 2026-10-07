import { cn } from "@/lib/utils";

export function KpiCard({
  title,
  value,
  sub,
  extra,
  valueClassName,
  className,
  children,
}: {
  title: string;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  extra?: React.ReactNode;
  valueClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-sm", className)}>
      <div className="text-[11px] font-semibold tracking-wide text-slate-500">{title}</div>
      {value !== undefined && (
        <div className={cn("mt-1 text-[26px] font-bold leading-tight text-slate-900", valueClassName)}>
          {value}
        </div>
      )}
      {sub !== undefined && <div className="mt-1 text-[12.5px] text-slate-500">{sub}</div>}
      {extra}
      {children}
    </div>
  );
}

export function ProgressBar({ value, tone = "green", className }: { value: number; tone?: "green" | "blue" | "amber"; className?: string }) {
  const bar = tone === "blue" ? "bg-[#0052cc]" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500";
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
