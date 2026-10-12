"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { LiveCompany, LivePeriod, LiveStaff, LiveTeam } from "@/lib/live";
import { moduleFromPath, pathForModule } from "@/lib/routes";
import type { ModuleId } from "@/types/hrm";

interface AppState {
  currentModule: ModuleId;
  setCurrentModule: (m: ModuleId) => void;
  currentTeam: string;
  setCurrentTeam: (t: string) => void;
  currentFactory: string;
  setCurrentFactory: (f: string) => void;
  periodCode: string;
  setPeriodCode: (c: string) => void;
  periods: LivePeriod[];
  companies: LiveCompany[];
  teams: LiveTeam[];
  staff: LiveStaff[];
  catalogError: string;
  catalogLoading: boolean;
  reloadCatalog: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentModule, setModuleState] = useState<ModuleId>(() => moduleFromPath(pathname));

  useEffect(() => {
    setModuleState(moduleFromPath(pathname));
  }, [pathname]);

  const setCurrentModule = useCallback((module: ModuleId) => {
    setModuleState(module);
    const href = pathForModule(module);
    if (pathname !== href) router.push(href);
  }, [pathname, router]);
  const [currentTeam, setCurrentTeam] = useState("");
  const [currentFactory, setCurrentFactory] = useState("");
  const [periodCode, setPeriodCode] = useState("");
  const [periods, setPeriods] = useState<LivePeriod[]>([]);
  const [companies, setCompanies] = useState<LiveCompany[]>([]);
  const [teams, setTeams] = useState<LiveTeam[]>([]);
  const [staff, setStaff] = useState<LiveStaff[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const catalogRequest = useRef(0);

  const loadCatalog = useCallback(async () => {
    const requestId = catalogRequest.current + 1;
    catalogRequest.current = requestId;
    setCatalogLoading(true);
    const load = <T,>(path: string) => apiGet<T[]>(path, { timeoutMs: 60000 });
    const [periodRows, companyRows, teamRows, staffRows] = await Promise.allSettled([
      load<LivePeriod>("/periods"),
      load<LiveCompany>("/companies"),
      load<LiveTeam>("/teams"),
      load<LiveStaff>("/staff"),
    ]);
    if (catalogRequest.current !== requestId) return;
    const failed: string[] = [];
    if (periodRows.status === "fulfilled" && Array.isArray(periodRows.value)) {
      setPeriods(periodRows.value);
      const openMonth = periodRows.value.find((p) => p.status === "open" && p.type === "month");
      setPeriodCode((prev) => prev || openMonth?.code || periodRows.value[0]?.code || "");
    } else {
      failed.push("kỳ");
    }
    if (companyRows.status === "fulfilled" && Array.isArray(companyRows.value)) {
      setCompanies(companyRows.value);
      setCurrentFactory((prev) => prev || companyRows.value[0]?.short_name || "");
    } else {
      failed.push("công ty");
    }
    if (teamRows.status === "fulfilled" && Array.isArray(teamRows.value)) {
      setTeams(teamRows.value);
      setCurrentTeam((prev) => prev || teamRows.value[0]?.code || "");
    } else {
      failed.push("nhóm");
    }
    if (staffRows.status === "fulfilled" && Array.isArray(staffRows.value)) {
      setStaff(staffRows.value);
    } else {
      failed.push("nhân sự");
    }
    setCatalogError(failed.length > 0 ? `Không tải được danh mục (${failed.join(", ")}).` : "");
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const value = useMemo<AppState>(
    () => ({
      currentModule,
      setCurrentModule,
      currentTeam,
      setCurrentTeam,
      currentFactory,
      setCurrentFactory,
      periodCode,
      setPeriodCode,
      periods,
      companies,
      teams,
      staff,
      catalogError,
      catalogLoading,
      reloadCatalog: loadCatalog,
    }),
    [currentModule, currentTeam, currentFactory, periodCode, periods, companies, teams, staff, catalogError, catalogLoading, loadCatalog]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
