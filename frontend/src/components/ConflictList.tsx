// A list of conflicts with their suggested fixes. "Apply" saves the suggestion's changes.
import { useState } from "react";
import { api, Conflict, Suggestion } from "../api";
import { useApp } from "../data";

const SEVERITY = {
  HARD: { row: "border-l-danger", tag: "bg-danger text-danger-ink", label: "Must fix" },
  SOFT: { row: "border-l-line", tag: "bg-warnSoft text-warnSoft-ink", label: "Preference" },
  INFO: { row: "border-l-line", tag: "bg-infoSoft text-infoSoft-ink", label: "Note" },
};

const TYPE_LABEL: Record<string, string> = {
  COVERAGE_GAP: "No cover", UNDERSTAFFED: "Understaffed", LEAVE_CONFLICT: "Works on leave", SHIFT_CLASH: "Shift clash",
  OVERLOAD: "Overloaded", MISSING_WEEKLY_OFF: "Missing weekly off", PREFERENCE_IGNORED: "Preferred off not given",
  HOLIDAY_WORKED: "Comp-off owed", MULTI_BRAND_IMPACT: "Several brands hit", PENDING_LEAVE: "Leave pending",
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
      setMsg(`Applied: ${s.description} Resolved ${res.resolved_conflicts.length}, new ${res.new_conflicts.length}.`);
      await reload();
      onApplied?.();
    } catch (e) {
      setMsg(`Couldn't apply the fix: ${e}`);
    } finally {
      setBusy("");
    }
  }

  if (!conflicts.length) return <p className="text-sm text-ok">Nothing to fix here.</p>;
  return (
    <div>
      {msg && <p className="mb-3 px-3 py-2 text-sm border border-ok text-ok">{msg}</p>}
      <ul className="border-t border-line">
        {conflicts.map((c) => {
          const sev = SEVERITY[c.severity];
          return (
            <li key={c.key} className={`border-b border-line border-l-4 ${sev.row} pl-3 pr-2 py-2.5 text-sm`}>
              <div className="flex flex-wrap gap-2 items-baseline">
                <span className={`text-[11px] font-semibold px-1.5 ${sev.tag}`}>{sev.label}</span>
                <span className="text-[11px] text-muted border border-line px-1.5">{TYPE_LABEL[c.type] ?? c.type}</span>
                <span className="flex-1 min-w-[260px]">{c.message}</span>
              </div>
              {c.suggestions.length > 0 && (
                <ol className="mt-2 space-y-1">
                  {c.suggestions.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-muted">
                      <span className="text-xs text-accent font-semibold w-12 shrink-0">{s.changes.length ? `Fix ${i + 1}` : "Note"}</span>
                      <span className="flex-1 min-w-[240px]">{s.description}</span>
                      {s.changes.length > 0 && !readOnly && (
                        <button className="btn-light !py-0.5 text-xs" disabled={!!busy} onClick={() => apply(c, s)}>
                          {busy === c.key ? "Applying…" : "Apply"}
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
