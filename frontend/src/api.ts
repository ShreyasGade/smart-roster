// Tiny API client + shared types. All calls go to the FastAPI backend under /api.

export type Status = "WORK" | "WEEKLY_OFF" | "LEAVE" | "COMP_OFF" | "HOLIDAY" | "IDLE";

export interface Pod { id: number; name: string; lead_employee_id: number | null }
export interface Employee {
  id: number; name: string; email: string; pod_id: number | null; is_pod_lead: boolean;
  weekly_offs_per_week: number; preferred_off_day: number | null; max_parallel_processes: number;
  skill_process_ids: number[]; active: boolean;
}
export interface Process { id: number; code: string; name: string }
export interface Brand { id: number; name: string; pod_id: number | null }
export interface BrandProcess {
  id: number; brand_id: number; process_id: number; calendar_preset: string;
  operating_weekdays: number[]; works_on_holidays: boolean; min_staff: number;
  min_staff_overrides: Record<string, number>; shift: string;
}
export interface Assignment { id: number; employee_id: number; brand_process_id: number; role: string }

export interface Entry {
  emp_id: number; date: string; status: Status; bp_ids: number[]; locked: boolean; manual: boolean; note: string;
}
export interface Change { emp_id: number; day: string; status: string; bp_ids: number[]; note?: string }
export interface Suggestion { description: string; changes: Change[] }
export interface Conflict {
  key: string; type: string; severity: "HARD" | "SOFT" | "INFO"; date: string; message: string;
  bp_id: number | null; emp_id: number | null; suggestions: Suggestion[];
}
export interface Coverage { bp_id: number; date: string; staffed: number; required: number }
export interface RosterReport {
  roster: { id: number; month: string; status: string; version: number; generated_at: string };
  entries: Entry[];
  coverage: Coverage[];
  conflicts: Conflict[];
  summary: { hard: number; soft: number; info: number; coverage_pct: number; required_slots: number; covered_slots: number };
  holidays: Record<string, string>;
}
export interface Impact {
  applied: boolean; description: string; new_conflicts: Conflict[]; resolved_conflicts: Conflict[];
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  list: <T,>(table: string) => request<T[]>("GET", `/api/${table}`),
  create: (table: string, row: object) => request("POST", `/api/${table}`, row),
  update: (table: string, id: number, row: object) => request("PUT", `/api/${table}/${id}`, row),
  remove: (table: string, id: number) => request("DELETE", `/api/${table}/${id}`),

  roster: (month: string) => request<RosterReport>("GET", `/api/rosters/${month}`),
  generate: (month: string, from_date: string | null, keep_manual: boolean) =>
    request<RosterReport>("POST", `/api/rosters/${month}/generate`, { from_date, keep_manual }),
  changes: (month: string, changes: Change[], apply: boolean, description = "Manual edit") =>
    request<Impact>("POST", `/api/rosters/${month}/changes`, { changes, apply, description }),
  unavailable: (month: string, emp_id: number, dates: string[], type: string, apply: boolean) =>
    request<Impact>("POST", `/api/rosters/${month}/unavailable`, { emp_id, dates, type, apply }),
  publish: (month: string, force: boolean) =>
    request<{ status: string }>("POST", `/api/rosters/${month}/publish?force=${force}`),
  log: (month: string) => request<{ at: string; description: string }[]>("GET", `/api/rosters/${month}/log`),
};
