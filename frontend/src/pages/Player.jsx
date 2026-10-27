// frontend/src/pages/Player.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getHistory, addHistory } from "../services/historyService";
import {
  getAnimeDetails,
  getEpisodeCount,
  peekAnimeDetails,
} from "../services/animeService";

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
const COUNTDOWN_SECONDS = 12;
const STALL_HINT_MS = 15000;

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
    url += `${url.includes("?") ? "&" : "?"}t=${Math.floor(p.currentTime)}`;
  }
  return url;
}

function Player() {
  const { id, episode } = useParams();
  const parsed = parseInt(episode, 10);
  const currentEp = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  return <PlayerView key={`${id}:${currentEp}`} id={id} currentEp={currentEp} />;
}

function PlayerView({ id, currentEp }) {
  const navigate = useNavigate();

  const [language, setLanguage] = useState(localStorage.getItem("globalLanguage") || "sub");
  const [currentSource, setCurrentSource] = useState(
    () => readNumber("playerSource", 0) % EMBED_SOURCES.length
  );
  const [isTheaterMode, setIsTheaterMode] = useState(
    () => localStorage.getItem("playerTheater") === "1"
  );

  const [anime, setAnime] = useState(() => peekAnimeDetails(id));
  const [watchedEpisodes, setWatchedEpisodes] = useState(() => readWatched(id));
  const [range, setRange] = useState(Math.floor((currentEp - 1) / RANGE_SIZE));

  const [countdown, setCountdown] = useState(null);
  const [stalled, setStalled] = useState(false);

  const cancelAutoPlayRef = useRef(false);
  const autoNextFiredRef = useRef(false);
  const heardFromPlayerRef = useRef(false);

  const knownCount = getEpisodeCount(anime);
  const totalEpisodes = knownCount ?? Math.max(24, currentEp + 12);
  const hasNext = knownCount ? currentEp < knownCount : true;
  const hasPrev = currentEp > 1;

  const watched = useMemo(() => {
    const all = new Set(watchedEpisodes);
    all.add(currentEp);
    return all;
  }, [watchedEpisodes, currentEp]);

  const embedUrl = useMemo(
    () => buildEmbedUrl(EMBED_SOURCES[currentSource], id, currentEp, language),
    [currentSource, id, currentEp, language]
  );

  useEffect(() => {
    try {
      localStorage.setItem(`watched_${id}`, JSON.stringify([...watched]));
    } catch {
      /* ignore */
    }
  }, [watched, id]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const details = await getAnimeDetails(id);
      if (!cancelled && details) setAnime(details);

      try {
        const history = await getHistory();
        if (cancelled) return;
        setWatchedEpisodes((prev) => {
          const updated = new Set(prev);
          history
            .filter((h) => h.anime_id === parseInt(id, 10))
            .forEach((h) => updated.add(parseInt(h.episode, 10)));
          return updated;
        });
      } catch (err) {
        console.error("Could not load history:", err);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function save() {
      try {
        const details = await getAnimeDetails(id);
        if (details && !cancelled) await addHistory(details, currentEp);
      } catch (err) {
        console.error("Failed to save history:", err);
      }
    }

    save();
    return () => {
      cancelled = true;
    };
  }, [id, currentEp]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!heardFromPlayerRef.current) setStalled(true);
    }, STALL_HINT_MS);
    return () => clearTimeout(timer);
  }, [currentSource, language]);

  useEffect(() => {
    const handleMessage = (event) => {
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || data.type !== "watching-log") return;

      heardFromPlayerRef.current = true;
      setStalled(false);

      const { currentTime, duration } = data;
      if (!currentTime || !duration) return;

      try {
        localStorage.setItem(
          `progress_${id}_${currentEp}`,
          JSON.stringify({ currentTime, duration })
        );
      } catch {
        /* ignore */
      }

      if (!hasNext || cancelAutoPlayRef.current || autoNextFiredRef.current) return;

      const remaining = duration - currentTime;
      if (remaining <= 1) {
        autoNextFiredRef.current = true;
        navigate(`/player/${id}/${currentEp + 1}`);
      } else if (remaining <= COUNTDOWN_SECONDS) {
        setCountdown(Math.ceil(remaining));
      } else {
        setCountdown(null);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [id, currentEp, hasNext, navigate]);

  const goToEpisode = (ep) => navigate(`/player/${id}/${ep}`);

  const toggleLanguage = () => {
    const newLang = language === "sub" ? "dub" : "sub";
    heardFromPlayerRef.current = false;
    setStalled(false);
    setLanguage(newLang);
    localStorage.setItem("globalLanguage", newLang);
  };

  const selectSource = (i) => {
    if (i === currentSource) return;
    heardFromPlayerRef.current = false;
    setStalled(false);
    setCurrentSource(i);
    localStorage.setItem("playerSource", String(i));
  };

  const toggleTheater = () => {
    const next = !isTheaterMode;
    setIsTheaterMode(next);
    localStorage.setItem("playerTheater", next ? "1" : "0");
  };

  const cancelAutoNext = () => {
    cancelAutoPlayRef.current = true;
    setCountdown(null);
  };

  const title = anime?.title_english || anime?.title;
  const rangeStart = range * RANGE_SIZE + 1;
  const rangeEnd = Math.min(rangeStart + RANGE_SIZE - 1, totalEpisodes);
  const isOngoing =
    anime?.status === "Currently Airing" ||
    anime?.status === "RELEASING" ||
    (anime?.next_episode != null && anime.next_episode > 0);
  const nextEpNum = anime?.next_episode || (knownCount ? knownCount + 1 : null);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "white", padding: "15px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "15px" }}>
        <h2 style={{ margin: 0 }}>
          {title ? `${title} · ` : ""}Episode {currentEp}
        </h2>
        <Link to={`/anime/${id}`} style={{ color: "#3b82f6", fontSize: "14px", textDecoration: "none" }}>
          ← Back to details
        </Link>
      </div>

      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
        {/* LEFT — episodes */}
        <div
          style={{
            width: "280px",
            flexShrink: 0,
            background: "#141414",
            borderRadius: "10px",
            border: "1px solid #222",
            display: "flex",
            flexDirection: "column",
            maxHeight: isTheaterMode ? "82vh" : "calc(65vh + 200px)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #222", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#ddd" }}>
              Episodes ({knownCount ? totalEpisodes : `${currentEp}+`})
            </div>
            {totalEpisodes > RANGE_SIZE && (
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                style={{
                  background: "#1f1f1f",
                  color: "white",
                  border: "1px solid #333",
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
                  style={{
                    padding: "10px 4px",
                    fontSize: "13px",
                    fontWeight: "bold",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: isCurrent ? "#3b82f6" : isWatched ? "#3f4a3f" : "#1f1f1f",
                    color: isCurrent ? "white" : isWatched ? "#a7f3d0" : "#ddd",
                    minHeight: "40px",
                  }}
                >
                  {ep}
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — player + controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: isTheaterMode ? "82vh" : "65vh",
              background: "#000",
              borderRadius: "12px",
              overflow: "hidden",
              marginBottom: stalled ? "10px" : "14px",
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

            {countdown !== null && (
              <div
                style={{
                  position: "absolute",
                  top: "14px",
                  right: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  background: "rgba(0,0,0,0.82)",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "14px",
                }}
              >
                <span>Next episode in {countdown}s</span>
                <button
                  onClick={cancelAutoNext}
                  style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {stalled && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
                background: "#2a1f12",
                border: "1px solid #5c4320",
                color: "#f5d9a8",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "12px",
                fontSize: "13px",
              }}
            >
              <span>Player seems stuck. Try switching the source or language.</span>
              <button
                onClick={() => setStalled(false)}
                aria-label="Dismiss"
                style={{ background: "transparent", color: "#f5d9a8", border: "1px solid #5c4320", borderRadius: "6px", padding: "6px 10px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#1f1f1f",
              padding: "15px 20px",
              borderRadius: "8px",
              marginBottom: "12px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <button
              onClick={() => hasPrev && goToEpisode(currentEp - 1)}
              disabled={!hasPrev}
              style={{ padding: "10px 24px", background: hasPrev ? "#3b82f6" : "#374151", color: "white", border: "none", borderRadius: "6px", cursor: hasPrev ? "pointer" : "not-allowed", fontWeight: "bold" }}
            >
              ← Previous
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontWeight: "600", fontSize: "13px" }}>SUB</span>
              <div
                onClick={toggleLanguage}
                role="switch"
                aria-checked={language === "dub"}
                aria-label="Switch between sub and dub"
                style={{
                  width: "48px",
                  height: "26px",
                  background: "#374151",
                  borderRadius: "13px",
                  position: "relative",
                  cursor: "pointer",
                  border: "2px solid #4b5563",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: language === "sub" ? "3px" : "22px",
                    width: "18px",
                    height: "18px",
                    background: "white",
                    borderRadius: "50%",
                    transition: "left 0.25s ease",
                  }}
                />
              </div>
              <span style={{ fontWeight: "600", fontSize: "13px" }}>DUB</span>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                onClick={toggleTheater}
                style={{ padding: "10px 18px", background: "#2a2a2a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
              >
                {isTheaterMode ? "📺 Normal" : "🎬 Theater"}
              </button>

              <button
                onClick={() => hasNext && goToEpisode(currentEp + 1)}
                disabled={!hasNext}
                style={{ padding: "10px 24px", background: hasNext ? "#3b82f6" : "#374151", color: "white", border: "none", borderRadius: "6px", cursor: hasNext ? "pointer" : "not-allowed", fontWeight: "bold" }}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Tip + 4 source buttons */}
          <div
            style={{
              background: "#151a22",
              border: "1px solid #243044",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "12px",
              color: "#9ca3af",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            <div style={{ marginBottom: "10px" }}>
              You&apos;re watching{" "}
              <span style={{ color: "#60a5fa", fontWeight: 600 }}>Episode {currentEp}</span>.
              <br />
              If the current server doesn&apos;t work, please try other sources below.
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
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: active ? "1px solid #3b82f6" : "1px solid #333",
                      background: active ? "#3b82f6" : "#1f1f1f",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "11px", opacity: active ? 1 : 0.7 }}>▶</span>
                    {src.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next episode for ongoing anime */}
          {isOngoing && nextEpNum && (
            <div
              style={{
                background: "#1a1f2a",
                border: "1px solid #2a3548",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#cbd5e1",
                fontSize: "13px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <span style={{ fontSize: "16px", lineHeight: 1.2 }}>🔔</span>
              <div>
                The next episode is expected to be{" "}
                <strong style={{ color: "#93c5fd" }}>Episode {nextEpNum}</strong>
                {anime?.status ? (
                  <>
                    {" "}
                    · Status: <span style={{ color: "#a7f3d0" }}>{anime.status}</span>
                  </>
                ) : null}
                . Check back later when it airs.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Player;