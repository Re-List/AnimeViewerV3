import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import WatchList from "./pages/WatchList";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import AnimeDetails from "./pages/AnimeDetails";
import Player from "./pages/Player";
import ContinueWatching from "./pages/ContinueWatching";
import SearchBar from "./components/SearchBar";
import { initTheme } from "./services/themeService";

const APP_VERSION = "1.2.0";

const RELEASE_CHANGELOG = [
  {
    category: "⭐ Cloud Sync & Account Integration",
    items: [
      "1-Click MyAnimeList (MAL) PKCE OAuth login without requiring your own developer client ID.",
      "Bi-directional automatic watch progress syncing to your official MAL account.",
      "One-click full library import from MAL directly into your local Watch List.",
      "Pause & Resume auto-sync toggle button in Settings to preserve your MAL stats during rewatches."
    ]
  },
  {
    category: "📅 Simulcast Schedule & Watch List",
    items: [
      "Brand-new weekly Airing Schedule calendar organized by day with real-time countdown clocks.",
      "Unwatched episode notification badges on the Watch List navigation tab."
    ]
  },
  {
    category: "⚡ Streaming & Player",
    items: [
      "Instant next-episode pre-buffering in the player for seamless binge watching.",
      "Enhanced Discord Rich Presence showing the exact anime title, episode, and official poster art."
    ]
  },
  {
    category: "🎨 Theming & Visuals",
    items: [
      "6 built-in global themes (4 dark, 2 light) + custom hex gradient creator.",
      "Cinematic hero banners with adaptive contrast scrims for light and dark modes."
    ]
  }
];

function AppContent() {
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    try {
      if (typeof initTheme === "function") initTheme();
    } catch (e) {
      console.warn("Theme init:", e);
    }

    const lastSeenVersion = localStorage.getItem("relist_last_seen_version");
    if (lastSeenVersion !== APP_VERSION) {
      setShowWhatsNew(true);
    }

    const checkBadges = () => {
      try {
        const stored = localStorage.getItem("relist_unread_count");
        if (stored) setUnreadBadgeCount(parseInt(stored, 10) || 0);
      } catch (e) {}
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
    <div className="app-container" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Global Sleek Themed Scrollbars */}
      <style>{`
        /* Webkit / Electron Scrollbars */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          transition: background 0.2s ease;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--accent-color, #ff0080);
        }
        /* Standards-based fallback */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
      `}</style>

      {/* Top Navigation Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          backdropFilter: "blur(14px)",
          backgroundColor: "rgba(10, 10, 18, 0.78)",
          borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "18px"
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "var(--text-main, #ffffff)",
            fontWeight: "bold",
            fontSize: "1.25rem",
            letterSpacing: "0.5px"
          }}
        >
          <span
            style={{
              background: "var(--brand-primary, linear-gradient(135deg, #7928ca 0%, #ff0080 100%))",
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
              background: "rgba(255, 255, 255, 0.1)",
              padding: "2px 6px",
              borderRadius: "4px",
              color: "var(--text-muted, #9e9eaf)"
            }}
          >
            v{APP_VERSION}
          </span>
        </Link>

        <div style={{ flex: 1, maxWidth: "520px" }}>
          <SearchBar />
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            to="/"
            style={{
              color: location.pathname === "/" ? "var(--accent-color, #ff0080)" : "var(--text-main, #e0e0e0)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem"
            }}
          >
            Home
          </Link>

          <Link
            to="/watchlist"
            style={{
              color: location.pathname.startsWith("/watchlist") ? "var(--accent-color, #ff0080)" : "var(--text-main, #e0e0e0)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: "6px"
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
              color: location.pathname === "/schedule" ? "var(--accent-color, #ff0080)" : "var(--text-main, #e0e0e0)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem"
            }}
          >
            Schedule
          </Link>

          <Link
            to="/settings"
            style={{
              color: location.pathname === "/settings" ? "var(--accent-color, #ff0080)" : "var(--text-main, #e0e0e0)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem"
            }}
          >
            Settings
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/watchlist" element={<WatchList />} />
          <Route path="/watchlist/:category" element={<WatchList />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/details/:id" element={<AnimeDetails />} />
          <Route path="/watch/:id" element={<Player />} />
          <Route path="/continue-watching" element={<ContinueWatching />} />
        </Routes>
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
              backgroundColor: "var(--bg-surface, #14141f)",
              color: "var(--text-main, #ffffff)",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "580px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8)",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255, 255, 255, 0.2) transparent"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: "1.7rem" }}>🎉</span>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 800 }}>
                  What's New in Re:List
                </h2>
                <span style={{ fontSize: "0.8rem", color: "var(--accent-color, #ff0080)", fontWeight: 600 }}>
                  Version {APP_VERSION}
                </span>
              </div>
            </div>

            <p style={{ color: "var(--text-muted, #a0a0b0)", fontSize: "0.9rem", lineHeight: 1.5, marginTop: 0 }}>
              We've packed this release with official MyAnimeList sync, a live simulcast calendar, instant pre-buffering, and UI polish!
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", margin: "20px 0" }}>
              {RELEASE_CHANGELOG.map((section, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "10px",
                    padding: "14px"
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "var(--text-main, #ffffff)" }}>
                    {section.category}
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--text-muted, #c0c0d0)", fontSize: "0.85rem", lineHeight: 1.6 }}>
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
                background: "var(--brand-primary, linear-gradient(135deg, #7928ca 0%, #ff0080 100%))",
                color: "#ffffff",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(255, 0, 128, 0.35)",
                transition: "transform 0.15s ease"
              }}
              onMouseEnter={(e) => (e.target.style.transform = "scale(1.02)")}
              onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            >
              Got it, let's watch! 🚀
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