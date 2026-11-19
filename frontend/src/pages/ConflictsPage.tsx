// All conflicts for the month, filterable, with suggested fixes.
import { useState } from "react";
import { useApp } from "../data";
import ConflictList from "../components/ConflictList";

export default function ConflictsPage() {
  const { roster, month } = useApp();
  const [severity, setSeverity] = useState("HARD");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");

  if (!roster) return <p>No roster for {month} yet.</p>;
  const types = [...new Set(roster.conflicts.map((c) => c.type))];
  const list = roster.conflicts.filter((c) =>
    (!severity || c.severity === severity) && (!type || c.type === type) &&
    (!search || c.message.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Conflicts - {month}</h1>
      <p className="text-sm text-slate-600">
        <b>HARD</b> = client coverage or approved leave is broken (must fix). <b>SOFT</b> = preferences, weekly-off
        entitlement, holiday work (comp-off owed). <b>INFO</b> = context such as pending leave requests.
        Suggestions are never applied automatically - you decide.
      </p>
      <div className="flex flex-wrap gap-2">
        <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          <option>HARD</option><option>SOFT</option><option>INFO</option>
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="input" placeholder="Search brand / person..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="text-sm text-slate-500 self-center">{list.length} shown</span>
      </div>
      <ConflictList conflicts={list} />
    </div>
  );
}
