// frontend/src/pages/Player.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getAnimeDetails, getEpisodeCount, peekAnimeDetails } from "../services/animeService";
import { addHistory, getHistory } from "../services/historyService";
import {
  addToWatchlist,
  removeFromWatchlist,
  getAllWatchlist,
} from "../services/watchlistService";
import { syncEpisodeToAniList } from "../services/anilistService";
import { syncEpisodeToMAL, isMALAutoSyncPaused } from "../services/malService";
import { startEpisodeDownload, getDownloadsList } from "../services/downloadService";

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

export default function Player() {
  const { id, episode } = useParams();
  const navigate = useNavigate();
  const currentEp = parseInt(episode, 10) || 1;

  const [anime, setAnime] = useState(() => peekAnimeDetails(id));
  const [loading, setLoading] = useState(!anime);
  const [currentSource, setCurrentSource] = useState(() => {
    const val = parseInt(localStorage.getItem("playerSource") || "0", 10);
    return isNaN(val) ? 0 : val % EMBED_SOURCES.length;
  });
  const [language, setLanguage] = useState(() => localStorage.getItem("globalLanguage") || "sub");
  const [isTheaterMode, setIsTheaterMode] = useState(() => localStorage.getItem("playerTheater") === "1");
  const [watched, setWatched] = useState(() => {
    try {
      const saved = localStorage.getItem(`watched_${id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [inWatchlist, setInWatchlist] = useState(false);
  const [range, setRange] = useState(() => Math.floor((currentEp - 1) / RANGE_SIZE));
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState([]);

  // Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getAnimeDetails(id)
      .then((data) => {
        if (!cancelled && data) setAnime(data);
      })
      .catch((err) => console.error("Could not load anime details:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    getAllWatchlist()
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setInWatchlist(list.some((item) => String(item.anime_id) === String(id)));
        }
      })
      .catch(() => {});

    const pollDownloads = async () => {
      const list = await getDownloadsList();
      if (!cancelled) {
        setActiveDownloads(list.filter((d) => d.status === "downloading"));
      }
    };
    pollDownloads();
    const dlTimer = setInterval(pollDownloads, 1500);

    return () => {
      cancelled = true;
      clearInterval(dlTimer);
    };
  }, [id]);

  const rawCount = getEpisodeCount(anime);
  const knownCount = rawCount || anime?.episodes || null;
  const totalEpisodes = Math.max(currentEp, knownCount || currentEp);

  useEffect(() => {
    setRange(Math.floor((currentEp - 1) / RANGE_SIZE));
  }, [currentEp]);

  const rangeStart = range * RANGE_SIZE + 1;
  const rangeEnd = Math.min((range + 1) * RANGE_SIZE, totalEpisodes);

  const primaryTitle =
    (typeof anime?.title === "string" ? anime?.title : anime?.title?.english || anime?.title?.romaji) ||
    anime?.title_english ||
    "Anime";
  const englishTitle = anime?.title_english;

  useEffect(() => {
    if (!anime) return;
    const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || anime.image || "";

    addHistory({ mal_id: id, anime_id: id, title: primaryTitle, image: img, images: anime.images }, currentEp).catch(() => {});

    window.electronAPI?.setDiscordStatus(primaryTitle, currentEp, img);

    const isCompleted = knownCount && currentEp >= knownCount;
    syncEpisodeToAniList(id, currentEp, isCompleted).catch(() => {});
    if (!isMALAutoSyncPaused?.()) {
      syncEpisodeToMAL(id, currentEp, isCompleted).catch(() => {});
    }

    return () => {
      window.electronAPI?.clearDiscordStatus();
    };
  }, [id, currentEp, anime, primaryTitle, knownCount]);

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

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleTheater();
      } else if (e.key === "n" || e.key === "N") {
        if (currentEp < totalEpisodes) {
          e.preventDefault();
          navigate(`/watch/${id}/${currentEp + 1}`);
        }
      } else if (e.key === "p" || e.key === "P") {
        if (currentEp > 1) {
          e.preventDefault();
          navigate(`/watch/${id}/${currentEp - 1}`);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, currentEp, totalEpisodes]);

  const goToEpisode = (ep) => navigate(`/watch/${id}/${ep}`);

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

  const handleWatchlistToggle = async () => {
    if (!anime) return;
    const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "";
    try {
      if (inWatchlist) {
        await removeFromWatchlist(id);
        setInWatchlist(false);
        triggerToast("Removed from Watch List");
      } else {
        await addToWatchlist({
          anime_id: id,
          title: primaryTitle,
          image: img,
          status: "watching",
        });
        setInWatchlist(true);
        triggerToast("Added to Watch List!");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Failed to update watchlist");
    }
  };

  const handleDownloadThisEpisode = async () => {
    if (!anime) return;
    setDownloading(true);
    try {
      const streamUrl = EMBED_SOURCES[currentSource].build(id, currentEp, language);
      const img = anime.images?.jpg?.large_image_url || anime.image || "";
      await startEpisodeDownload(id, primaryTitle, currentEp, img, streamUrl);
      triggerToast(`Download started for Episode ${currentEp}!`);
    } catch (err) {
      console.error("Download failed:", err);
      triggerToast("Failed to start download");
    } finally {
      setDownloading(false);
    }
  };

  const source = EMBED_SOURCES[currentSource] || EMBED_SOURCES[0];
  const embedUrl = useMemo(
    () => source.build(id, currentEp, language),
    [source, id, currentEp, language]
  );

  const hasPrev = currentEp > 1;
  const hasNext = currentEp < totalEpisodes;

  let nextAiringText = null;
  if (anime?.next_airing?.airingAt) {
    const d = new Date(anime.next_airing.airingAt * 1000);
    nextAiringText = `Episode ${anime.next_airing.episode} estimated release: ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
  }

  const allRangeEpisodes = Array.from({ length: Math.max(0, rangeEnd - rangeStart + 1) }, (_, i) => rangeStart + i);
  const displayedEpisodes = episodeSearch.trim()
    ? Array.from({ length: totalEpisodes }, (_, i) => i + 1).filter((ep) => String(ep).includes(episodeSearch.trim()))
    : allRangeEpisodes;

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", padding: "16px 24px 60px", transition: "all 0.25s ease", position: "relative" }}>
      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
            padding: "12px 20px",
            borderRadius: "10px",
            border: "1px solid var(--accent-color, #ff0080)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            zIndex: 9999,
            fontWeight: 700,
            fontSize: "13px",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Top Breadcrumb Nav Bar */}
      <div style={{ maxWidth: isTheaterMode ? "100%" : "1380px", margin: "0 auto 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Link to={`/details/${id}`} style={{ color: "var(--text-muted)", fontSize: "13px", textDecoration: "none", fontWeight: 600 }}>
            ← Details
          </Link>
          <span style={{ color: "var(--border-color)" }}>/</span>
          <span style={{ fontWeight: 800, fontSize: "15px" }}>{primaryTitle}</span>
          {englishTitle && englishTitle !== primaryTitle && (
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>({englishTitle})</span>
          )}
          <span style={{ color: "var(--accent-color, #ff0080)", fontWeight: 700, fontSize: "14px" }}>
            · Episode {currentEp}
          </span>
        </div>
      </div>

      {/* Main Player Row Container */}
      <div
        style={{
          maxWidth: isTheaterMode ? "100%" : "1380px",
          margin: "0 auto",
          display: "flex",
          gap: "18px",
          alignItems: "flex-start",
        }}
      >
        {/* LEFT: Episodes Box — Stays on Left, Collapses completely in Theater Mode */}
        {!isTheaterMode && (
          <aside
            style={{
              width: "280px",
              flexShrink: 0,
              backgroundColor: "var(--bg-surface)",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "750px",
              height: "calc(100vh - 160px)",
              padding: "14px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                Episodes ({knownCount ? totalEpisodes : `${currentEp}+`})
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>[F] Theater</span>
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
                  padding: "6px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                  outline: "none",
                  width: "100%",
                  marginBottom: "8px",
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

            <input
              type="text"
              placeholder="Find episode..."
              value={episodeSearch}
              onChange={(e) => setEpisodeSearch(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "6px 10px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "12px",
                marginBottom: "10px",
                outline: "none",
              }}
            />

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "6px",
                alignContent: "start",
                paddingRight: "2px",
              }}
            >
              {displayedEpisodes.map((ep) => {
                const isWatched = watched.has(ep);
                const isCurrent = ep === currentEp;
                return (
                  <button
                    key={ep}
                    type="button"
                    onClick={() => goToEpisode(ep)}
                    style={{
                      padding: "8px 4px",
                      fontSize: "13px",
                      fontWeight: isCurrent ? 800 : 600,
                      border: isCurrent
                        ? "2px solid var(--accent-color, #ff0080)"
                        : isWatched
                        ? "1px solid rgba(16, 185, 129, 0.4)"
                        : "1px solid var(--border-color)",
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: isCurrent
                        ? "var(--accent-gradient, var(--brand-primary, #ff0080))"
                        : isWatched
                        ? "rgba(16, 185, 129, 0.14)"
                        : "var(--bg-primary)",
                      color: isCurrent ? "white" : isWatched ? "#10b981" : "var(--text-primary)",
                      minHeight: "40px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "2px",
                    }}
                  >
                    <span>{ep}</span>
                    {isWatched && !isCurrent && <span style={{ fontSize: "10px", lineHeight: 1 }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* RIGHT: Video Player Frame & Controls Below */}
        <main style={{ flex: 1, minWidth: 0, width: "100%" }}>
          {/* Iframe Frame */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: isTheaterMode ? "82vh" : "65vh",
              background: "#000000",
              borderRadius: "14px",
              overflow: "hidden",
              marginBottom: "14px",
              boxShadow: "0 12px 35px rgba(0,0,0,0.6)",
              border: "1px solid var(--border-color)",
            }}
          >
            {loading ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                Loading stream…
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                key={`${currentSource}-${language}-${currentEp}`}
                title={`Episode ${currentEp}`}
                src={embedUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          {/* Controls Bar DIRECTLY BELOW the iframe */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              padding: "12px 18px",
              borderRadius: "12px",
              marginBottom: "14px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {/* Prev / Next Buttons */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => hasPrev && goToEpisode(currentEp - 1)}
                disabled={!hasPrev}
                style={{
                  padding: "8px 16px",
                  background: hasPrev ? "var(--bg-primary)" : "transparent",
                  color: hasPrev ? "var(--text-primary)" : "var(--text-muted)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  cursor: hasPrev ? "pointer" : "not-allowed",
                  fontWeight: 600,
                  fontSize: "12.5px",
                }}
              >
                ◀ Previous Ep
              </button>

              <button
                type="button"
                onClick={() => hasNext && goToEpisode(currentEp + 1)}
                disabled={!hasNext}
                style={{
                  padding: "8px 18px",
                  background: hasNext ? "var(--accent-gradient, var(--brand-primary, #ff0080))" : "transparent",
                  color: hasNext ? "white" : "var(--text-muted)",
                  border: hasNext ? "none" : "1px solid var(--border-color)",
                  borderRadius: "8px",
                  cursor: hasNext ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  fontSize: "12.5px",
                }}
              >
                Next Ep ▶
              </button>
            </div>

            {/* Sub / Dub Switcher */}
            <div style={{ display: "flex", background: "var(--bg-primary)", padding: "2px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => { setLanguage("sub"); localStorage.setItem("globalLanguage", "sub"); }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: language === "sub" ? 800 : 600,
                  color: language === "sub" ? "#fff" : "var(--text-muted)",
                  background: language === "sub" ? "var(--accent-gradient, #ff0080)" : "transparent",
                  cursor: "pointer",
                }}
              >
                SUB
              </button>
              <button
                type="button"
                onClick={() => { setLanguage("dub"); localStorage.setItem("globalLanguage", "dub"); }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: language === "dub" ? 800 : 600,
                  color: language === "dub" ? "#fff" : "var(--text-muted)",
                  background: language === "dub" ? "var(--accent-gradient, #ff0080)" : "transparent",
                  cursor: "pointer",
                }}
              >
                DUB
              </button>
            </div>

            {/* Theater Mode & Watchlist Action */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                onClick={toggleTheater}
                style={{
                  padding: "8px 14px",
                  background: isTheaterMode ? "var(--accent-color, #ff0080)" : "var(--bg-primary)",
                  color: isTheaterMode ? "#fff" : "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "12.5px",
                }}
              >
                {isTheaterMode ? "📺 Normal View" : "🎬 Theater View"}
              </button>

              <button
                type="button"
                onClick={handleWatchlistToggle}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: inWatchlist ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-color)",
                  background: inWatchlist ? "rgba(16, 185, 129, 0.15)" : "var(--bg-primary)",
                  color: inWatchlist ? "#10b981" : "var(--text-primary)",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>{inWatchlist ? "✓ In Watchlist" : "+ Add to Watchlist"}</span>
              </button>
            </div>
          </div>

          {/* Server Switcher & Single Episode Download Button on the Right */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ marginBottom: "10px", color: "var(--text-muted)", fontSize: "13px" }}>
                You are watching <strong style={{ color: "var(--text-primary)" }}>Episode {currentEp}</strong>. If playback fails, switch servers:
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
                        padding: "7px 14px",
                        borderRadius: "8px",
                        border: active ? "none" : "1px solid var(--border-color)",
                        background: active ? "var(--accent-gradient, var(--brand-primary, #ff0080))" : "var(--bg-primary)",
                        color: active ? "white" : "var(--text-primary)",
                        fontWeight: 700,
                        fontSize: "12.5px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>▶</span> {src.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Download Episode Button */}
            <button
              type="button"
              onClick={handleDownloadThisEpisode}
              disabled={downloading}
              style={{
                padding: "11px 18px",
                borderRadius: "10px",
                border: "none",
                background: "var(--accent-gradient, #ff0080)",
                color: "#fff",
                fontWeight: 800,
                fontSize: "13px",
                cursor: downloading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(255,0,128,0.3)",
              }}
            >
              <span>📥</span> {downloading ? "Queuing..." : "Download Episode"}
            </button>
          </div>

          {/* Estimated Next Episode Release Box */}
          {nextAiringText && (
            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "10px",
                padding: "12px 18px",
                color: "#10b981",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span>⏱</span>
              <span>{nextAiringText}</span>
            </div>
          )}
        </main>
      </div>

      {/* Floating Bottom-Right Download Progress Popup Widget */}
      {activeDownloads.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            padding: "16px 20px",
            width: "320px",
            zIndex: 9999,
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          }}
        >
          {activeDownloads.map((d) => (
            <div key={d.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700 }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "210px" }}>
                  Downloading: {d.title} (Ep {d.episode})
                </span>
                <span style={{ color: "var(--accent-color, #ff0080)" }}>{d.progress}%</span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "var(--bg-primary)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${d.progress}%`, height: "100%", background: "var(--accent-gradient, #ff0080)", transition: "width 0.3s ease" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}