"use client";

import type { ReactNode } from "react";

export function QueryState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string;
  children: ReactNode;
}) {
  if (loading) {
    return <p className="min-h-40 p-6 text-[13px] text-slate-500">Đang tải dữ liệu...</p>;
  }
  if (error) {
    return <p className="m-6 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>;
  }
  return children;
}
