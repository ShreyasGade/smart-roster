import { NavLink, Route, Routes } from "react-router-dom";
import { useApp } from "./data";
import { ThemePicker } from "./theme";
import Dashboard from "./pages/Dashboard";
import RosterPage from "./pages/RosterPage";
import ConflictsPage from "./pages/ConflictsPage";
import ChangeSimulator from "./pages/ChangeSimulator";
import SetupPage from "./pages/SetupPage";

const LINKS = [
  { to: "/", label: "Overview" },
  { to: "/roster", label: "Roster" },
  { to: "/conflicts", label: "Conflicts" },
  { to: "/simulator", label: "What if" },
  { to: "/setup", label: "Setup" },
];

export default function App() {
  const { month, setMonth, roster, error, loading } = useApp();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-surface border-b border-line">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2 px-4 md:px-6 pt-3">
          <div className="pb-3 flex items-baseline gap-2">
            <span className="w-3 h-3 bg-accent inline-block self-center" />
            <span className="text-lg font-semibold" style={{ fontStretch: "118%" }}>Smart Roster</span>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end
                className={({ isActive }) =>
                  `px-3 pb-2.5 pt-1 text-sm whitespace-nowrap border-b-[3px] ${isActive ? "border-accent font-semibold" : "border-transparent text-muted hover:text-ink"}`}>
                {l.label}
                {l.to === "/conflicts" && roster && roster.summary.hard > 0 && (
                  <span className="ml-1.5 px-1.5 text-xs bg-danger text-danger-ink">{roster.summary.hard}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-3 pb-2.5">
            {loading && <span className="hint">Loading…</span>}
            <label className="flex items-center gap-2 text-sm text-muted">Month
              <input type="month" className="input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </label>
            <ThemePicker />
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 md:px-6 py-5 max-w-[1600px] w-full">
        {error && <p className="mb-4 px-3 py-2 bg-dangerSoft text-dangerSoft-ink border border-danger">Can't reach the server: {error}</p>}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/roster" element={<RosterPage />} />
          <Route path="/conflicts" element={<ConflictsPage />} />
          <Route path="/simulator" element={<ChangeSimulator />} />
          <Route path="/setup" element={<SetupPage />} />
        </Routes>
      </main>
    </div>
  );
}
