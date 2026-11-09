export const THEMES = [
  {
    id: "midnight-velvet",
    name: "Midnight Velvet (Default)",
    type: "Dark Theme",
    isDark: true,
    preview: "linear-gradient(135deg, #7928ca 0%, #ff0080 100%)",
    brand: "linear-gradient(135deg, #7928ca 0%, #ff0080 100%)",
    accent: "#ff0080",
    bgPrimary: "#0a0a12",
    bgSurface: "#141422",
    bgCard: "#1a1a2b",
    borderColor: "rgba(255, 255, 255, 0.12)",
    textPrimary: "#ffffff",
    textMuted: "#b0b0cc"
  },
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    type: "Dark Theme",
    isDark: true,
    preview: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
    brand: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
    accent: "#00f2fe",
    bgPrimary: "#070b14",
    bgSurface: "#0f172a",
    bgCard: "#16223d",
    borderColor: "rgba(0, 242, 254, 0.22)",
    textPrimary: "#ffffff",
    textMuted: "#9fc3ea"
  },
  {
    id: "crimson-eclipse",
    name: "Crimson Eclipse",
    type: "Dark Theme",
    isDark: true,
    preview: "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
    brand: "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
    accent: "#ff0844",
    bgPrimary: "#0f0608",
    bgSurface: "#1e0d12",
    bgCard: "#2d141b",
    borderColor: "rgba(255, 8, 68, 0.28)",
    textPrimary: "#ffffff",
    textMuted: "#f0b8c2"
  },
  {
    id: "emerald-abyss",
    name: "Emerald Abyss",
    type: "Dark Theme",
    isDark: true,
    preview: "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",
    brand: "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",
    accent: "#3cba92",
    bgPrimary: "#050e09",
    bgSurface: "#0c1f15",
    bgCard: "#142d1f",
    borderColor: "rgba(60, 186, 146, 0.28)",
    textPrimary: "#ffffff",
    textMuted: "#a4d8be"
  },
  {
    id: "sakura-day",
    name: "Sakura Day",
    type: "Light Theme",
    isDark: false,
    preview: "linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)",
    brand: "linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)",
    accent: "#ff5478",
    bgPrimary: "#faf6f8",
    bgSurface: "#ffffff",
    bgCard: "#f3e7ed",
    borderColor: "rgba(255, 117, 140, 0.35)",
    textPrimary: "#1a1a24",
    textMuted: "#665a6b"
  },
  {
    id: "nordic-frost",
    name: "Nordic Frost",
    type: "Light Theme",
    isDark: false,
    preview: "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)",
    brand: "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)",
    accent: "#2b5876",
    bgPrimary: "#f4f7f9",
    bgSurface: "#ffffff",
    bgCard: "#e3eaf1",
    borderColor: "rgba(43, 88, 118, 0.3)",
    textPrimary: "#111625",
    textMuted: "#505c70"
  }
];

export function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const root = document.documentElement;

  // Harmonize all CSS variable standards
  root.style.setProperty("--brand-gradient", theme.brand);
  root.style.setProperty("--brand-primary", theme.brand);
  root.style.setProperty("--accent-gradient", theme.brand);
  root.style.setProperty("--accent-color", theme.accent);
  root.style.setProperty("--bg-primary", theme.bgPrimary);
  root.style.setProperty("--bg-surface", theme.bgSurface);
  root.style.setProperty("--bg-card", theme.bgCard);
  root.style.setProperty("--border-color", theme.borderColor);
  root.style.setProperty("--text-primary", theme.textPrimary);
  root.style.setProperty("--text-main", theme.textPrimary);
  root.style.setProperty("--text-muted", theme.textMuted);
  root.style.setProperty(
    "--hero-overlay",
    theme.isDark
      ? "linear-gradient(180deg, rgba(10, 10, 18, 0.3) 0%, rgba(10, 10, 18, 0.95) 100%)"
      : "linear-gradient(180deg, rgba(250, 246, 248, 0.3) 0%, rgba(250, 246, 248, 0.95) 100%)"
  );

  document.body.style.backgroundColor = theme.bgPrimary;
  document.body.style.color = theme.textPrimary;

  localStorage.setItem("relist_theme", theme.id);
  localStorage.removeItem("relist_custom_theme");
}

export function applyCustomTheme(color1, color2, isDark = true) {
  const root = document.documentElement;
  const brand = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;

  root.style.setProperty("--brand-gradient", brand);
  root.style.setProperty("--brand-primary", brand);
  root.style.setProperty("--accent-gradient", brand);
  root.style.setProperty("--accent-color", color1);

  if (isDark) {
    root.style.setProperty("--bg-primary", "#0a0a12");
    root.style.setProperty("--bg-surface", "#141420");
    root.style.setProperty("--bg-card", "#191929");
    root.style.setProperty("--border-color", "rgba(255, 255, 255, 0.14)");
    root.style.setProperty("--text-primary", "#ffffff");
    root.style.setProperty("--text-main", "#ffffff");
    root.style.setProperty("--text-muted", "#b0b0cc");
    document.body.style.backgroundColor = "#0a0a12";
    document.body.style.color = "#ffffff";
  } else {
    root.style.setProperty("--bg-primary", "#faf6f8");
    root.style.setProperty("--bg-surface", "#ffffff");
    root.style.setProperty("--bg-card", "#f3e7ed");
    root.style.setProperty("--border-color", "rgba(0, 0, 0, 0.14)");
    root.style.setProperty("--text-primary", "#1a1a24");
    root.style.setProperty("--text-main", "#1a1a24");
    root.style.setProperty("--text-muted", "#665a6b");
    document.body.style.backgroundColor = "#faf6f8";
    document.body.style.color = "#1a1a24";
  }

  localStorage.setItem(
    "relist_custom_theme",
    JSON.stringify({ color1, color2, isDark })
  );
  localStorage.setItem("relist_theme", "custom");
}

export function getCurrentTheme() {
  const custom = localStorage.getItem("relist_custom_theme");
  if (custom) {
    try {
      return { id: "custom", ...JSON.parse(custom) };
    } catch (e) {}
  }
  const id = localStorage.getItem("relist_theme") || "midnight-velvet";
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function initTheme() {
  const custom = localStorage.getItem("relist_custom_theme");
  if (custom) {
    try {
      const parsed = JSON.parse(custom);
      applyCustomTheme(parsed.color1, parsed.color2, parsed.isDark);
      return;
    } catch (e) {}
  }
  const saved = localStorage.getItem("relist_theme") || "midnight-velvet";
  applyTheme(saved);
}