// Brand-process x day grid showing "staffed/required". Red = short, green = ok, grey = not operating.
import { BrandProcess } from "../api";
import { DayHeader } from "./RosterGrid";
import { monthDays, useApp } from "../data";

export default function CoverageGrid({ bps }: { bps: BrandProcess[] }) {
  const { roster, month, bpLabel } = useApp();
  if (!roster) return null;
  const days = monthDays(month);
  const cov = new Map(roster.coverage.map((c) => [`${c.bp_id}|${c.date}`, c]));

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-2 sticky left-0 bg-slate-50 min-w-[150px]">Brand - process</th>
            <DayHeader days={days} />
          </tr>
        </thead>
        <tbody>
          {bps.map((bp) => (
            <tr key={bp.id} className="border-t border-slate-100">
              <td className="px-2 py-0.5 sticky left-0 bg-slate-50 whitespace-nowrap" title={`${bp.calendar_preset}, min ${bp.min_staff}, ${bp.shift}`}>
                {bpLabel(bp.id)}
              </td>
              {days.map((d) => {
                const c = cov.get(`${bp.id}|${d}`);
                if (!c || c.required === 0) {
                  return <td key={d} className="p-0.5"><div className="w-6 h-5 rounded bg-slate-100" title="Not operating" /></td>;
                }
                const ok = c.staffed >= c.required;
                return (
                  <td key={d} className="p-0.5">
                    <div title={`${c.staffed} working / ${c.required} required`}
                      className={`w-6 h-5 rounded text-[10px] flex items-center justify-center ${ok ? "bg-green-200 text-green-900" : "bg-red-500 text-white font-bold"}`}>
                      {c.staffed}/{c.required}
                    </div>
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
