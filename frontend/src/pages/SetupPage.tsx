// Setup data: pods, employees, processes, brands, brand rules, assignments, holidays, leaves.
// Everything is editable here, so no code changes are needed to add brands, people or rules.
import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../data";
import CrudTable, { Column } from "../components/CrudTable";

const TABS = ["Employees", "Pods", "Brands", "Brand rules", "Assignments", "Processes", "Holidays", "Leaves"] as const;

export default function SetupPage() {
  const { lookups, bpLabel, reload } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Employees");
  const [holidays, setHolidays] = useState<Record<string, unknown>[]>([]);
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    api.list<Record<string, unknown>>("holidays").then(setHolidays);
    api.list<Record<string, unknown>>("leaves").then(setLeaves);
  }, [lookups]);

  if (!lookups) return <p className="hint">Loading…</p>;
  const { pods, employees, processes, brands, bps, assignments } = lookups;
  const opt = <T extends { id: number }>(rows: T[], label: (r: T) => string) => rows.map((r) => ({ value: r.id, label: label(r) }));
  const podOpts = opt(pods, (p) => p.name);
  const empOpts = opt(employees, (e) => e.name);
  const procOpts = opt(processes, (p) => p.code);
  const brandOpts = opt(brands, (b) => b.name);
  const bpOpts = bps.map((b) => ({ value: b.id, label: bpLabel(b.id) }));

  const tables: Record<string, { table: string; rows: object[]; columns: Column[]; help?: string }> = {
    Employees: {
      table: "employees", rows: employees,
      columns: [
        { key: "name", label: "Name" },
        { key: "pod_id", label: "Pod", type: "select", options: podOpts },
        { key: "is_pod_lead", label: "Pod lead", type: "bool", default: false },
        { key: "preferred_off_day", label: "Preferred off", type: "weekday" },
        { key: "weekly_offs_per_week", label: "Offs/week", type: "number", default: 1 },
        { key: "max_parallel_processes", label: "Max processes/day", type: "number", default: 4 },
        { key: "skill_process_ids", label: "Extra skills (can cover)", type: "multiselect", options: procOpts, default: [] },
        { key: "active", label: "Active", type: "bool", default: true },
      ],
      help: "Skills decide who can be suggested as a backup.",
    },
    Pods: {
      table: "pods", rows: pods,
      columns: [{ key: "name", label: "Name" }, { key: "lead_employee_id", label: "Pod lead", type: "select", options: empOpts }],
    },
    Brands: {
      table: "brands", rows: brands,
      columns: [{ key: "name", label: "Name" }, { key: "pod_id", label: "Pod", type: "select", options: podOpts }],
      help: "Add the processes a brand runs under 'Brand rules'.",
    },
    "Brand rules": {
      table: "brand-processes", rows: bps,
      columns: [
        { key: "brand_id", label: "Brand", type: "select", options: brandOpts },
        { key: "process_id", label: "Process", type: "select", options: procOpts },
        {
          key: "calendar_preset", label: "Operating calendar", type: "select", default: "ALL_DAYS",
          options: [
            { value: "ALL_DAYS", label: "365 days (incl. Sundays & holidays)" },
            { value: "NO_HOLIDAYS", label: "Every day except public holidays" },
            { value: "NO_SUN_NO_HOLIDAYS", label: "Sundays & public holidays off" },
            { value: "CUSTOM", label: "Custom (pick weekdays)" },
          ],
        },
        { key: "operating_weekdays", label: "Weekdays (custom)", type: "weekdays", default: [0, 1, 2, 3, 4] },
        { key: "works_on_holidays", label: "Holidays (custom)", type: "bool", default: false },
        { key: "min_staff", label: "Min staff", type: "number", default: 1 },
        { key: "min_staff_overrides", label: "Overrides", type: "json", default: {} },
        {
          key: "shift", label: "Shift", type: "select", default: "GENERAL",
          options: ["GENERAL", "MORNING", "EVENING"].map((s) => ({ value: s, label: s })),
        },
      ],
      help: 'Overrides example: {"weekday:5": 2, "date:2026-12-24": 3} (weekday 0=Mon .. 6=Sun).',
    },
    Assignments: {
      table: "assignments", rows: assignments,
      columns: [
        { key: "employee_id", label: "Employee", type: "select", options: empOpts },
        { key: "brand_process_id", label: "Brand - process", type: "select", options: bpOpts },
        { key: "role", label: "Role", type: "select", default: "PRIMARY", options: [{ value: "PRIMARY", label: "PRIMARY" }, { value: "BACKUP", label: "BACKUP (auto-covers gaps)" }] },
      ],
    },
    Processes: {
      table: "processes", rows: processes,
      columns: [{ key: "code", label: "Code" }, { key: "name", label: "Name" }],
    },
    Holidays: {
      table: "holidays", rows: holidays,
      columns: [{ key: "date", label: "Date", type: "date" }, { key: "name", label: "Name" }],
    },
    Leaves: {
      table: "leaves", rows: leaves,
      columns: [
        { key: "employee_id", label: "Employee", type: "select", options: empOpts },
        { key: "date", label: "Date", type: "date" },
        { key: "type", label: "Type", type: "select", default: "LEAVE", options: ["LEAVE", "COMP_OFF", "UNAVAILABLE"].map((s) => ({ value: s, label: s })) },
        { key: "status", label: "Status", type: "select", default: "APPROVED", options: ["APPROVED", "PENDING"].map((s) => ({ value: s, label: s })) },
        { key: "note", label: "Note" },
      ],
      help: "After changing leaves, regenerate the roster (or use the Change simulator for one-off changes).",
    },
  };
  const t = tables[tab];

  return (
    <div className="space-y-5">
      <div className="border-b border-line pb-4">
        <h1>Setup</h1>
        <p className="mt-1">People, brands and rules the roster is built from. Regenerate the roster after big changes.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap border border-line" role="tablist">
          {TABS.map((name) => (
            <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}
              className={`px-3 py-1.5 text-sm border-r border-line last:border-r-0 ${tab === name ? "bg-accent text-on-accent font-semibold" : "bg-surface hover:bg-canvas"}`}>
              {name}
            </button>
          ))}
        </div>
        <button className="btn-light ml-auto" onClick={reload}>Reload</button>
      </div>
      <div className="panel panel-body">
        <CrudTable key={tab} table={t.table} rows={t.rows} columns={t.columns} help={t.help} />
      </div>
    </div>
  );
}
