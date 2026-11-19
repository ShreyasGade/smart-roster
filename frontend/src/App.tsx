import { NavLink, Route, Routes } from "react-router-dom";
import { useApp } from "./data";
import Dashboard from "./pages/Dashboard";
import RosterPage from "./pages/RosterPage";
import ConflictsPage from "./pages/ConflictsPage";
import ChangeSimulator from "./pages/ChangeSimulator";
import SetupPage from "./pages/SetupPage";

const LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/roster", label: "Roster" },
  { to: "/conflicts", label: "Conflicts" },
  { to: "/simulator", label: "Change simulator" },
  { to: "/setup", label: "Setup" },
];

export default function App() {
  const { month, setMonth, roster, error, loading } = useApp();
  return (
    <div className="min-h-screen flex">
      <aside className="w-48 bg-slate-900 text-slate-100 p-4 space-y-4 shrink-0">
        <div className="font-bold text-lg leading-tight">Smart Roster</div>
        <label className="block text-xs text-slate-400">Month
          <input type="month" className="input w-full text-slate-800 mt-1" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
        <nav className="flex flex-col gap-1">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end
              className={({ isActive }) => `px-2 py-1 rounded text-sm ${isActive ? "bg-slate-700" : "hover:bg-slate-800"}`}>
              {l.label}
              {l.to === "/conflicts" && roster && roster.summary.hard > 0 && (
                <span className="ml-2 text-xs bg-red-600 rounded px-1">{roster.summary.hard}</span>
              )}
            </NavLink>
          ))}
        </nav>
        {loading && <p className="text-xs text-slate-400">Loading...</p>}
      </aside>
      <main className="flex-1 p-6 overflow-x-hidden">
        {error && <p className="text-red-600 mb-4">{error}</p>}
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
