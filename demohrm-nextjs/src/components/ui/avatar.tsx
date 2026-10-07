import { cn } from "@/lib/utils";

const avatarTones: Record<string, string> = {
  "avatar-blue": "bg-blue-100 text-blue-700",
  "avatar-rose": "bg-rose-100 text-rose-700",
  "avatar-indigo": "bg-indigo-100 text-indigo-700",
  "avatar-purple": "bg-purple-100 text-purple-700",
  "avatar-emerald": "bg-emerald-100 text-emerald-700",
  "avatar-amber": "bg-amber-100 text-amber-700",
  "avatar-teal": "bg-teal-100 text-teal-700",
  "avatar-cyan": "bg-cyan-100 text-cyan-700",
  blue: "bg-blue-600 text-white",
  teal: "bg-teal-600 text-white",
  green: "bg-emerald-600 text-white",
  purple: "bg-violet-600 text-white",
  indigo: "bg-indigo-600 text-white",
  cyan: "bg-cyan-600 text-white",
  pink: "bg-pink-600 text-white",
  amber: "bg-amber-500 text-white",
};

export function Avatar({ tone = "avatar-blue", size = "md", className, children }: { tone?: string; size?: "xs" | "sm" | "md" | "lg"; className?: string; children: React.ReactNode }) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-7 w-7 text-[11px]",
    md: "h-9 w-9 text-[13px]",
    lg: "h-14 w-14 text-[20px]",
  };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold",
        avatarTones[tone] ?? "bg-slate-200 text-slate-700",
        sizes[size],
        className
      )}
    >
      {children}
    </div>
  );
}
