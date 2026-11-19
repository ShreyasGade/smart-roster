// Month overview: coverage, conflict counts, who works on a chosen day, brands at risk.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DAY_NAMES, monthDays, useApp, weekday } from "../data";
import { STATUS_STYLE } from "../components/RosterGrid";

export default function Dashboard() {
  const { month, roster, lookups, bpLabel, empName } = useApp();
  const days = monthDays(month);
  const [day, setDay] = useState(days[0]);
  const [log, setLog] = useState<{ at: string; description: string }[]>([]);

  useEffect(() => { setDay(monthDays(month)[0]); }, [month]);
  useEffect(() => { if (roster) api.log(month).then(setLog).catch(() => setLog([])); }, [month, roster]);

  if (!lookups) return <p className="hint">Loading…</p>;
  if (!roster) return (
    <div className="panel panel-body max-w-xl">
      <h1>Nothing rostered for {month} yet</h1>
      <p className="mt-2">Generate the month on the <Link className="text-accent underline" to="/roster">Roster</Link> page.</p>
    </div>
  );

  const s = roster.summary;
  const dayCov = roster.coverage.filter((c) => c.date === day && c.required > 0);
  const dayEntries = roster.entries.filter((e) => e.date === day);
  const gapsByBrand = new Map<string, number>();
  roster.conflicts.filter((c) => c.severity === "HARD" && c.bp_id).forEach((c) => {
    const brand = bpLabel(c.bp_id!).split(" - ")[0];
    gapsByBrand.set(brand, (gapsByBrand.get(brand) ?? 0) + 1);
  });
  const short = dayCov.filter((c) => c.staffed < c.required).length;

  return (
    <div className="space-y-5">
      <h1>{new Date(month + "-01T00:00:00").toLocaleString("en-IN", { month: "long", year: "numeric" })}</h1>

      <dl className="flex flex-wrap panel border-t-4 border-t-accent">
        <Figure label="Required shifts covered" value={`${s.coverage_pct}%`} note={`${s.covered_slots} of ${s.required_slots}`} />
        <Figure label="Must fix" value={s.hard} note="before publishing" alert={s.hard > 0} />
        <Figure label="Preference conflicts" value={s.soft} note="offs and comp-offs" />
        <Figure label="People" value={lookups.employees.length} note={`in ${lookups.pods.length} pods`} />
        <Figure label="Brands" value={lookups.brands.length} note={`running ${lookups.bps.length} processes`} last />
      </dl>

      <div className="grid lg:grid-cols-[3fr_2fr] gap-5 items-start">
        <section className="panel">
          <div className="panel-head">
            <h2>On shift</h2>
            <select aria-label="Day" className="input" value={day} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => (
                <option key={d} value={d}>{DAY_NAMES[weekday(d)]} {Number(d.slice(8))}{roster.holidays[d] ? `, ${roster.holidays[d]}` : ""}</option>
              ))}
            </select>
          </div>
          <div className="panel-body space-y-3">
            <p className="text-sm">
              {dayCov.length} processes need cover.{" "}
              {short ? <span className="text-danger font-semibold">{short} short.</span> : <span className="text-ok font-semibold">All covered.</span>}
            </p>
            <table className="text-sm w-full">
              <thead><tr className="text-left text-muted border-b border-line"><th className="py-1 font-semibold">Brand and process</th><th className="font-semibold">Cover</th><th className="font-semibold">Who</th></tr></thead>
              <tbody>
                {dayCov.map((c) => {
                  const people = dayEntries.filter((e) => e.status === "WORK" && e.bp_ids.includes(c.bp_id)).map((e) => empName(e.emp_id));
                  const ok = c.staffed >= c.required;
                  return (
                    <tr key={c.bp_id} className={`border-b border-line/60 ${ok ? "" : "bg-dangerSoft text-dangerSoft-ink"}`}>
                      <td className="py-1 pr-3">{bpLabel(c.bp_id)}</td>
                      <td className={`pr-3 ${ok ? "" : "font-bold"}`}>{c.staffed}/{c.required}</td>
                      <td className={ok ? "text-muted" : ""}>{people.join(", ") || "Nobody"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="space-y-1 text-sm">
              {["WEEKLY_OFF", "LEAVE", "COMP_OFF", "HOLIDAY"].map((st) => {
                const names = dayEntries.filter((e) => e.status === st).map((e) => empName(e.emp_id));
                return names.length ? (
                  <p key={st}><span className={`inline-block px-1.5 mr-2 text-xs ${STATUS_STYLE[st].cls}`}>{STATUS_STYLE[st].label}</span>{names.join(", ")}</p>
                ) : null;
              })}
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="panel">
            <div className="panel-head"><h2>Brands with gaps this month</h2><Link to="/conflicts" className="text-sm text-accent underline">Fix them</Link></div>
            <div className="panel-body">
              {gapsByBrand.size === 0 ? <p className="text-sm text-ok">Every brand is fully covered.</p> : (
                <table className="text-sm w-full">
                  <tbody>
                    {[...gapsByBrand.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => (
                      <tr key={b} className="border-b border-line/60">
                        <td className="py-1">{b}</td>
                        <td className="text-right text-danger font-semibold">{n} {n === 1 ? "day" : "days"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Recent changes</h2></div>
            <ul className="panel-body text-sm space-y-1.5 max-h-64 overflow-y-auto">
              {log.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-muted shrink-0 w-28">{new Date(l.at + "Z").toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{l.description}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, note, alert, last }: { label: string; value: string | number; note: string; alert?: boolean; last?: boolean }) {
  return (
    <div className={`px-5 py-3 flex-1 min-w-[150px] ${last ? "" : "border-r border-line"}`}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`text-3xl font-semibold leading-tight ${alert ? "text-danger" : "text-accent"}`} style={{ fontStretch: "115%" }}>{value}</dd>
      <dd className="text-xs text-muted">{note}</dd>
    </div>
  );
}
