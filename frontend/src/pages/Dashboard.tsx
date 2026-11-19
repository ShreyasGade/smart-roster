// Month overview: coverage, conflict counts, who works on a chosen day, brands at risk.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { monthDays, useApp } from "../data";
import { STATUS_STYLE } from "../components/RosterGrid";

export default function Dashboard() {
  const { month, roster, lookups, bpLabel, empName } = useApp();
  const days = monthDays(month);
  const [day, setDay] = useState(days[0]);
  const [log, setLog] = useState<{ at: string; description: string }[]>([]);

  useEffect(() => { setDay(monthDays(month)[0]); }, [month]);
  useEffect(() => { if (roster) api.log(month).then(setLog).catch(() => setLog([])); }, [month, roster]);

  if (!lookups) return <p>Loading...</p>;
  if (!roster) return <p>No roster for {month} yet. Go to <Link className="text-blue-700 underline" to="/roster">Roster</Link> and generate it.</p>;

  const s = roster.summary;
  const dayCov = roster.coverage.filter((c) => c.date === day && c.required > 0);
  const dayEntries = roster.entries.filter((e) => e.date === day);
  const gapsByBrand = new Map<string, number>();
  roster.conflicts.filter((c) => c.severity === "HARD" && c.bp_id).forEach((c) => {
    const brand = bpLabel(c.bp_id!).split(" - ")[0];
    gapsByBrand.set(brand, (gapsByBrand.get(brand) ?? 0) + 1);
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard - {month}</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Coverage" value={`${s.coverage_pct}%`} sub={`${s.covered_slots}/${s.required_slots} brand-process-days`} />
        <Stat label="Hard conflicts" value={s.hard} sub="must fix before publishing" red={s.hard > 0} />
        <Stat label="Soft conflicts" value={s.soft} sub="preferences / comp-offs" />
        <Stat label="Employees" value={lookups.employees.length} sub={`${lookups.pods.length} pods`} />
        <Stat label="Brands" value={lookups.brands.length} sub={`${lookups.bps.length} brand-processes`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Who is working on</h2>
            <select className="input" value={day} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => <option key={d} value={d}>{d}{roster.holidays[d] ? ` (${roster.holidays[d]})` : ""}</option>)}
            </select>
          </div>
          <table className="text-sm w-full">
            <tbody>
              {dayCov.map((c) => {
                const people = dayEntries.filter((e) => e.status === "WORK" && e.bp_ids.includes(c.bp_id)).map((e) => empName(e.emp_id));
                const ok = c.staffed >= c.required;
                return (
                  <tr key={c.bp_id} className="border-b border-slate-100">
                    <td className="py-0.5">{bpLabel(c.bp_id)}</td>
                    <td className={ok ? "text-green-700" : "text-red-600 font-bold"}>{c.staffed}/{c.required}</td>
                    <td className="text-slate-600">{people.join(", ") || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 text-xs pt-2">
            {["WEEKLY_OFF", "LEAVE", "COMP_OFF", "HOLIDAY"].map((st) => {
              const names = dayEntries.filter((e) => e.status === st).map((e) => empName(e.emp_id));
              return names.length ? <span key={st} className={`rounded px-2 py-1 ${STATUS_STYLE[st].cls}`}>{STATUS_STYLE[st].label}: {names.join(", ")}</span> : null;
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-2">Brands with open coverage gaps</h2>
            {gapsByBrand.size === 0 ? <p className="text-sm text-green-700">All brands fully covered.</p> : (
              <ul className="text-sm space-y-1">
                {[...gapsByBrand.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => (
                  <li key={b} className="flex justify-between"><span>{b}</span><span className="text-red-600">{n} gap(s)</span></li>
                ))}
              </ul>
            )}
            <Link to="/conflicts" className="text-sm text-blue-700 underline">Review conflicts and fixes →</Link>
          </div>
          <div className="card">
            <h2 className="font-semibold mb-2">Change log</h2>
            <ul className="text-xs space-y-1 max-h-60 overflow-y-auto">
              {log.map((l, i) => <li key={i}><span className="text-slate-400">{l.at.slice(0, 16).replace("T", " ")}</span> {l.description}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, red }: { label: string; value: string | number; sub: string; red?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${red ? "text-red-600" : ""}`}>{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
