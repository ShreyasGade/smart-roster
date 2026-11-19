// Change handling: someone becomes unavailable after the roster was generated.
// Preview shows the impact on every brand they handle, plus ranked fixes; Apply saves it.
import { useState } from "react";
import { api, Impact } from "../api";
import { monthDays, useApp } from "../data";
import ConflictList from "../components/ConflictList";

export default function ChangeSimulator() {
  const { month, lookups, roster, reload, bpLabel } = useApp();
  const [empId, setEmpId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("UNAVAILABLE");
  const [impact, setImpact] = useState<Impact | null>(null);
  const [error, setError] = useState("");

  if (!lookups) return <p>Loading...</p>;
  if (!roster) return <p>No roster for {month} yet.</p>;
  const emp = lookups.employees.find((e) => e.id === (empId ?? lookups.employees[0]?.id));
  const days = monthDays(month);
  const start = from || days[0];
  const dates = days.filter((d) => d >= start && d <= (to || start));
  const assigned = lookups.assignments.filter((a) => a.employee_id === emp?.id);

  async function run(apply: boolean) {
    if (!emp) return;
    setError("");
    try {
      const res = await api.unavailable(month, emp.id, dates, type, apply);
      setImpact(res);
      if (apply) await reload();
    } catch (e) { setError(String(e)); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Change simulator</h1>
      <p className="text-sm text-slate-600">
        What happens if someone becomes unavailable after the roster is generated? Preview the impact first;
        nothing is saved until you click Apply.
      </p>
      <div className="card flex flex-wrap gap-3 items-end">
        <label className="text-sm">Employee<br />
          <select className="input" value={emp?.id} onChange={(e) => { setEmpId(Number(e.target.value)); setImpact(null); }}>
            {lookups.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="text-sm">From<br />
          <input type="date" className="input" min={days[0]} max={days[days.length - 1]} value={start} onChange={(e) => { setFrom(e.target.value); setImpact(null); }} />
        </label>
        <label className="text-sm">To (optional)<br />
          <input type="date" className="input" min={start} max={days[days.length - 1]} value={to} onChange={(e) => { setTo(e.target.value); setImpact(null); }} />
        </label>
        <label className="text-sm">Reason<br />
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="UNAVAILABLE">Unavailable (sick / emergency)</option>
            <option value="LEAVE">Approved leave</option>
            <option value="COMP_OFF">Comp-off</option>
          </select>
        </label>
        <button className="btn-light" onClick={() => run(false)}>Preview impact</button>
        <button className="btn" disabled={!impact || impact.applied} onClick={() => run(true)}>Apply change</button>
      </div>
      {emp && (
        <p className="text-sm">
          <b>{emp.name}</b> handles: {assigned.map((a) => `${bpLabel(a.brand_process_id)}${a.role === "BACKUP" ? " (backup)" : ""}`).join(", ") || "nothing"}
        </p>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {impact && (
        <div className="card space-y-3">
          <p className="font-medium">
            {impact.applied ? "Applied. " : "Preview: "}
            {impact.new_conflicts.length === 0
              ? "No new conflicts - the remaining team can maintain the required coverage."
              : `${impact.new_conflicts.length} new conflict(s). Suggested fixes are listed under each one.`}
          </p>
          <ConflictList conflicts={impact.new_conflicts} readOnly={!impact.applied} />
          {impact.applied && impact.new_conflicts.length > 0 && (
            <p className="text-sm text-slate-500">Tip: apply a suggestion above, or regenerate from this date on the Roster page.</p>
          )}
        </div>
      )}
    </div>
  );
}
