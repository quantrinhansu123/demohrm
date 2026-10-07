"use client";

import { useEffect, useState } from "react";
import { checkBeHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

// Den trang thai ket noi BE tren header: xanh = thong, do = mat ket noi.
export function ApiStatus() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const r = await checkBeHealth();
      if (alive) setOk(r);
    };
    void ping();
    const t = setInterval(() => void ping(), 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <span
      title={ok === null ? "Dang kiem tra BE..." : ok ? "BE (localhost:4000) dang chay" : "BE mat ket noi — chay `npm run dev` trong demohrm-be"}
      className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-medium text-slate-500"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          ok === null ? "bg-slate-300" : ok ? "bg-emerald-500" : "bg-rose-500"
        )}
      />
      {ok === null ? "BE: ..." : ok ? "BE: OK" : "BE: offline"}
    </span>
  );
}
