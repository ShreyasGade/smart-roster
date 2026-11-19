// Generate the roster and look at it company / pod / brand / process / employee wise.
import { useState } from "react";
import { api, Employee, Entry } from "../api";
import { DAY_NAMES, useApp } from "../data";
import RosterGrid, { Legend, STATUS_STYLE } from "../components/RosterGrid";
import CoverageGrid from "../components/CoverageGrid";
import CellEditor from "../components/CellEditor";
import ConflictList from "../components/ConflictList";

type View = "company" | "pod" | "brand" | "process" | "employee";

export default function RosterPage() {
  const { month, lookups, roster, reload, setRoster } = useApp();
  const [view, setView] = useState<View>("company");
  const [selected, setSelected] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [keepManual, setKeepManual] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [cell, setCell] = useState<{ emp: Employee; day: string; entry?: Entry } | null>(null);

  if (!lookups) return <p>Loading...</p>;
  const { employees, pods, brands, processes, bps, assignments } = lookups;

  async function generate() {
    setBusy(true); setMsg("");
    try {
      setRoster(await api.generate(month, fromDate || null, keepManual));
      setMsg("Roster generated. Review the conflicts below before publishing.");
    } catch (e) { setMsg(String(e)); } finally { setBusy(false); }
  }

  async function publish() {
    const hard = roster?.summary.hard ?? 0;
    const force = hard > 0 && confirm(`${hard} HARD conflict(s) are still open. Publish anyway?`);
    if (hard > 0 && !force) return;
    try { await api.publish(month, force); await reload(); setMsg("Roster published."); } catch (e) { setMsg(String(e)); }
  }

  // ----- decide which employees / brand-processes this view shows -----
  const empIdsOnBps = (bpIds: number[]) =>
    new Set(assignments.filter((a) => bpIds.includes(a.brand_process_id)).map((a) => a.employee_id));
  let viewEmps = employees;
  let viewBps = bps;
  let options: { id: number; name: string }[] = [];
  let title = "All employees, all pods";

  if (view === "pod") {
    options = pods.map((p) => ({ id: p.id, name: `${p.name} (lead: ${employees.find((e) => e.id === p.lead_employee_id)?.name ?? "-"})` }));
    const id = selected ?? pods[0]?.id;
    viewEmps = employees.filter((e) => e.pod_id === id);
    const podBrands = brands.filter((b) => b.pod_id === id).map((b) => b.id);
    viewBps = bps.filter((b) => podBrands.includes(b.brand_id));
    title = options.find((o) => o.id === id)?.name ?? "";
  } else if (view === "brand") {
    options = brands.map((b) => ({ id: b.id, name: b.name }));
    const id = selected ?? brands[0]?.id;
    viewBps = bps.filter((b) => b.brand_id === id);
    const ids = empIdsOnBps(viewBps.map((b) => b.id));
    viewEmps = employees.filter((e) => ids.has(e.id));
    title = `${brands.find((b) => b.id === id)?.name}: ${ids.size} assigned employee(s)`;
  } else if (view === "process") {
    options = processes.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}` }));
    const id = selected ?? processes[0]?.id;
    viewBps = bps.filter((b) => b.process_id === id);
    const ids = empIdsOnBps(viewBps.map((b) => b.id));
    viewEmps = employees.filter((e) => ids.has(e.id));
    title = options.find((o) => o.id === id)?.name ?? "";
  } else if (view === "employee") {
    options = employees.map((e) => ({ id: e.id, name: e.name }));
    const id = selected ?? employees[0]?.id;
    viewEmps = employees.filter((e) => e.id === id);
    const mine = assignments.filter((a) => a.employee_id === id).map((a) => a.brand_process_id);
    viewBps = bps.filter((b) => mine.includes(b.id));
    title = employees.find((e) => e.id === id)?.name ?? "";
  }
  const empSet = new Set(viewEmps.map((e) => e.id));
  const bpSet = new Set(viewBps.map((b) => b.id));
  const viewConflicts = (roster?.conflicts ?? []).filter((c) =>
    view === "company" || (c.emp_id && empSet.has(c.emp_id)) || (c.bp_id && bpSet.has(c.bp_id)));

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Roster {month}</h1>
          {roster ? (
            <p className="text-sm text-slate-500">
              Version {roster.roster.version} · <b className={roster.roster.status === "PUBLISHED" ? "text-green-700" : "text-amber-700"}>{roster.roster.status}</b>
              {" "}· coverage {roster.summary.coverage_pct}% · {roster.summary.hard} hard / {roster.summary.soft} soft conflicts
            </p>
          ) : <p className="text-sm text-slate-500">Not generated yet.</p>}
        </div>
        <label className="text-sm">Regenerate from (optional)<br />
          <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)} /> keep manual edits
        </label>
        <button className="btn" disabled={busy} onClick={generate}>{busy ? "Generating..." : roster ? "Regenerate" : "Generate roster"}</button>
        {roster && <>
          <button className="btn-light" onClick={publish}>Publish</button>
          <a className="btn-light" href={`/api/rosters/${month}/export.csv`}>CSV</a>
          <a className="btn-light" href={`/api/rosters/${month}/export.xlsx`}>Excel</a>
        </>}
        {msg && <p className="w-full text-sm text-blue-800">{msg}</p>}
      </div>

      {roster && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            {(["company", "pod", "brand", "process", "employee"] as View[]).map((v) => (
              <button key={v} className={view === v ? "btn" : "btn-light"} onClick={() => { setView(v); setSelected(null); }}>
                {v[0].toUpperCase() + v.slice(1)} view
              </button>
            ))}
            {options.length > 0 && (
              <select className="input" value={selected ?? options[0]?.id} onChange={(e) => setSelected(Number(e.target.value))}>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>

          <div className="card space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="font-semibold">{title}</h2>
              <Legend />
            </div>
            <p className="text-xs text-slate-500">Click any cell to edit it. The system checks the impact before saving.</p>
            {view === "employee" && viewEmps[0] && <EmployeeSummary emp={viewEmps[0]} />}
            <RosterGrid employees={viewEmps} onCellClick={(emp, day, entry) => setCell({ emp, day, entry })} />
          </div>

          <div className="card space-y-2">
            <h2 className="font-semibold">Daily coverage (working / required)</h2>
            <CoverageGrid bps={viewBps} />
          </div>

          <div className="card space-y-2">
            <h2 className="font-semibold">Conflicts in this view ({viewConflicts.length})</h2>
            <ConflictList conflicts={viewConflicts} />
          </div>
        </>
      )}
      {cell && <CellEditor {...cell} onClose={() => setCell(null)} />}
    </div>
  );
}

function EmployeeSummary({ emp }: { emp: Employee }) {
  const { roster, bpLabel, lookups } = useApp();
  const mine = roster?.entries.filter((e) => e.emp_id === emp.id) ?? [];
  const count = (s: string) => mine.filter((e) => e.status === s).length;
  const owed = mine.filter((e) => e.status === "WORK" && roster?.holidays[e.date]).length;
  const assigned = lookups?.assignments.filter((a) => a.employee_id === emp.id) ?? [];
  return (
    <div className="text-sm grid grid-cols-2 md:grid-cols-4 gap-2">
      {["WORK", "WEEKLY_OFF", "LEAVE", "COMP_OFF", "HOLIDAY"].map((s) => (
        <div key={s} className={`rounded p-2 ${STATUS_STYLE[s].cls}`}>{STATUS_STYLE[s].label}: <b>{count(s)}</b></div>
      ))}
      <div className="rounded p-2 bg-yellow-100">Comp-offs owed: <b>{owed}</b></div>
      <div className="col-span-2 rounded p-2 bg-slate-100">
        Preferred off: {emp.preferred_off_day !== null ? DAY_NAMES[emp.preferred_off_day] : "none"} ·{" "}
        {assigned.map((a) => `${bpLabel(a.brand_process_id)}${a.role === "BACKUP" ? " (backup)" : ""}`).join(", ") || "no assignments"}
      </div>
    </div>
  );
}
