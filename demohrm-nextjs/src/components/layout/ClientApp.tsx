"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(() => import("@/components/layout/AppShell").then((m) => m.AppShell), {
  ssr: false,
  loading: () => (
    <p className="grid min-h-screen place-items-center text-[13px] text-slate-500">Đang kiểm tra phiên...</p>
  ),
});

export function ClientApp() {
  return <AppShell />;
}
