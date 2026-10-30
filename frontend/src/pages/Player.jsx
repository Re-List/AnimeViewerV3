// frontend/src/pages/Player.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getHistory, addHistory } from "../services/historyService";
import {
  getAnimeDetails,
  getEpisodeCount,
  peekAnimeDetails,
} from "../services/animeService";
import { syncEpisodeToAniList } from "../services/anilistService";
import { syncEpisodeToMAL } from "../services/malService";

const EMBED_SOURCES = [
  {
    name: "MegaPlay",
    build: (id, ep, lang) => `https://megaplay.buzz/stream/mal/${id}/${ep}/${lang}`,
  },
  {
    name: "Megavid",
    build: (id, ep, lang) => `https://megavid.buzz/mal/${id}/${ep}/${lang}`,
  },
  {
    name: "Anixo",
    build: (id, ep, lang) => `https://anixo.buzz/embed/mal/${id}/${ep}?track=${lang}`,
  },
  {
    name: "VidHawk",
    build: (id, ep, lang) => `https://vidhawk.buzz/embed/mal/${id}/${ep}/${lang}`,
  },
];

const RANGE_SIZE = 100;

function readWatched(id) {
  try {
    const saved = localStorage.getItem(`watched_${id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function readProgress(id, ep) {
  try {
    const saved = localStorage.getItem(`progress_${id}_${ep}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function readNumber(key, fallback) {
  const n = parseInt(localStorage.getItem(key), 10);
  return Number.isInteger(n) ? n : fallback;
}

function buildEmbedUrl(source, id, ep, language) {
  let url = source.build(id, ep, language);
  const p = readProgress(id, ep);
  if (p && p.currentTime > 15 && p.duration > 0 && p.currentTime < p.duration - 30) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}t=${Math.floor(p.currentTime)}`;
  }
  return url;
}

function Player() {
  const { id, episode } = useParams();
  const navigate = useNavigate();
  const currentEp = parseInt(episode, 10) || 1;

  const [anime, setAnime] = useState(() => peekAnimeDetails(id));
  const [currentSource, setCurrentSource] = useState(() =>
    readNumber("playerSource", 0) % EMBED_SOURCES.length
  );
  const [language, setLanguage] = useState(
    () => localStorage.getItem("globalLanguage") || "sub"
  );
  const [watched, setWatched] = useState(() => readWatched(id));
  const [isTheaterMode, setIsTheaterMode] = useState(
    () => localStorage.getItem("playerTheater") === "1"
  );
  const [range, setRange] = useState(() => Math.floor((currentEp - 1) / RANGE_SIZE));

  useEffect(() => {
    let cancelled = false;
    getAnimeDetails(id)
      .then((data) => {
        if (!cancelled && data) setAnime(data);
      })
      .catch((err) => console.error("Could not load anime details:", err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const rawCount = getEpisodeCount(anime);
  const knownCount = rawCount || anime?.episodes || null;
  const totalEpisodes = Math.max(currentEp, knownCount || currentEp);

  useEffect(() => {
    const neededRange = Math.floor((currentEp - 1) / RANGE_SIZE);
    setRange(neededRange);
  }, [currentEp]);

  const rangeStart = range * RANGE_SIZE + 1;
  const rangeEnd = Math.min((range + 1) * RANGE_SIZE, totalEpisodes);

  const title = anime?.title_english || anime?.title || "";

  // 1. Local history, 2. Discord RPC, 3. AniList Sync, 4. MAL Sync
  useEffect(() => {
    if (!anime) return;
    const img =
      anime.images?.jpg?.large_image_url ||
      anime.images?.jpg?.image_url ||
      "";

    addHistory(id, title, img, currentEp).catch((err) =>
      console.error("Could not record history:", err)
    );

    // Discord status with current anime poster
    window.electronAPI?.setDiscordStatus(title, currentEp, img);

    // Sync to external accounts in real time
    const isCompleted = knownCount && currentEp >= knownCount;
    syncEpisodeToAniList(id, currentEp, isCompleted);
    syncEpisodeToMAL(id, currentEp, isCompleted);

    return () => {
      window.electronAPI?.clearDiscordStatus();
    };
  }, [id, currentEp, anime, title, knownCount]);

  useEffect(() => {
    setWatched((prev) => {
      if (prev.has(currentEp)) return prev;
      const next = new Set(prev);
      next.add(currentEp);
      try {
        localStorage.setItem(`watched_${id}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, [id, currentEp]);

  const hasPrev = currentEp > 1;
  const hasNext = knownCount ? currentEp < knownCount : true;

  const goToEpisode = (ep) => {
    navigate(`/player/${id}/${ep}`);
  };

  const selectSource = (idx) => {
    setCurrentSource(idx);
    localStorage.setItem("playerSource", String(idx));
  };

  const toggleLanguage = () => {
    const next = language === "sub" ? "dub" : "sub";
    setLanguage(next);
    localStorage.setItem("globalLanguage", next);
  };

  const toggleTheater = () => {
    setIsTheaterMode((prev) => {
      const next = !prev;
      localStorage.setItem("playerTheater", next ? "1" : "0");
      return next;
    });
  };

  const source = EMBED_SOURCES[currentSource] || EMBED_SOURCES[0];
  const embedUrl = useMemo(
    () => buildEmbedUrl(source, id, currentEp, language),
    [source, id, currentEp, language]
  );

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", padding: "20px 24px 60px", transition: "all 0.25s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
          {title ? `${title} · ` : ""}Episode {currentEp}
        </h2>
        <Link to={`/anime/${id}`} style={{ color: "var(--text-muted)", fontSize: "14px", textDecoration: "none", fontWeight: 500 }}>
          ← Back to details
        </Link>
      </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: isTheaterMode ? "wrap" : "nowrap" }}>
        {/* LEFT — Episode Selector */}
        <div
          style={{
            width: isTheaterMode ? "100%" : "280px",
            flexShrink: 0,
            background: "var(--bg-surface)",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            maxHeight: isTheaterMode ? "240px" : "calc(65vh + 190px)",
            overflow: "hidden",
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              Episodes ({knownCount ? totalEpisodes : `${currentEp}+`})
            </div>
            {totalEpisodes > RANGE_SIZE && (
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "7px 10px",
                  fontSize: "13px",
                  cursor: "pointer",
                  outline: "none",
                  width: "100%",
                }}
              >
                {Array.from({ length: Math.ceil(totalEpisodes / RANGE_SIZE) }, (_, i) => {
                  const startEp = i * RANGE_SIZE + 1;
                  const endEp = Math.min((i + 1) * RANGE_SIZE, totalEpisodes);
                  return (
                    <option key={i} value={i}>
                      {String(startEp).padStart(3, "0")}–{String(endEp).padStart(3, "0")}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px",
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "6px",
              alignContent: "start",
            }}
          >
            {Array.from({ length: Math.max(0, rangeEnd - rangeStart + 1) }, (_, i) => rangeStart + i).map((ep) => {
              const isWatched = watched.has(ep);
              const isCurrent = ep === currentEp;
              return (
                <button
                  key={ep}
                  onClick={() => goToEpisode(ep)}
                  title={isWatched ? `Episode ${ep} (Watched)` : `Episode ${ep}`}
                  style={{
                    padding: "8px 4px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    position: "relative",
                    border: isCurrent
                      ? "none"
                      : isWatched
                      ? "1px solid #10b981"
                      : "1px solid var(--border-color)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: isCurrent
                      ? "var(--accent-gradient)"
                      : isWatched
                      ? "rgba(16, 185, 129, 0.16)"
                      : "var(--bg-primary)",
                    color: isCurrent
                      ? "white"
                      : isWatched
                      ? "#10b981"
                      : "var(--text-primary)",
                    minHeight: "42px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{ep}</span>
                  {isWatched && !isCurrent && (
                    <span style={{ fontSize: "10px", color: "#10b981", lineHeight: 1 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Player */}
        <div style={{ flex: 1, minWidth: 0, width: "100%" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: isTheaterMode ? "82vh" : "65vh",
              background: "#000",
              borderRadius: "12px",
              overflow: "hidden",
              marginBottom: "14px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            }}
          >
            <iframe
              key={`${currentSource}-${language}`}
              title={`Episode ${currentEp}`}
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
            />

            {/* Instant Background Pre-buffering for Next Episode */}
            {hasNext && (
              <iframe
                key={`prebuffer-${currentEp + 1}`}
                title="Prebuffer Next Episode"
                src={buildEmbedUrl(source, id, currentEp + 1, language)}
                style={{ display: "none", width: 0, height: 0, border: 0 }}
                tabIndex={-1}
                aria-hidden="true"
              />
            )}
          </div>

          {/* Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              padding: "14px 20px",
              borderRadius: "10px",
              marginBottom: "14px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <button
              onClick={() => hasPrev && goToEpisode(currentEp - 1)}
              disabled={!hasPrev}
              style={{
                padding: "9px 20px",
                background: hasPrev ? "var(--bg-primary)" : "transparent",
                color: hasPrev ? "var(--text-primary)" : "var(--text-muted)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                cursor: hasPrev ? "pointer" : "not-allowed",
                fontWeight: 600,
                fontSize: "13px",
              }}
            >
              ← Previous
            </button>

            {/* Sub / Dub */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text-primary)" }}>SUB</span>
              <div
                onClick={toggleLanguage}
                role="switch"
                aria-checked={language === "dub"}
                style={{
                  width: "48px",
                  height: "26px",
                  background: "var(--bg-primary)",
                  borderRadius: "13px",
                  position: "relative",
                  cursor: "pointer",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: language === "sub" ? "3px" : "24px",
                    width: "18px",
                    height: "18px",
                    background: "var(--accent-gradient)",
                    borderRadius: "50%",
                    transition: "left 0.25s ease",
                  }}
                />
              </div>
              <span style={{ fontWeight: "600", fontSize: "13px", color: "var(--text-primary)" }}>DUB</span>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={toggleTheater}
                style={{
                  padding: "9px 18px",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                {isTheaterMode ? "📺 Normal" : "🎬 Theater"}
              </button>

              <button
                onClick={() => hasNext && goToEpisode(currentEp + 1)}
                disabled={!hasNext}
                style={{
                  padding: "9px 20px",
                  background: hasNext ? "var(--accent-gradient)" : "transparent",
                  color: hasNext ? "white" : "var(--text-muted)",
                  border: hasNext ? "none" : "1px solid var(--border-color)",
                  borderRadius: "6px",
                  cursor: hasNext ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Sources */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              padding: "14px 18px",
              color: "var(--text-muted)",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            <div style={{ marginBottom: "12px", color: "var(--text-primary)" }}>
              You&apos;re watching{" "}
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>Episode {currentEp}</span>. If playback fails, try another source:
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {EMBED_SOURCES.map((src, i) => {
                const active = i === currentSource;
                return (
                  <button
                    key={src.name}
                    type="button"
                    onClick={() => selectSource(i)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: active ? "none" : "1px solid var(--border-color)",
                      background: active ? "var(--accent-gradient)" : "var(--bg-primary)",
                      color: active ? "white" : "var(--text-primary)",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>▶</span>
                    {src.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Player;