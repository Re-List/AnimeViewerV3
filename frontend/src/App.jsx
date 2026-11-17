// frontend/src/App.jsx
import { lazy, Suspense, useState, useEffect, useSyncExternalStore } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import SearchBar from "./components/SearchBar";
import { initTheme } from "./services/themeService";
import {
  detectLegacyMALToken,
  getMALAuthSnapshot,
  getMALAuthVersion,
  getMALStatusSnapshot,
  getMALStatusVersion,
  isMALReconnectNeeded,
  refreshMALStatus,
  startMALLogin,
  subscribeMALAuth,
  subscribeMALStatus,
} from "./services/malService";

// Secondary routes load on demand; Home stays in the initial bundle.
const WatchList = lazy(() => import("./pages/WatchList"));
const WatchListCategory = lazy(() => import("./pages/WatchListCategory"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Settings = lazy(() => import("./pages/Settings"));
const AnimeDetails = lazy(() => import("./pages/AnimeDetails"));
const Player = lazy(() => import("./pages/Player"));
const ContinueWatching = lazy(() => import("./pages/ContinueWatching"));
const Search = lazy(() => import("./pages/Search"));
const GenreResults = lazy(() => import("./pages/GenreResults"));

// Injected at build time from the root package.json (see vite.config.js).
const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

const RELEASE_CHANGELOG = [
  {
    category: "▶️ Player & Servers",
    items: [
      "Pressing the \">\" (ArrowRight) key after an episode finishes now moves to the next episode instead of replaying the end of the current one. Mid-episode seeking still works as before.",
      "Settings → Default Video Source now lists all available servers (MegaPlay, Megavid, Anixo, VidHawk, Flixera, TryEmbed, CineXtream, AniEmbed, NontonGo, Ani.pm) instead of only the first four, and the picker stays in sync with the player.",
      "Embeds that refused to load inside the player (e.g. Flixera, NontonGo) are now allowed to render in the app window, fixing ERR_BLOCKED_BY_RESPONSE on those hosts."
    ]
  },
  {
    category: "⭐ Sync & Downloads",
    items: [
      "MyAnimeList sync runs through the backend so your token is no longer stored in the app. Reconnect once from the MAL banner or Settings if you were using the old browser-stored token; watchlist, history and downloads are untouched.",
      "A MAL reconnect banner appears at the top of the app when a session needs attention, and a rejected session pauses auto-sync with a single notification instead of failing on every episode.",
      "Downloads report real progress/stage where available and can fall back across compatible hosts when a source only serves an embedded player page."
    ]
  },
  {
    category: "🐛 Fixes & Polish",
    items: [
      "Toggling the 18+ filter no longer blanks the app, and adult genres show a hidden-content notice with a one-click reveal instead of an empty page.",
      "Genre pages report provider errors with a retry button, switching player servers no longer reloads the episode, and watchlist buttons stay in sync across every card on screen.",
      "History can be cleared in one go, the genre browser starts collapsed, light-theme contrast is improved, and the initial bundle is smaller thanks to per-route loading."
    ]
  }
];

// Shown app-wide (not only in Settings) so migrated users notice that MAL sync
// stopped instead of silently losing progress.
function MALReconnectBanner() {
  useSyncExternalStore(subscribeMALStatus, getMALStatusVersion);
  useSyncExternalStore(subscribeMALAuth, getMALAuthVersion);
  const status = getMALStatusSnapshot();
  const authFailure = getMALAuthSnapshot();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("relist_mal_banner_dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    refreshMALStatus();
  }, []);

  const needsReconnect =
    status.loaded && !status.connected && (Boolean(authFailure) || isMALReconnectNeeded());

  if (!needsReconnect || dismissed) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem("relist_mal_banner_dismissed", "1");
    } catch {
      // storage unavailable
    }
    setDismissed(true);
  };

  const handleReconnect = async () => {
    setBusy(true);
    await startMALLogin();
    setBusy(false);
  };

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        padding: "10px 24px",
        background: "rgba(245, 158, 11, 0.14)",
        borderBottom: "1px solid rgba(245, 158, 11, 0.45)",
        color: "var(--text-primary)",
        fontSize: "13px",
      }}
    >
      <span aria-hidden="true">⚠️</span>
      <span style={{ flex: 1, minWidth: "220px" }}>
        <strong>{authFailure ? "MyAnimeList session expired." : "MyAnimeList sync is signed out."}</strong>{" "}
        Reconnect once to keep your progress syncing — watchlist and history are unaffected.
      </span>
      <button
        type="button"
        onClick={handleReconnect}
        disabled={busy}
        style={{
          padding: "6px 14px",
          background: "var(--accent-strong, var(--accent-color, #ff0080))",
          color: "var(--on-accent, #ffffff)",
          border: "none",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: 700,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Waiting for MAL…" : "Reconnect MAL"}
      </button>
      <Link
        to="/settings"
        style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}
      >
        Settings
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss MyAnimeList reconnect notice"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "15px",
          lineHeight: 1,
          padding: "2px 4px",
        }}
      >
        ✕
      </button>
    </div>
  );
}

function AppContent() {
  // Read once during the first render instead of flipping a flag in an effect.
  const [showWhatsNew, setShowWhatsNew] = useState(
    () => localStorage.getItem("relist_last_seen_version") !== APP_VERSION
  );
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    try {
      if (typeof initTheme === "function") initTheme();
    } catch (e) {
      console.warn("Theme init:", e);
    }

    // Migrated accounts: clear the browser token and flag the reconnect at
    // startup, so the banner appears even if Settings is never opened.
    detectLegacyMALToken();

    const checkBadges = () => {
      try {
        const stored = localStorage.getItem("relist_unread_count");
        if (stored) setUnreadBadgeCount(parseInt(stored, 10) || 0);
      } catch (error) {
        console.warn("[badges] Could not read unread count:", error?.message || error);
      }
    };
    checkBadges();
    window.addEventListener("storage", checkBadges);
    return () => window.removeEventListener("storage", checkBadges);
  }, []);

  const dismissWhatsNew = () => {
    localStorage.setItem("relist_last_seen_version", APP_VERSION);
    setShowWhatsNew(false);
  };

  return (
    <div className="app-container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      <style>{`
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: var(--border-color, rgba(128, 128, 128, 0.3));
          border-radius: 999px;
          transition: background 0.2s ease;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--accent-color, #ff0080);
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: var(--border-color, rgba(128, 128, 128, 0.3)) transparent;
        }
        header input {
          background-color: var(--bg-primary) !important;
          color: var(--text-primary) !important;
          border: 1px solid var(--border-color) !important;
        }
      `}</style>

      {/* Top Navigation Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          backdropFilter: "blur(14px)",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-color)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "18px",
          transition: "background-color 0.25s ease, border-color 0.25s ease"
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "1.25rem",
            letterSpacing: "0.5px"
          }}
        >
          <span
            style={{
              background: "var(--brand-gradient, var(--brand-primary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 900
            }}
          >
            Re:List
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              background: "var(--border-color)",
              padding: "2px 6px",
              borderRadius: "4px",
              color: "var(--text-muted)",
              fontWeight: 600
            }}
          >
            v{APP_VERSION}
          </span>
        </Link>

        <div style={{ flex: 1, maxWidth: "520px" }}>
          <SearchBar />
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            to="/"
            style={{
              color: location.pathname === "/" ? "var(--accent-color)" : "var(--text-primary)",
              textDecoration: "none",
              fontWeight: location.pathname === "/" ? 700 : 600,
              fontSize: "0.95rem",
              transition: "color 0.2s ease"
            }}
          >
            Home
          </Link>

          <Link
            to="/continue-watching"
            style={{
              color: location.pathname === "/continue-watching" ? "var(--accent-color)" : "var(--text-primary)",
              textDecoration: "none",
              fontWeight: location.pathname === "/continue-watching" ? 700 : 600,
              fontSize: "0.95rem",
              transition: "color 0.2s ease"
            }}
          >
            Continue Watching
          </Link>

          <Link
            to="/watchlist"
            style={{
              color: location.pathname.startsWith("/watchlist") ? "var(--accent-color)" : "var(--text-primary)",
              textDecoration: "none",
              fontWeight: location.pathname.startsWith("/watchlist") ? 700 : 600,
              fontSize: "0.95rem",
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "color 0.2s ease"
            }}
          >
            Watch List
            {unreadBadgeCount > 0 && (
              <span
                style={{
                  background: "#ff0055",
                  color: "#ffffff",
                  fontSize: "0.68rem",
                  fontWeight: "bold",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  boxShadow: "0 0 8px rgba(255, 0, 85, 0.6)"
                }}
              >
                {unreadBadgeCount}
              </span>
            )}
          </Link>

          <Link
            to="/schedule"
            style={{
              color: location.pathname === "/schedule" ? "var(--accent-color)" : "var(--text-primary)",
              textDecoration: "none",
              fontWeight: location.pathname === "/schedule" ? 700 : 600,
              fontSize: "0.95rem",
              transition: "color 0.2s ease"
            }}
          >
            Schedule
          </Link>

          <Link
            to="/settings"
            style={{
              color: location.pathname === "/settings" ? "var(--accent-color)" : "var(--text-primary)",
              textDecoration: "none",
              fontWeight: location.pathname === "/settings" ? 700 : 600,
              fontSize: "0.95rem",
              transition: "color 0.2s ease"
            }}
          >
            Settings
          </Link>
        </nav>
      </header>

      <MALReconnectBanner />

      {/* Main View Routes */}
      <main style={{ flex: 1 }}>
        <Suspense
          fallback={
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              Loading…
            </div>
          }
        >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/watchlist" element={<WatchList />} />
          <Route path="/watchlist/:category" element={<WatchListCategory />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/genre/:genreName" element={<GenreResults />} />

          {/* Details Routes */}
          <Route path="/details/:id" element={<AnimeDetails />} />
          <Route path="/anime/:id" element={<AnimeDetails />} />

          {/* Player Routes */}
          <Route path="/watch/:id" element={<Player />} />
          <Route path="/watch/:id/:episode" element={<Player />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/player/:id/:episode" element={<Player />} />

          <Route path="/continue-watching" element={<ContinueWatching />} />
        </Routes>
        </Suspense>
      </main>

      {/* What's New Release Modal */}
      {showWhatsNew && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "580px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.4)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "1.7rem" }}>🎉</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
                  What's New in Re:List
                </h2>
                <span style={{ fontSize: "0.8rem", color: "var(--accent-color)", fontWeight: 700 }}>
                  Version {APP_VERSION}
                </span>
              </div>
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: 1.5, marginTop: 0 }}>
              Version {APP_VERSION} adds more working player servers, fixes embeds that refused to load, and makes the
              &quot;&gt;&quot; key jump to the next episode once the current one ends. MAL users on the old token still need a one-time reconnect.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", margin: "20px 0" }}>
              {RELEASE_CHANGELOG.map((section, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "10px",
                    padding: "14px"
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                    {section.category}
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                    {section.items.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button
              onClick={dismissWhatsNew}
              style={{
                width: "100%",
                padding: "12px",
                border: "none",
                borderRadius: "10px",
                background: "var(--accent-gradient, var(--brand-primary))",
                color: "#ffffff",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.2)",
                transition: "transform 0.15s ease"
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.02)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            >
              Let's explore v{APP_VERSION}! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}