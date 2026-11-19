/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const tokens = [
  "canvas", "surface", "line", "ink", "muted", "accent", "on-accent",
  "work", "off", "leave", "comp", "hol", "danger", "dangerSoft", "warnSoft", "infoSoft", "ok",
];
const colors = {};
for (const t of tokens) {
  colors[t] = v(t);
  colors[`${t}-ink`] = v(`${t}-ink`);
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // No rounded corners anywhere
    borderRadius: { none: "0", DEFAULT: "0", sm: "0", md: "0", lg: "0", xl: "0", full: "0" },
    fontFamily: { sans: ["Archivo", "system-ui", "sans-serif"] },
    extend: { colors },
  },
  plugins: [],
};
