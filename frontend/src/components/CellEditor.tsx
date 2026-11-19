// Modal to change one employee's day. "Check impact" validates first; "Save" applies it.
import { useState } from "react";
import { api, Employee, Entry, Impact } from "../api";
import { useApp } from "../data";
import { STATUS_STYLE } from "./RosterGrid";
import ConflictList from "./ConflictList";

interface Props { emp: Employee; day: string; entry?: Entry; onClose: () => void }

export default function CellEditor({ emp, day, entry, onClose }: Props) {
  const { month, lookups, bpLabel, reload } = useApp();
  const [status, setStatus] = useState(entry?.status ?? "WORK");
  const [bpIds, setBpIds] = useState<number[]>(entry?.bp_ids ?? []);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [error, setError] = useState("");

  const assigned = lookups?.assignments.filter((a) => a.employee_id === emp.id).map((a) => a.brand_process_id) ?? [];
  const others = lookups?.bps.filter((b) => !assigned.includes(b.id)) ?? [];
  const changes = () => [{ emp_id: emp.id, day, status, bp_ids: status === "WORK" ? bpIds : [] }];

  async function run(apply: boolean) {
    setError("");
    try {
      const res = await api.changes(month, changes(), apply, `Edited ${emp.name} on ${day}: ${status}`);
      setImpact(res);
      if (apply) { await reload(); onClose(); }
    } catch (e) {
      setError(String(e));
    }
  }

  const toggle = (id: number) => setBpIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-5 w-[600px] max-h-[85vh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold text-lg">{emp.name} - {day}</h2>
        {entry?.note && <p className="text-sm text-slate-500">Note: {entry.note}</p>}
        <label className="block text-sm">Status{" "}
          <select className="input" value={status} onChange={(e) => { setStatus(e.target.value as Entry["status"]); setImpact(null); }}>
            {Object.keys(STATUS_STYLE).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        {status === "WORK" && (
          <div className="text-sm">
            <p className="font-medium">Works on:</p>
            {assigned.map((id) => (
              <label key={id} className="block"><input type="checkbox" checked={bpIds.includes(id)} onChange={() => toggle(id)} /> {bpLabel(id)}</label>
            ))}
            <select className="input mt-1" value="" onChange={(e) => e.target.value && toggle(Number(e.target.value))}>
              <option value="">+ cover another brand-process...</option>
              {others.map((b) => <option key={b.id} value={b.id}>{bpLabel(b.id)}</option>)}
            </select>
            {bpIds.filter((id) => !assigned.includes(id)).map((id) => (
              <label key={id} className="block text-blue-700"><input type="checkbox" checked onChange={() => toggle(id)} /> {bpLabel(id)} (cover)</label>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-light" onClick={() => run(false)}>Check impact</button>
          <button className="btn" onClick={() => run(true)}>Save</button>
          <button className="btn-light ml-auto" onClick={onClose}>Close</button>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {impact && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              This change creates {impact.new_conflicts.length} new conflict(s) and resolves {impact.resolved_conflicts.length}.
            </p>
            <ConflictList conflicts={impact.new_conflicts} readOnly />
            {impact.resolved_conflicts.length > 0 && (
              <div className="text-sm text-green-700">
                Resolved: {impact.resolved_conflicts.map((c) => <div key={c.key}>✓ {c.message}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
