// Employee x day grid. Each cell shows the person's status; red outline = cell causes a hard conflict.
import { Conflict, Employee, Entry } from "../api";
import { DAY_NAMES, monthDays, useApp, weekday } from "../data";

export const STATUS_STYLE: Record<string, { cls: string; short: string; label: string }> = {
  WORK: { cls: "bg-work text-work-ink", short: "W", label: "Working" },
  WEEKLY_OFF: { cls: "bg-off text-off-ink", short: "WO", label: "Weekly off" },
  LEAVE: { cls: "bg-leave text-leave-ink", short: "L", label: "Leave or unavailable" },
  COMP_OFF: { cls: "bg-comp text-comp-ink", short: "CO", label: "Comp-off" },
  HOLIDAY: { cls: "bg-hol text-hol-ink", short: "H", label: "Public holiday" },
  IDLE: { cls: "bg-surface text-muted", short: "·", label: "Nothing operating" },
};

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {Object.entries(STATUS_STYLE).map(([k, s]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`inline-flex items-center justify-center w-6 h-4 text-[10px] border border-line ${s.cls}`}>{s.short}</span>
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-flex items-center justify-center w-6 h-4 text-[10px] bg-work text-work-ink">2</span> on 2+ processes
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-6 h-4 bg-surface outline outline-2 -outline-offset-2 outline-danger" /> causes a gap
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-6 h-4 bg-work border-b-[3px] border-accent" /> edited by hand
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
          <th key={d} title={hol || ""} scope="col"
            className={`px-0 py-1 font-normal text-[10px] leading-tight min-w-[28px] border-l border-line
              ${hol ? "bg-hol text-hol-ink" : wd >= 5 ? "bg-canvas" : ""}`}>
            <span className="text-muted">{DAY_NAMES[wd].slice(0, 2)}</span><br />
            <span className="text-xs font-semibold">{Number(d.slice(8))}</span>
          </th>
        );
      })}
    </>
  );
}

interface Props {
  employees: Employee[];
  onCellClick?: (emp: Employee, day: string, entry: Entry | undefined) => void;
}

export default function RosterGrid({ employees, onCellClick }: Props) {
  const { roster, month, bpLabel, lookups } = useApp();
  if (!roster) return null;
  const days = monthDays(month);
  const entries = new Map(roster.entries.map((e) => [`${e.emp_id}|${e.date}`, e]));
  const conflictCells = new Set<string>();
  roster.conflicts.forEach((c: Conflict) => {
    if (c.severity !== "HARD") return; // outline only for must-fix problems
    if (c.emp_id) conflictCells.add(`${c.emp_id}|${c.date}`);
    if (c.bp_id) {
      lookups?.assignments
        .filter((a) => a.brand_process_id === c.bp_id && a.role === "PRIMARY")
        .forEach((a) => conflictCells.add(`${a.employee_id}|${c.date}`));
    }
  });
  const podName = (id: number | null) => lookups?.pods.find((p) => p.id === id)?.name ?? "No pod";

  return (
    <div className="overflow-x-auto border border-line">
      <table className="text-xs border-collapse">
        <thead className="bg-surface">
          <tr className="border-b border-line">
            <th scope="col" className="text-left px-3 sticky left-0 bg-surface min-w-[170px] font-semibold">Employee</th>
            <DayHeader days={days} />
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const newPod = i === 0 || employees[i - 1].pod_id !== emp.pod_id;
            return (
              <tr key={emp.id} className={newPod && i > 0 ? "border-t-2 border-line" : "border-t border-line/60"}>
                <th scope="row" className="px-3 py-0.5 sticky left-0 bg-surface whitespace-nowrap text-left font-normal">
                  {emp.name}
                  {emp.is_pod_lead && <span className="ml-1.5 text-[10px] px-1 border border-accent text-accent">lead {podName(emp.pod_id)}</span>}
                </th>
                {days.map((d) => {
                  const e = entries.get(`${emp.id}|${d}`);
                  const st = STATUS_STYLE[e?.status ?? "IDLE"];
                  const bad = conflictCells.has(`${emp.id}|${d}`) && e?.status !== "WORK";
                  const title = e ? `${emp.name}, ${d}\n${st.label}\n${e.bp_ids.map(bpLabel).join("\n")}${e.note ? "\n" + e.note : ""}` : "";
                  return (
                    <td key={d} className="p-[1px] border-l border-line/60">
                      <button title={title} aria-label={title} onClick={() => onCellClick?.(emp, d, e)}
                        className={`w-[26px] h-[22px] text-[10px] font-medium ${st.cls}
                          ${bad ? "outline outline-2 -outline-offset-2 outline-danger" : ""}
                          ${e?.manual ? "border-b-[3px] border-accent" : ""} hover:brightness-95`}>
                        {e?.status === "WORK" ? (e.bp_ids.length > 1 ? e.bp_ids.length : "W") : st.short}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
