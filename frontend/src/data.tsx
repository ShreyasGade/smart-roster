// Shared app state: selected month, setup data (lookups) and the current roster.
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, Assignment, Brand, BrandProcess, Employee, Pod, Process, RosterReport } from "./api";

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface Lookups {
  pods: Pod[]; employees: Employee[]; processes: Process[]; brands: Brand[];
  bps: BrandProcess[]; assignments: Assignment[];
}

interface AppData {
  month: string;
  setMonth: (m: string) => void;
  lookups: Lookups | null;
  roster: RosterReport | null;
  error: string;
  loading: boolean;
  reload: () => Promise<void>;
  setRoster: (r: RosterReport | null) => void;
  bpLabel: (bpId: number) => string;
  empName: (empId: number | null) => string;
}

const Ctx = createContext<AppData>(null as unknown as AppData);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState("2026-12");
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [roster, setRoster] = useState<RosterReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pods, employees, processes, brands, bps, assignments] = await Promise.all([
        api.list<Pod>("pods"), api.list<Employee>("employees"), api.list<Process>("processes"),
        api.list<Brand>("brands"), api.list<BrandProcess>("brand-processes"), api.list<Assignment>("assignments"),
      ]);
      setLookups({ pods, employees, processes, brands, bps, assignments });
      try {
        setRoster(await api.roster(month));
      } catch {
        setRoster(null); // no roster generated for this month yet
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { reload(); }, [reload]);

  const bpLabel = (bpId: number) => {
    const bp = lookups?.bps.find((b) => b.id === bpId);
    if (!bp) return `#${bpId}`;
    const brand = lookups?.brands.find((b) => b.id === bp.brand_id)?.name ?? "?";
    const proc = lookups?.processes.find((p) => p.id === bp.process_id)?.code ?? "?";
    return `${brand} - ${proc}`;
  };
  const empName = (empId: number | null) => lookups?.employees.find((e) => e.id === empId)?.name ?? "";

  return (
    <Ctx.Provider value={{ month, setMonth, lookups, roster, error, loading, reload, setRoster, bpLabel, empName }}>
      {children}
    </Ctx.Provider>
  );
}

export function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

// 0 = Monday ... 6 = Sunday (same as Python)
export function weekday(iso: string): number {
  return (new Date(iso + "T00:00:00").getDay() + 6) % 7;
}
