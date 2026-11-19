// Employee x day grid. Each cell shows the person's status; red ring = cell involved in a conflict.
import { Conflict, Employee, Entry } from "../api";
import { DAY_NAMES, monthDays, useApp, weekday } from "../data";

export const STATUS_STYLE: Record<string, { cls: string; short: string; label: string }> = {
  WORK: { cls: "bg-green-200 text-green-900", short: "W", label: "Working" },
  WEEKLY_OFF: { cls: "bg-slate-300 text-slate-700", short: "WO", label: "Weekly off" },
  LEAVE: { cls: "bg-orange-300 text-orange-900", short: "L", label: "Leave / unavailable" },
  COMP_OFF: { cls: "bg-purple-300 text-purple-900", short: "CO", label: "Comp-off" },
  HOLIDAY: { cls: "bg-sky-300 text-sky-900", short: "H", label: "Public holiday" },
  IDLE: { cls: "bg-white text-slate-400", short: "-", label: "No process operating" },
};

export function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {Object.entries(STATUS_STYLE).map(([k, s]) => (
        <span key={k} className="flex items-center gap-1">
          <span className={`inline-block w-5 h-4 rounded text-center ${s.cls}`}>{s.short}</span>
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block w-5 h-4 rounded ring-2 ring-red-500" /> causes a hard conflict
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-5 h-4 rounded text-center bg-green-200 text-green-900">2</span> working on 2+ processes
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block w-5 h-4 rounded bg-green-200 border-b-2 border-blue-600" /> manual edit
      </span>
    </div>
  );
}

export function DayHeader({ days }: { days: string[] }) {
  const { roster } = useApp();
  return (
    <>
      {days.map((d) => {
        const wd = weekday(d);
        const hol = roster?.holidays[d];
        return (
          <th key={d} title={hol || ""}
            className={`px-0.5 font-normal text-[10px] leading-tight min-w-[26px] ${hol ? "bg-sky-100" : wd === 6 ? "bg-slate-200" : ""}`}>
            {DAY_NAMES[wd][0]}<br />{Number(d.slice(8))}
          </th>
        );
      })}
    </>
  );
}

interface Props {
  employees: Employee[];
  onCellClick?: (emp: Employee, day: string, entry: Entry | undefined) => void;
  highlightBp?: number; // only colour cells where the person works this brand-process
}

export default function RosterGrid({ employees, onCellClick, highlightBp }: Props) {
  const { roster, month, bpLabel, lookups } = useApp();
  if (!roster) return null;
  const days = monthDays(month);
  const entries = new Map(roster.entries.map((e) => [`${e.emp_id}|${e.date}`, e]));
  const conflictCells = new Set<string>();
  roster.conflicts.forEach((c: Conflict) => {
    if (c.severity !== "HARD") return; // ring only for must-fix problems
    if (c.emp_id) conflictCells.add(`${c.emp_id}|${c.date}`);
    if (c.bp_id) {
      // mark the people assigned to that brand-process on that day
      lookups?.assignments
        .filter((a) => a.brand_process_id === c.bp_id && a.role === "PRIMARY")
        .forEach((a) => conflictCells.add(`${a.employee_id}|${c.date}`));
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-2 sticky left-0 bg-slate-50 min-w-[150px]">Employee</th>
            <DayHeader days={days} />
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-t border-slate-100">
              <td className="px-2 py-0.5 sticky left-0 bg-slate-50 whitespace-nowrap">
                {emp.name}{emp.is_pod_lead && <span className="ml-1 text-[10px] text-indigo-600">LEAD</span>}
              </td>
              {days.map((d) => {
                const e = entries.get(`${emp.id}|${d}`);
                const st = STATUS_STYLE[e?.status ?? "IDLE"];
                const dim = highlightBp && e?.status === "WORK" && !e.bp_ids.includes(highlightBp);
                const bad = conflictCells.has(`${emp.id}|${d}`) && e?.status !== "WORK";
                const title = e ? `${emp.name} - ${d}\n${st.label}\n${e.bp_ids.map(bpLabel).join("\n")}${e.note ? "\n" + e.note : ""}` : "";
                return (
                  <td key={d} className="p-0.5">
                    <button title={title} onClick={() => onCellClick?.(emp, d, e)}
                      className={`w-6 h-5 rounded text-[10px] ${dim ? "bg-green-50 text-green-700" : st.cls}
                        ${bad ? "ring-2 ring-red-500" : ""} ${e?.manual ? "border-b-2 border-blue-600" : ""}`}>
                      {e?.status === "WORK" ? (e.bp_ids.length > 1 ? e.bp_ids.length : "W") : st.short}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
