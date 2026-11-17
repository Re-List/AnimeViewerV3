export const THEMES = [
  {
    id: "midnight-velvet",
    name: "Midnight Velvet (Default)",
    type: "Dark Theme",
    isDark: true,
    preview: "linear-gradient(135deg, #7928ca 0%, #ff0080 100%)",
    brand: "linear-gradient(135deg, #7928ca 0%, #ff0080 100%)",
    accent: "#ff0080",
    accentStrong: "#b3125c",
    onAccent: "#ffffff",
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
    accentStrong: "#00b8c4",
    onAccent: "#05121a",
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
    accentStrong: "#b80033",
    onAccent: "#ffffff",
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
    accentStrong: "#0d7a5b",
    onAccent: "#ffffff",
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
    accentStrong: "#c02b4e",
    onAccent: "#ffffff",
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
    accentStrong: "#2b5876",
    onAccent: "#ffffff",
    bgPrimary: "#f4f7f9",
    bgSurface: "#ffffff",
    bgCard: "#e3eaf1",
    borderColor: "rgba(43, 88, 118, 0.3)",
    textPrimary: "#111625",
    textMuted: "#505c70"
  }
];

// Genre link colors, verified against each background:
// dark palette 9.2 / 7.3 / 10.3 / 11.8 / 7.3 : 1 on #0a0a12
// light palette 5.5 / 6.6 / 5.1 / 4.6 / 5.9 : 1 on #faf6f8
const GENRES_DARK = ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185"];
const GENRES_LIGHT = ["#0369a1", "#6d28d9", "#047857", "#a16207", "#be123c"];

function hexToRgb(hex) {
  const clean = String(hex).replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function mixColor(hex, target, amount) {
  const from = hexToRgb(hex);
  const to = hexToRgb(target);
  return rgbToHex(from.map((v, i) => v + (to[i] - v) * amount));
}

// Text-bearing accent surfaces: keep a bright brand color when dark ink reads
// well on it, otherwise darken it until white text reaches 4.5:1.
function accentSurface(color) {
  const darkInk = "#05121a";
  if (contrastRatio(color, darkInk) >= 4.5) {
    return { accentStrong: color, onAccent: darkInk };
  }

  let candidate = color;
  for (let step = 0; step < 24 && contrastRatio(candidate, "#ffffff") < 4.5; step += 1) {
    candidate = mixColor(candidate, "#000000", 0.06);
  }
  return { accentStrong: candidate, onAccent: "#ffffff" };
}

function applyTokens(theme) {
  const root = document.documentElement;
  const genres = theme.isDark ? GENRES_DARK : GENRES_LIGHT;

  root.style.setProperty("--brand-gradient", theme.brand);
  root.style.setProperty("--brand-primary", theme.brand);
  root.style.setProperty("--accent-gradient", theme.brand);
  root.style.setProperty("--accent-color", theme.accent);
  root.style.setProperty("--accent-strong", theme.accentStrong);
  root.style.setProperty("--on-accent", theme.onAccent);
  root.style.setProperty("--bg-primary", theme.bgPrimary);
  root.style.setProperty("--bg-surface", theme.bgSurface);
  root.style.setProperty("--bg-card", theme.bgCard);
  root.style.setProperty("--border-color", theme.borderColor);
  root.style.setProperty("--text-primary", theme.textPrimary);
  root.style.setProperty("--text-main", theme.textPrimary);
  root.style.setProperty("--text-muted", theme.textMuted);
  genres.forEach((color, index) => {
    root.style.setProperty(`--genre-${index + 1}`, color);
  });
  root.style.setProperty(
    "--hero-overlay",
    theme.isDark
      ? "linear-gradient(180deg, rgba(10, 10, 18, 0.3) 0%, rgba(10, 10, 18, 0.95) 100%)"
      : "linear-gradient(180deg, rgba(250, 246, 248, 0.3) 0%, rgba(250, 246, 248, 0.95) 100%)"
  );

  document.body.style.backgroundColor = theme.bgPrimary;
  document.body.style.color = theme.textPrimary;
}

export function applyTheme(themeId) {
  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
  applyTokens(theme);

  localStorage.setItem("relist_theme", theme.id);
  localStorage.removeItem("relist_custom_theme");
}

export function applyCustomTheme(color1, color2, isDark = true) {
  const brand = `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
  const { accentStrong, onAccent } = accentSurface(color1);

  const base = isDark
    ? {
        bgPrimary: "#0a0a12",
        bgSurface: "#141420",
        bgCard: "#191929",
        borderColor: "rgba(255, 255, 255, 0.14)",
        textPrimary: "#ffffff",
        textMuted: "#b0b0cc",
      }
    : {
        bgPrimary: "#faf6f8",
        bgSurface: "#ffffff",
        bgCard: "#f3e7ed",
        borderColor: "rgba(0, 0, 0, 0.14)",
        textPrimary: "#1a1a24",
        textMuted: "#665a6b",
      };

  applyTokens({
    ...base,
    isDark,
    brand,
    accent: color1,
    accentStrong,
    onAccent,
  });

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
    } catch (error) {
      console.warn("[theme] Ignoring corrupt custom theme:", error?.message || error);
    }
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
    } catch (error) {
      console.warn("[theme] Could not restore custom theme:", error?.message || error);
    }
  }
  const saved = localStorage.getItem("relist_theme") || "midnight-velvet";
  applyTheme(saved);
}
