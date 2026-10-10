"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [periodRows, companyRows, teamRows, staffRows] = await Promise.all([
        apiGet<LivePeriod[]>("/periods"),
        apiGet<LiveCompany[]>("/companies"),
        apiGet<LiveTeam[]>("/teams"),
        apiGet<LiveStaff[]>("/staff"),
      ]);
      setPeriods(periodRows);
      setCompanies(companyRows);
      setTeams(teamRows);
      setStaff(staffRows);
      setCatalogError("");
      const openMonth = periodRows.find((p) => p.status === "open" && p.type === "month");
      setPeriodCode((prev) => prev || openMonth?.code || periodRows[0]?.code || "");
      setCurrentFactory((prev) => prev || companyRows[0]?.short_name || "");
      setCurrentTeam((prev) => prev || teamRows[0]?.code || "");
    } catch {
      setCatalogError("Không tải được danh mục (kỳ, công ty, nhóm).");
    } finally {
      setCatalogLoading(false);
    }
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
    }),
    [currentModule, currentTeam, currentFactory, periodCode, periods, companies, teams, staff, catalogError, catalogLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
