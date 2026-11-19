// Change handling: someone becomes unavailable after the roster was generated.
// Preview shows the impact on every brand they handle, plus ranked fixes; Apply saves it.
import { useEffect, useState } from "react";
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
  const [fromLink, setFromLink] = useState(false);

  // A link like ?person=Kabir Singh&from=2026-12-16&to=2026-12-17 opens with that scenario already checked
  useEffect(() => {
    if (fromLink || !lookups || !roster) return;
    setFromLink(true);
    const q = new URLSearchParams(window.location.search);
    const person = lookups.employees.find((e) => e.name === q.get("person"));
    const start = q.get("from");
    if (!person || !start) return;
    const end = q.get("to") || start;
    setEmpId(person.id); setFrom(start); setTo(q.get("to") || "");
    const range = monthDays(month).filter((d) => d >= start && d <= end);
    api.unavailable(month, person.id, range, "UNAVAILABLE", false).then(setImpact).catch((e) => setError(String(e)));
  }, [fromLink, lookups, roster, month]);

  if (!lookups) return <p className="hint">Loading…</p>;
  if (!roster) return <p className="hint">No roster for {month} yet.</p>;
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
    <div className="space-y-5">
      <div className="border-b border-line pb-4">
        <h1>What if someone can't come in?</h1>
        <p className="mt-1 max-w-3xl">Pick a person and the days they'll be away. You'll see every brand that loses cover and how to fill it. Nothing is saved until you apply it.</p>
      </div>
      <div className="panel panel-body flex flex-wrap gap-3 items-end">
        <label className="text-sm text-muted">Person<br />
          <select className="input" value={emp?.id} onChange={(e) => { setEmpId(Number(e.target.value)); setImpact(null); }}>
            {lookups.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-muted">From<br />
          <input type="date" className="input" min={days[0]} max={days[days.length - 1]} value={start} onChange={(e) => { setFrom(e.target.value); setImpact(null); }} />
        </label>
        <label className="text-sm text-muted">Until (optional)<br />
          <input type="date" className="input" min={start} max={days[days.length - 1]} value={to} onChange={(e) => { setTo(e.target.value); setImpact(null); }} />
        </label>
        <label className="text-sm text-muted">Reason<br />
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="UNAVAILABLE">Unavailable (sick or emergency)</option>
            <option value="LEAVE">Approved leave</option>
            <option value="COMP_OFF">Comp-off</option>
          </select>
        </label>
        <button className="btn-light" onClick={() => run(false)}>Show impact</button>
        <button className="btn" disabled={!impact || impact.applied} onClick={() => run(true)}>Mark as away</button>
      </div>
      {emp && (
        <p className="text-sm">
          <b>{emp.name}</b> handles {assigned.map((a) => `${bpLabel(a.brand_process_id)}${a.role === "BACKUP" ? " (backup)" : ""}`).join(", ") || "nothing"}.
        </p>
      )}
      {error && <p className="text-sm text-danger">Couldn't check this change: {error}</p>}
      {impact && (
        <section className="panel panel-body space-y-3">
          <p className="font-semibold">
            {impact.applied ? "Saved. " : "If this happens: "}
            {impact.new_conflicts.length === 0
              ? "no new gaps. The rest of the team still covers every brand."
              : `${impact.new_conflicts.length} new conflict(s). Fixes are listed under each one${impact.applied ? "." : "; mark the person as away to apply them."}`}
          </p>
          <ConflictList conflicts={impact.new_conflicts} readOnly={!impact.applied} />
          {impact.applied && impact.new_conflicts.length > 0 && (
            <p className="hint">You can also regenerate from this date on the Roster page.</p>
          )}
        </section>
      )}
    </div>
  );
}
