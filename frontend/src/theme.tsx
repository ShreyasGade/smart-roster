// Themes: a base palette (light or dark) + an accent colour. Applied as CSS variables on <html>.
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

type Kind = "light" | "dark";

interface Base {
  name: string;
  kind: Kind;
  canvas: string; surface: string; line: string; ink: string; muted: string;
}

export const BASES: Record<string, Base> = {
  // light
  daylight: { name: "Daylight", kind: "light", canvas: "#F3F4F1", surface: "#FFFFFF", line: "#C9CCC4", ink: "#1A1D1A", muted: "#5E635C" },
  concrete: { name: "Concrete", kind: "light", canvas: "#E9E9E7", surface: "#F7F7F6", line: "#BDBDB8", ink: "#1C1C1C", muted: "#5C5C58" },
  sharp: { name: "High contrast", kind: "light", canvas: "#FFFFFF", surface: "#FFFFFF", line: "#1A1A1A", ink: "#000000", muted: "#3A3A3A" },
  // dark
  control: { name: "Control room", kind: "dark", canvas: "#1B1712", surface: "#241F18", line: "#403829", ink: "#EDE6D9", muted: "#A39883" },
  carbon: { name: "Carbon", kind: "dark", canvas: "#141414", surface: "#1D1D1D", line: "#363636", ink: "#E8E8E8", muted: "#999999" },
  sharpdark: { name: "High contrast dark", kind: "dark", canvas: "#000000", surface: "#000000", line: "#E0E0E0", ink: "#FFFFFF", muted: "#D0D0D0" },
};

// [colour on light themes, text on it] / [colour on dark themes, text on it]
export const ACCENTS: Record<string, { name: string; light: [string, string]; dark: [string, string] }> = {
  signal: { name: "Signal blue", light: ["#1F5FD1", "#FFFFFF"], dark: ["#6B9CF5", "#0E1726"] },
  railway: { name: "Railway yellow", light: ["#B07A00", "#1A1400"], dark: ["#E8B637", "#1A1400"] },
  pine: { name: "Pine", light: ["#1E7A4C", "#FFFFFF"], dark: ["#4CC28A", "#0B1F14"] },
  plum: { name: "Plum", light: ["#7A3E9D", "#FFFFFF"], dark: ["#C08BE0", "#1E0F28"] },
  teal: { name: "Harbour teal", light: ["#0F766E", "#FFFFFF"], dark: ["#3CC7BA", "#04211E"] },
  saffron: { name: "Saffron", light: ["#C2410C", "#FFFFFF"], dark: ["#FB8C4A", "#2A1104"] },
  graphite: { name: "Graphite", light: ["#3B3F45", "#FFFFFF"], dark: ["#C9CED6", "#15181C"] },
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

// URL (?theme=carbon&accent=pine) wins, then the saved choice, then the default.
// Values that no longer exist (e.g. a removed theme) are ignored.
function load(key: string, param: string, valid: Record<string, unknown>, fallback: string) {
  const fromUrl = new URLSearchParams(window.location.search).get(param);
  if (fromUrl && fromUrl in valid) return fromUrl;
  try {
    const saved = localStorage.getItem(key);
    if (saved && saved in valid) return saved;
  } catch { /* storage blocked */ }
  return fallback;
}

// Default follows the computer's setting: Carbon in dark mode, Daylight otherwise
const prefersDark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
export const DEFAULT_LIGHT = "daylight";
export const DEFAULT_DARK = "carbon";
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked - theme just won't persist */ }
}

interface ThemeState { base: string; accent: string; setBase: (b: string) => void; setAccent: (a: string) => void }
const Ctx = createContext<ThemeState>(null as unknown as ThemeState);
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [base, setBase] = useState(() => load("roster.base", "theme", BASES, prefersDark() ? DEFAULT_DARK : DEFAULT_LIGHT));
  const [accent, setAccent] = useState(() => load("roster.accent", "accent", ACCENTS, "signal"));
  useEffect(() => { apply(base, accent); save("roster.base", base); save("roster.accent", accent); }, [base, accent]);
  return <Ctx.Provider value={{ base, accent, setBase, setAccent }}>{children}</Ctx.Provider>;
}

function ThemeIcon({ dark }: { dark: boolean }) {
  // half-filled circle: reads as "appearance" in both modes
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d={dark ? "M10 2a8 8 0 0 0 0 16z" : "M10 2a8 8 0 0 1 0 16z"} fill="currentColor" />
    </svg>
  );
}

export function ThemePicker() {
  const { base, accent, setBase, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const kind = BASES[base]?.kind ?? "light";

  // close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button className="btn-light flex items-center gap-2" aria-haspopup="dialog" aria-expanded={open}
        title="Change theme" onClick={() => setOpen(!open)}>
        <ThemeIcon dark={kind === "dark"} />
        <span className="hidden sm:inline">{BASES[base]?.name}</span>
        <span className="w-3 h-3 bg-accent" />
      </button>
      {open && (
        <div role="dialog" aria-label="Theme" className="absolute right-0 top-full mt-1 z-50 w-72 panel shadow-none border-2 border-accent">
          <div className="grid grid-cols-2 border-b border-line">
            {(["light", "dark"] as Kind[]).map((k) => (
              <button key={k} aria-pressed={kind === k}
                onClick={() => kind !== k && setBase(k === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT)}
                className={`py-2 text-sm flex items-center justify-center gap-2 ${kind === k ? "bg-accent text-on-accent font-semibold" : "hover:bg-canvas"}`}>
                <ThemeIcon dark={k === "dark"} /> {k === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
          <div className="p-3 space-y-3">
            <div>
              <p className="text-xs text-muted mb-1">Theme</p>
              <div className="flex flex-col border border-line">
                {Object.entries(BASES).filter(([, b]) => b.kind === kind).map(([k, b]) => (
                  <button key={k} onClick={() => setBase(k)} aria-pressed={base === k}
                    className={`flex items-center gap-2 px-2 py-1.5 text-sm text-left border-b border-line last:border-b-0 ${base === k ? "tint font-semibold" : "hover:bg-canvas"}`}>
                    <span className="flex border border-line">
                      <span className="w-3 h-4" style={{ background: b.canvas }} />
                      <span className="w-3 h-4" style={{ background: b.surface }} />
                      <span className="w-3 h-4" style={{ background: b.ink }} />
                    </span>
                    {b.name}
                    {(k === DEFAULT_DARK || k === DEFAULT_LIGHT) && <span className="ml-auto text-xs text-muted">default</span>}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Accent: {ACCENTS[accent]?.name}</p>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Accent colour">
                {Object.entries(ACCENTS).map(([k, a]) => (
                  <button key={k} role="radio" aria-checked={accent === k} title={a.name} onClick={() => setAccent(k)}
                    className={`w-7 h-7 border-2 ${accent === k ? "border-ink" : "border-transparent"}`}
                    style={{ background: a[kind][0] }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
