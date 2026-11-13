// frontend/src/App.jsx
import React, { useState, useEffect } from "react";
import { HashRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import WatchList from "./pages/WatchList";
import WatchListCategory from "./pages/WatchListCategory";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import AnimeDetails from "./pages/AnimeDetails";
import Player from "./pages/Player";
import ContinueWatching from "./pages/ContinueWatching";
import Search from "./pages/Search";
import GenreResults from "./pages/GenreResults";
import SearchBar from "./components/SearchBar";
import { initTheme } from "./services/themeService";

const APP_VERSION = "1.3.0";

const RELEASE_CHANGELOG = [
  {
    category: "🗂️ Genre Discovery & Browsing",
    items: [
      "Added full genre support with dedicated catalog exploration pages.",
      "Added intuitive filter by genre grid directly on the home screen.",
      "Optimized category loading speeds with instant in-memory client caching."
    ]
  },
  {
    category: "🔞 Adult Content Management",
    items: [
      "Added age limit toggle in Settings (safely hidden by default for clean browsing).",
      "Added smart external search integration for mature series and unhosted titles.",
      "Added prominent 18+ content badges on collection tiles."
    ]
  },
  {
    category: "⚡ Performance & Stability",
    items: [
      "Minor performance improvements across media cards and playlist rendering.",
      "General bug fixes for player error handling and API rate-limit management."
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

      {/* Main View Routes */}
      <main style={{ flex: 1 }}>
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
              We've packed version {APP_VERSION} with advanced genre catalogs, customizable age filters, external search integrations, and general optimizations!
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