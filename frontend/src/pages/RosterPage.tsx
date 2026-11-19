// Generate the roster and look at it company / pod / brand / process / employee wise.
import { useState } from "react";
import { api, Employee, Entry } from "../api";
import { DAY_NAMES, useApp } from "../data";
import RosterGrid, { Legend, STATUS_STYLE } from "../components/RosterGrid";
import CoverageGrid from "../components/CoverageGrid";
import CellEditor from "../components/CellEditor";
import ConflictList from "../components/ConflictList";

type View = "company" | "pod" | "brand" | "process" | "employee";
const VIEW_LABEL: Record<View, string> = { company: "Whole company", pod: "By pod", brand: "By brand", process: "By process", employee: "By person" };

export default function RosterPage() {
  const { month, lookups, roster, reload, setRoster } = useApp();
  const [view, setView] = useState<View>("company");
  const [selected, setSelected] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [keepManual, setKeepManual] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [cell, setCell] = useState<{ emp: Employee; day: string; entry?: Entry } | null>(null);

  if (!lookups) return <p className="hint">Loading…</p>;
  const { pods, brands, processes, bps, assignments } = lookups;
  // pod by pod, lead first
  const employees = [...lookups.employees].sort((a, b) =>
    (a.pod_id ?? 99) - (b.pod_id ?? 99) || Number(b.is_pod_lead) - Number(a.is_pod_lead) || a.name.localeCompare(b.name));

  async function generate() {
    setBusy(true); setMsg("");
    try {
      setRoster(await api.generate(month, fromDate || null, keepManual));
      setMsg("Roster generated. Check the conflicts below before publishing.");
    } catch (e) { setMsg(`Couldn't generate: ${e}`); } finally { setBusy(false); }
  }

  async function publish() {
    const hard = roster?.summary.hard ?? 0;
    const force = hard > 0 && confirm(`${hard} must-fix conflict(s) are still open. Publish anyway?`);
    if (hard > 0 && !force) { setMsg(`Not published: ${hard} must-fix conflict(s) are still open.`); return; }
    try { await api.publish(month, force); await reload(); setMsg("Published."); } catch (e) { setMsg(`Couldn't publish: ${e}`); }
  }

  // ----- decide which employees / brand-processes this view shows -----
  const empIdsOnBps = (bpIds: number[]) =>
    new Set(assignments.filter((a) => bpIds.includes(a.brand_process_id)).map((a) => a.employee_id));
  let viewEmps = employees;
  let viewBps = bps;
  let options: { id: number; name: string }[] = [];
  let title = `All ${employees.length} people across ${pods.length} pods`;

  if (view === "pod") {
    options = pods.map((p) => ({ id: p.id, name: `${p.name}, led by ${employees.find((e) => e.id === p.lead_employee_id)?.name ?? "nobody"}` }));
    const id = selected ?? pods[0]?.id;
    viewEmps = employees.filter((e) => e.pod_id === id);
    const podBrands = brands.filter((b) => b.pod_id === id).map((b) => b.id);
    viewBps = bps.filter((b) => podBrands.includes(b.brand_id));
    title = `Pod ${options.find((o) => o.id === id)?.name ?? ""}`;
  } else if (view === "brand") {
    options = [...brands].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ id: b.id, name: b.name }));
    const id = selected ?? options[0]?.id;
    viewBps = bps.filter((b) => b.brand_id === id);
    const ids = empIdsOnBps(viewBps.map((b) => b.id));
    viewEmps = employees.filter((e) => ids.has(e.id));
    title = `${brands.find((b) => b.id === id)?.name}, ${ids.size} ${ids.size === 1 ? "person" : "people"} assigned`;
  } else if (view === "process") {
    options = processes.map((p) => ({ id: p.id, name: `${p.code}, ${p.name}` }));
    const id = selected ?? processes[0]?.id;
    viewBps = bps.filter((b) => b.process_id === id);
    const ids = empIdsOnBps(viewBps.map((b) => b.id));
    viewEmps = employees.filter((e) => ids.has(e.id));
    title = options.find((o) => o.id === id)?.name ?? "";
  } else if (view === "employee") {
    options = [...employees].sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({ id: e.id, name: e.name }));
    const id = selected ?? options[0]?.id;
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-line pb-4">
        <div className="mr-auto">
          <h1>Roster for {new Date(month + "-01T00:00:00").toLocaleString("en-IN", { month: "long", year: "numeric" })}</h1>
          {roster ? (
            <p className="hint mt-1">
              Version {roster.roster.version},{" "}
              <span className={roster.roster.status === "PUBLISHED" ? "text-ok font-semibold" : "font-semibold"}>{roster.roster.status.toLowerCase()}</span>.{" "}
              {roster.summary.coverage_pct}% of required shifts covered, {roster.summary.hard} must-fix and {roster.summary.soft} preference conflicts.
            </p>
          ) : <p className="hint mt-1">No roster yet for this month.</p>}
        </div>
        <label className="text-sm text-muted">Regenerate from<br />
          <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="text-sm flex items-center gap-1.5 pb-1.5">
          <input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)} /> Keep manual edits
        </label>
        <button className="btn" disabled={busy} onClick={generate}>{busy ? "Generating…" : roster ? "Regenerate" : "Generate roster"}</button>
        {roster && <>
          <button className="btn-light" onClick={publish}>Publish</button>
          <a className="btn-light" href={`/api/rosters/${month}/export.csv`}>Download CSV</a>
          <a className="btn-light" href={`/api/rosters/${month}/export.xlsx`}>Download Excel</a>
        </>}
        {msg && <p className="w-full text-sm">{msg}</p>}
      </div>

      {roster && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex border border-line" role="tablist">
              {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
                <button key={v} role="tab" aria-selected={view === v}
                  className={`px-3 py-1.5 text-sm border-r border-line last:border-r-0 ${view === v ? "bg-accent text-on-accent font-semibold" : "bg-surface hover:bg-canvas"}`}
                  onClick={() => { setView(v); setSelected(null); }}>
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
            {options.length > 0 && (
              <select aria-label="Choose" className="input" value={selected ?? options[0]?.id} onChange={(e) => setSelected(Number(e.target.value))}>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>{title}</h2>
              <Legend />
            </div>
            <div className="panel-body space-y-3">
              {view === "employee" && viewEmps[0] && <EmployeeSummary emp={viewEmps[0]} />}
              <p className="hint">Click a day to change it. You'll see the effect before anything is saved.</p>
              <RosterGrid employees={viewEmps} onCellClick={(emp, day, entry) => setCell({ emp, day, entry })} />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Daily cover</h2>
              <span className="hint">Working / required. Red means the client is short that day.</span>
            </div>
            <div className="panel-body"><CoverageGrid bps={viewBps} /></div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Conflicts in this view</h2><span className="hint">{viewConflicts.length} found</span></div>
            <div className="panel-body"><ConflictList conflicts={viewConflicts} /></div>
          </section>
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
    <div className="space-y-2">
      <dl className="flex flex-wrap border border-line">
        {["WORK", "WEEKLY_OFF", "LEAVE", "COMP_OFF", "HOLIDAY"].map((s) => (
          <div key={s} className="px-4 py-2 border-r border-line">
            <dt className="text-xs text-muted">{STATUS_STYLE[s].label}</dt>
            <dd className="text-xl font-semibold">{count(s)}</dd>
          </div>
        ))}
        <div className="px-4 py-2">
          <dt className="text-xs text-muted">Comp-offs owed</dt>
          <dd className="text-xl font-semibold">{owed}</dd>
        </div>
      </dl>
      <p className="text-sm">
        Prefers {emp.preferred_off_day !== null ? DAY_NAMES[emp.preferred_off_day] : "no particular day"} off. Handles{" "}
        {assigned.map((a) => `${bpLabel(a.brand_process_id)}${a.role === "BACKUP" ? " (backup)" : ""}`).join(", ") || "nothing yet"}.
      </p>
    </div>
  );
}
