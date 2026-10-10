import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "info" | "danger" | "neutral";

const tones: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusPill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function statusToneForWorker(status: string): Tone {
  if (status === "Chờ đi làm") return "warning";
  if (status === "Tạm nghỉ" || status === "Ứng viên" || status === "Đang tư vấn") return "info";
  if (status === "Nghỉ việc" || status === "Không đi làm") return "danger";
  return "success";
}

export function statusToneForHealth(health: string): Tone {
  if (health === "Đúng tiến độ") return "success";
  if (health === "Chậm tiến độ") return "warning";
  return "danger";
}
