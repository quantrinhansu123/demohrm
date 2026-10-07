"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiPost } from "@/lib/api";
import { accessFor } from "@/lib/access";
import type { Access } from "@/lib/access";

const SESSION_KEY = "tw_session";

export interface SessionStaff {
  id: number;
  code: string;
  full_name: string;
  role: string;
  title: string | null;
}

interface SessionState {
  ready: boolean;
  staff: SessionStaff | null;
  access: Access;
  login: (code: string, pin: string) => Promise<void>;
  logout: () => void;
}

const EMPTY_ACCESS: Access = {
  canViewFinance: false,
  canViewCommission: false,
  canViewAudit: false,
  canViewCccd: false,
  canClosePeriod: false,
};

const SessionContext = createContext<SessionState | null>(null);

function readStored(): SessionStaff | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; staff?: SessionStaff };
    if (!parsed.token || !parsed.staff?.id) return null;
    return parsed.staff;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState<SessionStaff | null>(null);

  useEffect(() => {
    const onExpired = () => setStaff(null);
    window.addEventListener("tw-unauthorized", onExpired);
    const t = window.setTimeout(() => {
      setStaff(readStored());
      setReady(true);
    }, 0);
    return () => {
      window.removeEventListener("tw-unauthorized", onExpired);
      window.clearTimeout(t);
    };
  }, []);

  const login = async (code: string, pin: string) => {
    const res = await apiPost<{ token: string; staff: SessionStaff }>("/auth/login", { code, pin });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: res.token, staff: res.staff }));
    setStaff(res.staff);
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setStaff(null);
  };

  const value = useMemo<SessionState>(
    () => ({
      ready,
      staff,
      access: staff ? accessFor(staff.role) : EMPTY_ACCESS,
      login,
      logout,
    }),
    [ready, staff]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

export function loginError(e: unknown): string {
  return e instanceof ApiError ? e.message : "Không đăng nhập được.";
}
