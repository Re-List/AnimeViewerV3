// frontend/src/pages/Settings.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { getHistory, removeHistoryItem } from "../services/historyService";
import {
  getWatchlistByStatus,
  getAllWatchlist,
  importWatchlistBulk,
  removeFromWatchlist,
} from "../services/watchlistService";
import { THEMES, applyTheme, applyCustomTheme, getCurrentTheme } from "../services/themeService";
import {
  getAniListToken,
  saveAniListToken,
  removeAniListToken,
  getAniListUser,
  fetchViewerProfile,
} from "../services/anilistService";
import {
  getMALToken,
  saveMALToken,
  removeMALToken,
  getMALUser,
  isMALAutoSyncPaused,
  setMALAutoSyncPaused,
} from "../services/malService";

const SOURCES = ["MegaPlay", "Megavid", "Anixo", "VidHawk"];

function Settings() {
  // Extract the string ID so comparisons work
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    const t = getCurrentTheme();
    return typeof t === "object" ? t.id : t;
  });
  const [customColor1, setCustomColor1] = useState("#8b5cf6");
  const [customColor2, setCustomColor2] = useState("#ec4899");
  const [customIsDark, setCustomIsDark] = useState(true);

  // AniList State
  const [anilistToken, setAnilistToken] = useState(getAniListToken);
  const [anilistUser, setAnilistUser] = useState(getAniListUser);
  const [tokenInput, setTokenInput] = useState("");
  const [connectingAniList, setConnectingAniList] = useState(false);

  // MyAnimeList (MAL) State
  const [malToken, setMalToken] = useState(getMALToken);
  const [malUser, setMalUser] = useState(getMALUser);
  const [authorizingMAL, setAuthorizingMAL] = useState(false);
  const [syncingMALList, setSyncingMALList] = useState(false);
  const [malSyncPaused, setMalSyncPaused] = useState(isMALAutoSyncPaused);

  const [globalLanguage, setGlobalLanguage] = useState(
    () => localStorage.getItem("globalLanguage") || "sub"
  );
  const [defaultSource, setDefaultSource] = useState(
    () => parseInt(localStorage.getItem("playerSource") || "0", 10) % SOURCES.length
  );
  const [autoNext, setAutoNext] = useState(
    () => localStorage.getItem("autoNext") !== "0"
  );
  const [theaterDefault, setTheaterDefault] = useState(
    () => localStorage.getItem("playerTheater") === "1"
  );

  const [history, setHistory] = useState([]);
  const [watchlistStats, setWatchlistStats] = useState({
    watching: 0,
    completed: 0,
    onhold: 0,
    dropped: 0,
    planned: 0,
    total: 0,
  });

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSelectTheme = (themeId, themeName) => {
    applyTheme(themeId);
    setCurrentThemeId(themeId);
    triggerToast(`Theme set to ${themeName}`);
  };

  const handleApplyCustom = () => {
    applyCustomTheme(customColor1, customColor2, customIsDark);
    setCurrentThemeId("custom");
    triggerToast("Custom gradient theme applied!");
  };

  const handleConnectAniList = async () => {
    if (!tokenInput.trim()) {
      triggerToast("Please paste an AniList access token first.");
      return;
    }
    setConnectingAniList(true);
    try {
      const user = await fetchViewerProfile(tokenInput.trim());
      if (user) {
        saveAniListToken(tokenInput.trim());
        setAnilistToken(tokenInput.trim());
        setAnilistUser(user);
        setTokenInput("");
        triggerToast(`Connected to AniList as ${user.name}!`);
      } else {
        triggerToast("Failed to verify token with AniList.");
      }
    } catch {
      triggerToast("Error authenticating AniList token.");
    } finally {
      setConnectingAniList(false);
    }
  };

  const handleDisconnectAniList = () => {
    removeAniListToken();
    setAnilistToken(null);
    setAnilistUser(null);
    triggerToast("AniList account disconnected.");
  };

  const handleToggleMALPause = () => {
    const next = !malSyncPaused;
    setMALAutoSyncPaused(next);
    setMalSyncPaused(next);
    triggerToast(next ? "MAL auto-sync paused" : "MAL auto-sync resumed");
  };

  const handleDisconnectMAL = async () => {
    try {
      await axios.post("http://localhost:5000/auth/mal/disconnect");
    } catch {}
    removeMALToken();
    setMalToken(null);
    setMalUser(null);
    triggerToast("MyAnimeList account disconnected.");
  };

  const handleSyncMALWatchlist = async () => {
    const t = malToken || getMALToken();
    if (!t) {
      triggerToast("Please connect to MyAnimeList first.");
      return;
    }
    setSyncingMALList(true);
    triggerToast("Pulling watchlist from MyAnimeList…");

    try {
      const res = await axios.post("http://localhost:5000/auth/mal/sync-watchlist", { token: t });
      if (res.data?.success) {
        triggerToast(`🎉 Synced ${res.data.count} anime from MyAnimeList into Re:List!`);
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      triggerToast("Failed to pull watchlist from MAL.");
    } finally {
      setSyncingMALList(false);
    }
  };

  const handleStartMALLogin = () => {
    setAuthorizingMAL(true);
    const loginUrl = "http://localhost:5000/auth/mal/login";

    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(loginUrl);
    } else {
      window.open(loginUrl, "_blank");
    }

    triggerToast("Opening browser for MyAnimeList login...");

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        clearInterval(interval);
        setAuthorizingMAL(false);
      }
      try {
        const res = await axios.get("http://localhost:5000/auth/mal/status");
        if (res.data?.token) {
          clearInterval(interval);
          setMalToken(res.data.token);
          setMalUser(res.data.user);
          saveMALToken(res.data.token);
          if (res.data.user) {
            localStorage.setItem("relist_mal_user", JSON.stringify(res.data.user));
          }
          setAuthorizingMAL(false);
          triggerToast(`🎉 Connected as ${res.data.user?.name || "MAL User"}!`);
        }
      } catch {}
    }, 2000);
  };

  useEffect(() => {
    async function loadStatsData() {
      try {
        const historyData = await getHistory();
        setHistory(historyData || []);

        const [watching, completed, onhold, dropped, planned] = await Promise.all([
          getWatchlistByStatus("watching"),
          getWatchlistByStatus("completed"),
          getWatchlistByStatus("onhold"),
          getWatchlistByStatus("dropped"),
          getWatchlistByStatus("planned"),
        ]);

        setWatchlistStats({
          watching: watching.length,
          completed: completed.length,
          onhold: onhold.length,
          dropped: dropped.length,
          planned: planned.length,
          total:
            watching.length +
            completed.length +
            onhold.length +
            dropped.length +
            planned.length,
        });
      } catch (err) {
        console.error("Error loading stats context:", err);
      }
    }
    loadStatsData();
  }, []);

  const handleLanguageChange = (mode) => {
    setGlobalLanguage(mode);
    localStorage.setItem("globalLanguage", mode);
    triggerToast(`Default playback set to ${mode.toUpperCase()}`);
  };

  const handleSourceChange = (i) => {
    setDefaultSource(i);
    localStorage.setItem("playerSource", String(i));
    triggerToast(`Default source → ${SOURCES[i]}`);
  };

  const handleAutoNext = (on) => {
    setAutoNext(on);
    localStorage.setItem("autoNext", on ? "1" : "0");
    triggerToast(on ? "Auto-next enabled" : "Auto-next disabled");
  };

  const handleTheater = (on) => {
    setTheaterDefault(on);
    localStorage.setItem("playerTheater", on ? "1" : "0");
    triggerToast(on ? "Theater mode default: On" : "Theater mode default: Off");
  };

  const card = {
    background: "var(--bg-surface)",
    borderRadius: "14px",
    border: "1px solid var(--border-color)",
    padding: "22px",
    minHeight: "160px",
    display: "flex",
    flexDirection: "column",
    transition: "all 0.25s ease",
  };

  // High-contrast pill styling with visible borders
  const pill = (active) => ({
    padding: "10px 16px",
    borderRadius: "8px",
    border: active ? "1px solid transparent" : "1px solid var(--border-color)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    color: active ? "#ffffff" : "var(--text-primary)",
    background: active ? "var(--accent-gradient)" : "var(--bg-surface)",
    boxShadow: active ? "0 4px 12px rgba(0, 0, 0, 0.3)" : "none",
    transition: "all 0.2s ease",
  });

  const title = {
    fontSize: "16px",
    margin: "0 0 6px",
    fontWeight: 600,
    color: "var(--text-primary)",
  };
  const desc = {
    color: "var(--text-muted)",
    fontSize: "13px",
    margin: "0 0 14px",
    lineHeight: 1.4,
  };

  return (
    <div
      style={{
        background: "var(--bg-primary)",
        minHeight: "100vh",
        color: "var(--text-primary)",
        padding: "24px 28px 60px",
        position: "relative",
        transition: "all 0.25s ease",
      }}
    >
      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
            padding: "12px 18px",
            borderRadius: "10px",
            zIndex: 2000,
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          }}
        >
          {toastMessage}
        </div>
      )}

      <h1
        style={{
          margin: "0 0 6px",
          fontSize: "24px",
          fontWeight: 700,
          background: "var(--brand-gradient)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Application Settings
      </h1>
      <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: "13px" }}>
        Custom themes, account integrations, playback preferences, and tools
      </p>

      {/* --- PRESET THEMES BOX --- */}
      <div style={{ ...card, marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div>
            <h2 style={{ ...title, fontSize: "18px" }}>🎨 Color Themes & Gradients</h2>
            <p style={{ ...desc, margin: 0 }}>
              Select a preset gradient scheme to transform the entire application.
            </p>
          </div>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              background: "var(--accent-gradient)",
              color: "white",
            }}
          >
            Active Theme: {currentThemeId === "custom" ? "Custom Gradient" : (THEMES.find((t) => t.id === currentThemeId)?.name || currentThemeId)}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
          {THEMES.map((t) => {
            const isSelected = currentThemeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTheme(t.id, t.name)}
                style={{
                  background: isSelected ? "var(--bg-surface)" : "transparent",
                  border: isSelected ? "2px solid var(--accent-color, #ff0080)" : "1px solid var(--border-color)",
                  borderRadius: "10px",
                  padding: "10px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                  boxShadow: isSelected ? "0 0 14px rgba(255, 0, 128, 0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: t.preview, flexShrink: 0, border: "2px solid rgba(255,255,255,0.2)" }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{t.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>{t.type}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- CUSTOM GRADIENT CREATOR BOX --- */}
      <div style={{ ...card, marginBottom: "24px" }}>
        <h2 style={{ ...title, fontSize: "18px" }}>🖌️ Custom Gradient Creator</h2>
        <p style={desc}>
          Pick any two hex colors to create your own personalized gradient theme.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap", marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Color 1:</label>
            <input
              type="color"
              value={customColor1}
              onChange={(e) => setCustomColor1(e.target.value)}
              style={{ width: "40px", height: "36px", border: "none", borderRadius: "6px", cursor: "pointer", background: "transparent" }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{customColor1}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Color 2:</label>
            <input
              type="color"
              value={customColor2}
              onChange={(e) => setCustomColor2(e.target.value)}
              style={{ width: "40px", height: "36px", border: "none", borderRadius: "6px", cursor: "pointer", background: "transparent" }}
            />
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{customColor2}</span>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={() => setCustomIsDark(true)} style={pill(customIsDark)}>
              Dark Base
            </button>
            <button type="button" onClick={() => setCustomIsDark(false)} style={pill(!customIsDark)}>
              Light Base
            </button>
          </div>

          <button
            type="button"
            onClick={handleApplyCustom}
            style={{
              padding: "10px 22px",
              borderRadius: "8px",
              border: "none",
              color: "white",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${customColor1}, ${customColor2})`,
              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            }}
          >
            Apply Custom Gradient
          </button>
        </div>
      </div>

      {/* --- SETTINGS GRID --- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", alignItems: "stretch" }}>
        {/* AniList Live Auto-Sync */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h2 style={{ ...title, margin: 0 }}>🌐 AniList Auto-Sync</h2>
            {anilistUser && (
              <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700 }}>● Connected</span>
            )}
          </div>
          <p style={desc}>
            Automatically update your AniList profile whenever you watch an episode.
          </p>

          <div style={{ marginTop: "auto" }}>
            {anilistUser ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "var(--bg-surface)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img
                    src={anilistUser.avatar?.medium || anilistUser.avatar?.large}
                    alt={anilistUser.name}
                    style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                      {anilistUser.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "#10b981" }}>Auto-Sync Active</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectAniList}
                  style={{ padding: "6px 12px", background: "transparent", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="password"
                    placeholder="Paste AniList Token..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", background: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "6px", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
                  />
                  <button
                    type="button"
                    disabled={connectingAniList}
                    onClick={handleConnectAniList}
                    style={{ padding: "8px 14px", background: "var(--accent-gradient)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}
                  >
                    {connectingAniList ? "…" : "Link"}
                  </button>
                </div>
                <a
                  href="https://anilist.co/api/v2/oauth/authorize?client_id=20815&response_type=token"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (window.electronAPI?.openExternal) {
                      e.preventDefault();
                      window.electronAPI.openExternal("https://anilist.co/api/v2/oauth/authorize?client_id=20815&response_type=token");
                    }
                  }}
                  style={{ fontSize: "11px", color: "var(--accent-color, #38bdf8)", textDecoration: "none", cursor: "pointer" }}
                >
                  🔑 Click here to generate your AniList token ↗
                </a>
              </div>
            )}
          </div>
        </div>

        {/* MyAnimeList (MAL) 1-Click Sign In */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h2 style={{ ...title, margin: 0 }}>⭐ MyAnimeList Sync</h2>
            {(malUser || malToken) && (
              <span style={{ fontSize: "11px", color: malSyncPaused ? "#f59e0b" : "#10b981", fontWeight: 700 }}>
                {malSyncPaused ? "⏸ Auto-Sync Paused" : "● Auto-Sync Active"}
              </span>
            )}
          </div>
          <p style={desc}>
            Auto-sync your watch progress and pull your full MAL watchlist into Re:List.
          </p>

          <div style={{ marginTop: "auto" }}>
            {(malUser || malToken) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "var(--bg-surface)", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {malUser?.picture ? (
                      <img
                        src={malUser.picture}
                        alt={malUser.name}
                        style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#2e51a2", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "12px" }}>
                        MAL
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {malUser?.name || "Connected Account"}
                      </div>
                      <div style={{ fontSize: "11px", color: malSyncPaused ? "#f59e0b" : "#10b981" }}>
                        {malSyncPaused ? "Auto-Sync is Paused" : "Auto-Sync is Active"}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectMAL}
                    style={{ padding: "6px 12px", background: "transparent", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}
                  >
                    Disconnect
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={handleToggleMALPause}
                    style={{
                      padding: "8px 12px",
                      background: malSyncPaused ? "var(--accent-gradient)" : "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      color: malSyncPaused ? "white" : "var(--text-primary)",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <span>{malSyncPaused ? "▶ Resume Sync" : "⏸ Pause Sync"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={syncingMALList}
                    onClick={() => handleSyncMALWatchlist()}
                    style={{
                      padding: "8px 12px",
                      background: "var(--accent-gradient)",
                      border: "none",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "5px",
                    }}
                  >
                    <span>🔄</span>
                    <span>{syncingMALList ? "Pulling…" : "Manual Sync"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  disabled={authorizingMAL}
                  onClick={handleStartMALLogin}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    background: "#2e51a2",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 14px rgba(46, 81, 162, 0.3)",
                  }}
                >
                  <span>⭐</span>
                  <span>{authorizingMAL ? "Waiting for authorization…" : "Sign in with MyAnimeList"}</span>
                </button>

                {authorizingMAL && (
                  <p style={{ margin: "8px 0 0", fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
                    Browser didn't open?{" "}
                    <a
                      href="http://localhost:5000/auth/mal/login"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        if (window.electronAPI?.openExternal) {
                          window.electronAPI.openExternal("http://localhost:5000/auth/mal/login");
                        } else {
                          window.open("http://localhost:5000/auth/mal/login", "_blank");
                        }
                      }}
                      style={{ color: "var(--accent-color, #38bdf8)", textDecoration: "underline", cursor: "pointer" }}
                    >
                      Click here to launch
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Playback Preferences */}
        <div style={card}>
          <h2 style={title}>Playback Preferences</h2>
          <p style={desc}>Default audio language for new episodes.</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "auto" }}>
            <button type="button" onClick={() => handleLanguageChange("sub")} style={pill(globalLanguage === "sub")}>
              Japanese (SUB)
            </button>
            <button type="button" onClick={() => handleLanguageChange("dub")} style={pill(globalLanguage === "dub")}>
              English (DUB)
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={card}>
          <h2 style={title}>📊 Quick Stats</h2>
          <p style={desc}>Snapshot of your list and history.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto" }}>
            {[
              { label: "Watching", value: watchlistStats.watching, color: "#3b82f6" },
              { label: "Completed", value: watchlistStats.completed, color: "#10b981" },
              { label: "Planned", value: watchlistStats.planned, color: "#8b5cf6" },
              { label: "History", value: history.length, color: "#94a3b8" },
            ].map((s) => (
              <div key={s.label} style={{ background: "var(--bg-surface)", borderRadius: "10px", border: "1px solid var(--border-color)", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Default Source */}
        <div style={card}>
          <h2 style={title}>Default Video Source</h2>
          <p style={desc}>Used first when you open the player.</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "auto" }}>
            {SOURCES.map((name, i) => (
              <button key={name} type="button" onClick={() => handleSourceChange(i)} style={pill(defaultSource === i)}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Theater Mode */}
        <div style={card}>
          <h2 style={title}>🎬 Theater Mode</h2>
          <p style={desc}>Open the player expanded by default.</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
            <button type="button" onClick={() => handleTheater(true)} style={pill(theaterDefault)}>
              On
            </button>
            <button type="button" onClick={() => handleTheater(false)} style={pill(!theaterDefault)}>
              Off
            </button>
          </div>
        </div>

        {/* Auto Next */}
        <div style={card}>
          <h2 style={title}>Auto-Next Episode</h2>
          <p style={desc}>Jump to the next episode near the end of playback.</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
            <button type="button" onClick={() => handleAutoNext(true)} style={pill(autoNext)}>
              On
            </button>
            <button type="button" onClick={() => handleAutoNext(false)} style={pill(!autoNext)}>
              Off
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;