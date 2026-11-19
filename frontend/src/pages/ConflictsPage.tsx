// All conflicts for the month, filterable, with suggested fixes.
import { useState } from "react";
import { useApp } from "../data";
import ConflictList from "../components/ConflictList";

export default function ConflictsPage() {
  const { roster, month } = useApp();
  const [severity, setSeverity] = useState("HARD");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");

  if (!roster) return <p className="hint">No roster for {month} yet.</p>;
  const types = [...new Set(roster.conflicts.map((c) => c.type))];
  const list = roster.conflicts.filter((c) =>
    (!severity || c.severity === severity) && (!type || c.type === type) &&
    (!search || c.message.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-5">
      <div className="border-b border-line pb-4">
        <h1>Conflicts</h1>
        <p className="mt-1 max-w-3xl">
          <b>Must fix</b> means a client is short of cover or someone is rostered on approved leave.{" "}
          <b>Preference</b> covers missed preferred offs and comp-offs owed. Nothing is changed until you apply a fix.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Severity" className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All</option>
          <option value="HARD">Must fix</option>
          <option value="SOFT">Preference</option>
          <option value="INFO">Notes</option>
        </select>
        <select aria-label="Type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Any type</option>
          {types.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</option>)}
        </select>
        <input aria-label="Search" className="input w-64" placeholder="Search a brand or person" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="hint">{list.length} shown</span>
      </div>
      <ConflictList conflicts={list} />
    </div>
  );
}
