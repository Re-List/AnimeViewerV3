// frontend/src/services/themeService.js

export const THEMES = [
  // --- 4 DARK THEMES ---
  {
    id: "neon-cyber",
    name: "Neon Cyber (Default)",
    type: "Dark",
    preview: "linear-gradient(135deg, #7c3aed, #f43f5e)",
    vars: {
      "--brand-gradient": "linear-gradient(90deg, #ffffff 0%, #c084fc 45%, #f43f5e 100%)",
      "--accent-gradient": "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #f43f5e 100%)",
      "--bg-primary": "#0a0a0a",
      "--bg-surface": "#141414",
      "--border-color": "#222222",
      "--text-primary": "#ffffff",
      "--text-muted": "#888888",
    },
  },
  {
    id: "midnight-ocean",
    name: "Midnight Ocean",
    type: "Dark",
    preview: "linear-gradient(135deg, #0284c7, #2563eb)",
    vars: {
      "--brand-gradient": "linear-gradient(90deg, #ffffff 0%, #38bdf8 45%, #2563eb 100%)",
      "--accent-gradient": "linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #3b82f6 100%)",
      "--bg-primary": "#060b13",
      "--bg-surface": "#0f172a",
      "--border-color": "#1e293b",
      "--text-primary": "#ffffff",
      "--text-muted": "#94a3b8",
    },
  },
  {
    id: "crimson-eclipse",
    name: "Crimson Eclipse",
    type: "Dark",
    preview: "linear-gradient(135deg, #ea580c, #dc2626)",
    vars: {
      "--brand-gradient": "linear-gradient(90deg, #ffffff 0%, #fb923c 45%, #ef4444 100%)",
      "--accent-gradient": "linear-gradient(135deg, #ea580c 0%, #f97316 50%, #dc2626 100%)",
      "--bg-primary": "#0e0909",
      "--bg-surface": "#181111",
      "--border-color": "#2d1a1a",
      "--text-primary": "#ffffff",
      "--text-muted": "#a8a29e",
    },
  },
  {
    id: "emerald-forest",
    name: "Emerald Forest",
    type: "Dark",
    preview: "linear-gradient(135deg, #059669, #14b8a6)",
    vars: {
      "--brand-gradient": "linear-gradient(90deg, #ffffff 0%, #34d399 45%, #059669 100%)",
      "--accent-gradient": "linear-gradient(135deg, #059669 0%, #10b981 50%, #14b8a6 100%)",
      "--bg-primary": "#070f0b",
      "--bg-surface": "#0e1c15",
      "--border-color": "#1b3829",
      "--text-primary": "#ffffff",
      "--text-muted": "#94a3b8",
    },
  },

  // --- 2 LIGHT THEMES ---
  {
    id: "aurora-daylight",
    name: "Aurora Daylight",
    type: "Light",
    preview: "linear-gradient(135deg, #7c3aed, #3b82f6)",
    vars: {
      "--brand-gradient": "linear-gradient(90deg, #1e1b4b 0%, #7c3aed 45%, #2563eb 100%)",
      "--accent-gradient": "linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)",
      "--bg-primary": "#f8fafc",
      "--bg-surface": "#ffffff",
      "--border-color": "#e2e8f0",
      "--text-primary": "#0f172a",
      "--text-muted": "#64748b",
    },
  },
  {
    id: "pastel-sakura",
    name: "Pastel Sakura",
    type: "Light",
    preview: "linear-gradient(135deg, #fb7185, #f43f5e)",
    vars: {
      "--brand-gradient": "linear-gradient(90deg, #881337 0%, #e11d48 45%, #f43f5e 100%)",
      "--accent-gradient": "linear-gradient(135deg, #fb7185 0%, #f43f5e 50%, #e11d48 100%)",
      "--bg-primary": "#fff5f6",
      "--bg-surface": "#ffffff",
      "--border-color": "#fecdd3",
      "--text-primary": "#4c0519",
      "--text-muted": "#9f1239",
    },
  },
];

export function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  localStorage.setItem("appTheme", theme.id);
  return theme.id;
}

export function getCurrentTheme() {
  return localStorage.getItem("appTheme") || "neon-cyber";
}