export const THEMES = [
  {
    id: "midnight-velvet",
    name: "Midnight Velvet (Default)",
    isDark: true,
    brand: "linear-gradient(135deg, #7928ca 0%, #ff0080 100%)",
    accent: "#ff0080",
    bgPrimary: "#0a0a12",
    bgSurface: "#12121e",
    bgCard: "#181828",
    borderColor: "rgba(255, 255, 255, 0.08)",
    textMain: "#ffffff",
    textMuted: "#9e9eaf"
  },
  {
    id: "cyber-neon",
    name: "Cyber Neon",
    isDark: true,
    brand: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
    accent: "#00f2fe",
    bgPrimary: "#070b14",
    bgSurface: "#0d1527",
    bgCard: "#121e38",
    borderColor: "rgba(0, 242, 254, 0.15)",
    textMain: "#ffffff",
    textMuted: "#7fa0c7"
  },
  {
    id: "crimson-eclipse",
    name: "Crimson Eclipse",
    isDark: true,
    brand: "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)",
    accent: "#ff0844",
    bgPrimary: "#0f0608",
    bgSurface: "#1c0d11",
    bgCard: "#28141a",
    borderColor: "rgba(255, 8, 68, 0.15)",
    textMain: "#ffffff",
    textMuted: "#b58c95"
  },
  {
    id: "emerald-abyss",
    name: "Emerald Abyss",
    isDark: true,
    brand: "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)",
    accent: "#3cba92",
    bgPrimary: "#050e09",
    bgSurface: "#0b1a13",
    bgCard: "#12261c",
    borderColor: "rgba(60, 186, 146, 0.15)",
    textMain: "#ffffff",
    textMuted: "#80a894"
  },
  {
    id: "sakura-day",
    name: "Sakura Day",
    isDark: false,
    brand: "linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)",
    accent: "#ff5478",
    bgPrimary: "#faf6f8",
    bgSurface: "#ffffff",
    bgCard: "#f5ecf1",
    borderColor: "rgba(255, 117, 140, 0.2)",
    textMain: "#1a1a24",
    textMuted: "#6b6575"
  },
  {
    id: "nordic-frost",
    name: "Nordic Frost",
    isDark: false,
    brand: "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)",
    accent: "#2b5876",
    bgPrimary: "#f4f7f9",
    bgSurface: "#ffffff",
    bgCard: "#e8edf2",
    borderColor: "rgba(43, 88, 118, 0.18)",
    textMain: "#111625",
    textMuted: "#5a6478"
  }
];

export function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const root = document.documentElement;

  root.style.setProperty("--brand-primary", theme.brand);
  root.style.setProperty("--accent-color", theme.accent);
  root.style.setProperty("--bg-primary", theme.bgPrimary);
  root.style.setProperty("--bg-surface", theme.bgSurface);
  root.style.setProperty("--bg-card", theme.bgCard);
  root.style.setProperty("--border-color", theme.borderColor);
  root.style.setProperty("--text-main", theme.textMain);
  root.style.setProperty("--text-muted", theme.textMuted);
  root.style.setProperty(
    "--hero-overlay",
    theme.isDark
      ? "linear-gradient(180deg, rgba(10, 10, 18, 0.3) 0%, rgba(10, 10, 18, 0.95) 100%)"
      : "linear-gradient(180deg, rgba(250, 246, 248, 0.3) 0%, rgba(250, 246, 248, 0.95) 100%)"
  );

  document.body.style.backgroundColor = theme.bgPrimary;
  document.body.style.color = theme.textMain;

  localStorage.setItem("relist_theme", theme.id);
  localStorage.removeItem("relist_custom_theme");
}

export function applyCustomTheme(color1, color2, isDark = true) {
  const root = document.documentElement;
  const brand = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;

  root.style.setProperty("--brand-primary", brand);
  root.style.setProperty("--accent-color", color1);

  if (isDark) {
    root.style.setProperty("--bg-primary", "#0a0a12");
    root.style.setProperty("--bg-surface", "#12121e");
    root.style.setProperty("--bg-card", "#181828");
    root.style.setProperty("--border-color", "rgba(255, 255, 255, 0.08)");
    root.style.setProperty("--text-main", "#ffffff");
    root.style.setProperty("--text-muted", "#9e9eaf");
    root.style.setProperty(
      "--hero-overlay",
      "linear-gradient(180deg, rgba(10, 10, 18, 0.3) 0%, rgba(10, 10, 18, 0.95) 100%)"
    );
    document.body.style.backgroundColor = "#0a0a12";
    document.body.style.color = "#ffffff";
  } else {
    root.style.setProperty("--bg-primary", "#faf6f8");
    root.style.setProperty("--bg-surface", "#ffffff");
    root.style.setProperty("--bg-card", "#f5ecf1");
    root.style.setProperty("--border-color", "rgba(0, 0, 0, 0.08)");
    root.style.setProperty("--text-main", "#1a1a24");
    root.style.setProperty("--text-muted", "#6b6575");
    root.style.setProperty(
      "--hero-overlay",
      "linear-gradient(180deg, rgba(250, 246, 248, 0.3) 0%, rgba(250, 246, 248, 0.95) 100%)"
    );
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