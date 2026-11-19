// Themes: a base palette (light or dark) + an accent colour. Applied as CSS variables on <html>.
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Kind = "light" | "dark";

interface Base {
  name: string;
  kind: Kind;
  canvas: string; surface: string; line: string; ink: string; muted: string;
}

export const BASES: Record<string, Base> = {
  daylight: { name: "Daylight", kind: "light", canvas: "#F3F4F1", surface: "#FFFFFF", line: "#C9CCC4", ink: "#1A1D1A", muted: "#5E635C" },
  drafting: { name: "Drafting", kind: "light", canvas: "#EEF2F7", surface: "#FBFCFE", line: "#BFCADB", ink: "#12223A", muted: "#52627A" },
  night: { name: "Night shift", kind: "dark", canvas: "#161A1F", surface: "#1E242B", line: "#36404B", ink: "#E3E7EB", muted: "#8C97A3" },
  control: { name: "Control room", kind: "dark", canvas: "#1B1712", surface: "#241F18", line: "#403829", ink: "#EDE6D9", muted: "#A39883" },
};

// [colour on light themes, text on it] / [colour on dark themes, text on it]
export const ACCENTS: Record<string, { name: string; light: [string, string]; dark: [string, string] }> = {
  signal: { name: "Signal blue", light: ["#1F5FD1", "#FFFFFF"], dark: ["#6B9CF5", "#0E1726"] },
  railway: { name: "Railway yellow", light: ["#B07A00", "#1A1400"], dark: ["#E8B637", "#1A1400"] },
  pine: { name: "Pine", light: ["#1E7A4C", "#FFFFFF"], dark: ["#4CC28A", "#0B1F14"] },
  brick: { name: "Brick", light: ["#B23A2E", "#FFFFFF"], dark: ["#F07A6C", "#2A0D09"] },
  plum: { name: "Plum", light: ["#7A3E9D", "#FFFFFF"], dark: ["#C08BE0", "#1E0F28"] },
};

// Roster status colours: [fill, text] for light and dark themes
const STATUS: Record<Kind, Record<string, [string, string]>> = {
  light: {
    work: ["#CBE7CF", "#14532D"], off: ["#DCDDD8", "#3F423D"], leave: ["#F8C9A0", "#7C2D12"],
    comp: ["#DCCBF0", "#4C1D95"], hol: ["#BFDDF3", "#0C4A6E"],
    danger: ["#C62828", "#FFFFFF"], dangerSoft: ["#FBE3E1", "#8A1C14"],
    warnSoft: ["#FBF0D2", "#6B4A00"], infoSoft: ["#E1EBF7", "#1D3F6E"], ok: ["#1F7A3F", "#FFFFFF"],
  },
  dark: {
    work: ["#1D4B33", "#C4F0D2"], off: ["#3A3F46", "#CDD2D8"], leave: ["#7A3F17", "#FFDCC2"],
    comp: ["#4F3575", "#E8D9FF"], hol: ["#1C4A6B", "#CDE8FF"],
    danger: ["#F26B6B", "#2A0707"], dangerSoft: ["#3B1E1E", "#FFC2BC"],
    warnSoft: ["#3A3016", "#F6DFA0"], infoSoft: ["#1C2B3D", "#BFD7F5"], ok: ["#5BCB8A", "#06200F"],
  },
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

function apply(baseKey: string, accentKey: string) {
  const base = BASES[baseKey] ?? BASES.daylight;
  const accent = ACCENTS[accentKey] ?? ACCENTS.signal;
  const [acc, onAcc] = accent[base.kind];
  const vars: Record<string, string> = {
    canvas: base.canvas, surface: base.surface, line: base.line, ink: base.ink, muted: base.muted,
    accent: acc, "on-accent": onAcc,
  };
  for (const [k, [fill, text]] of Object.entries(STATUS[base.kind])) {
    vars[k] = fill;
    vars[`${k}-ink`] = text;
  }
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(`--${k}`, rgb(v));
  root.style.colorScheme = base.kind; // native date pickers / scrollbars follow the theme
}

// URL (?theme=night&accent=pine) wins, then the saved choice, then the default
function load(key: string, param: string, fallback: string) {
  const fromUrl = new URLSearchParams(window.location.search).get(param);
  if (fromUrl) return fromUrl;
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked - theme just won't persist */ }
}

interface ThemeState { base: string; accent: string; setBase: (b: string) => void; setAccent: (a: string) => void }
const Ctx = createContext<ThemeState>(null as unknown as ThemeState);
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [base, setBase] = useState(() => load("roster.base", "theme", "daylight"));
  const [accent, setAccent] = useState(() => load("roster.accent", "accent", "signal"));
  useEffect(() => { apply(base, accent); save("roster.base", base); save("roster.accent", accent); }, [base, accent]);
  return <Ctx.Provider value={{ base, accent, setBase, setAccent }}>{children}</Ctx.Provider>;
}

export function ThemePicker() {
  const { base, accent, setBase, setAccent } = useTheme();
  const kind = BASES[base]?.kind ?? "light";
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Theme" className="input" value={base} onChange={(e) => setBase(e.target.value)}>
        <optgroup label="Light">
          {Object.entries(BASES).filter(([, b]) => b.kind === "light").map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}
        </optgroup>
        <optgroup label="Dark">
          {Object.entries(BASES).filter(([, b]) => b.kind === "dark").map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}
        </optgroup>
      </select>
      <div className="flex" role="radiogroup" aria-label="Accent colour">
        {Object.entries(ACCENTS).map(([k, a]) => (
          <button key={k} role="radio" aria-checked={accent === k} title={a.name} onClick={() => setAccent(k)}
            className={`w-6 h-6 border ${accent === k ? "border-ink border-2" : "border-line"}`}
            style={{ background: a[kind][0] }} />
        ))}
      </div>
    </div>
  );
}
