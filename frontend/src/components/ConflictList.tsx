// A list of conflicts with their suggested fixes. "Apply" saves the suggestion's changes.
import { useState } from "react";
import { api, Conflict, Suggestion } from "../api";
import { useApp } from "../data";

const SEVERITY_STYLE = {
  HARD: "bg-red-100 text-red-800 border-red-300",
  SOFT: "bg-amber-50 text-amber-800 border-amber-300",
  INFO: "bg-blue-50 text-blue-800 border-blue-200",
};

// readOnly: show suggestions without Apply buttons (used for previews of unsaved changes)
export default function ConflictList({ conflicts, onApplied, readOnly }: { conflicts: Conflict[]; onApplied?: () => void; readOnly?: boolean }) {
  const { month, reload } = useApp();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function apply(c: Conflict, s: Suggestion) {
    setBusy(c.key);
    try {
      const res = await api.changes(month, s.changes, true, s.description);
      setMsg(`Applied: ${s.description} - resolved ${res.resolved_conflicts.length}, new ${res.new_conflicts.length}.`);
      await reload();
      onApplied?.();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy("");
    }
  }

  if (!conflicts.length) return <p className="text-sm text-green-700">No conflicts.</p>;
  return (
    <div className="space-y-2">
      {msg && <p className="text-sm bg-green-50 border border-green-200 rounded p-2">{msg}</p>}
      {conflicts.map((c) => (
        <div key={c.key} className={`border rounded p-2 text-sm ${SEVERITY_STYLE[c.severity]}`}>
          <div className="flex gap-2 items-start">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/70">{c.severity}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70">{c.type}</span>
            <span className="flex-1">{c.message}</span>
          </div>
          {c.suggestions.length > 0 && (
            <ul className="mt-1 ml-4 space-y-1">
              {c.suggestions.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-700">
                  <span>💡 {s.description}</span>
                  {s.changes.length > 0 && !readOnly && (
                    <button className="btn-light !py-0.5 text-xs" disabled={!!busy} onClick={() => apply(c, s)}>
                      {busy === c.key ? "Applying..." : "Apply"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
