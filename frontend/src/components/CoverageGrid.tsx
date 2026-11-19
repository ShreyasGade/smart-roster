// Brand-process x day grid showing "working/required". Red = short, green = ok, blank = closed.
import { BrandProcess } from "../api";
import { DayHeader } from "./RosterGrid";
import { monthDays, useApp } from "../data";

export default function CoverageGrid({ bps }: { bps: BrandProcess[] }) {
  const { roster, month, bpLabel } = useApp();
  if (!roster) return null;
  const days = monthDays(month);
  const cov = new Map(roster.coverage.map((c) => [`${c.bp_id}|${c.date}`, c]));

  return (
    <div className="overflow-x-auto border border-line">
      <table className="text-xs border-collapse">
        <thead className="tint">
          <tr className="border-b border-line">
            <th scope="col" className="text-left px-3 sticky left-0 tint min-w-[170px] font-semibold">Brand and process</th>
            <DayHeader days={days} />
          </tr>
        </thead>
        <tbody>
          {bps.map((bp) => (
            <tr key={bp.id} className="border-t border-line/60">
              <th scope="row" className="px-3 py-0.5 sticky left-0 bg-surface whitespace-nowrap text-left font-normal"
                title={`${bp.calendar_preset}, minimum ${bp.min_staff}, ${bp.shift} shift`}>
                {bpLabel(bp.id)}
              </th>
              {days.map((d) => {
                const c = cov.get(`${bp.id}|${d}`);
                if (!c || c.required === 0) {
                  return <td key={d} className="p-[1px] border-l border-line/60"><div className="w-[26px] h-[22px] bg-canvas" title="Closed" /></td>;
                }
                const ok = c.staffed >= c.required;
                return (
                  <td key={d} className="p-[1px] border-l border-line/60">
                    <div title={`${c.staffed} working, ${c.required} required`}
                      className={`w-[26px] h-[22px] text-[10px] flex items-center justify-center ${ok ? "bg-work text-work-ink" : "bg-danger text-danger-ink font-bold"}`}>
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
