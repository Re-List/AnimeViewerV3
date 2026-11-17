// frontend/src/pages/Player.jsx
import { useCallback, useMemo, useRef, useState, useEffect, useSyncExternalStore } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getAnimeDetails, getEpisodeCount, peekAnimeDetails } from "../services/animeService";
import { addHistory } from "../services/historyService";
import { addToWatchlist, removeFromWatchlist } from "../services/watchlistService";
import {
  ensureWatchlistLoaded,
  getWatchlistIndexVersion,
  isInWatchlist,
  setInWatchlist,
  subscribeWatchlistIndex,
} from "../services/watchlistIndex";
import { isAdultAnime } from "../services/adultFilter";
import { syncEpisodeToAniList } from "../services/anilistService";
import {
  syncEpisodeToMAL,
  isMALAutoSyncPaused,
  getMALAuthSnapshot,
  getMALAuthVersion,
  subscribeMALAuth,
} from "../services/malService";
import {
  startEpisodeDownload,
  getDownloadsList,
  describeDownloadProgress,
  isIndeterminateDownload,
} from "../services/downloadService";
import { PLAYER_SOURCES as STANDARD_SOURCES } from "../services/playerSources";

const RANGE_SIZE = 100;

export default function Player() {
  const { id, episode } = useParams();
  const navigate = useNavigate();
  const currentEp = parseInt(episode, 10) || 1;

  const [anime, setAnime] = useState(() => peekAnimeDetails(id));
  const [loading, setLoading] = useState(!anime);
  
  // Track iframe connection status and adult content flag
  const [loadedEmbedUrl, setLoadedEmbedUrl] = useState(null);
  const [isAdult, setIsAdult] = useState(false);

  const [currentSource, setCurrentSource] = useState(() => {
    const val = parseInt(localStorage.getItem("playerSource") || "0", 10);
    return isNaN(val) ? 0 : val;
  });
  
  const [language, setLanguage] = useState(() => localStorage.getItem("globalLanguage") || "sub");
  const [isTheaterMode, setIsTheaterMode] = useState(() => localStorage.getItem("playerTheater") === "1");
  // Derived from storage + the current episode (no setState inside an effect).
  const watched = useMemo(() => {
    const set = new Set();
    try {
      const saved = localStorage.getItem(`watched_${id}`);
      if (saved) JSON.parse(saved).forEach((ep) => set.add(ep));
    } catch {
      // Corrupt entry: start from an empty set.
    }
    set.add(currentEp);
    return set;
  }, [id, currentEp]);

  useEffect(() => {
    try {
      localStorage.setItem(`watched_${id}`, JSON.stringify([...watched]));
    } catch (error) {
      console.warn("Could not persist watched episodes:", error?.message || error);
    }
  }, [id, watched]);

  useSyncExternalStore(subscribeWatchlistIndex, getWatchlistIndexVersion);
  const inWatchlist = isInWatchlist(id);
  // Range resets per episode; an explicit selection sticks only for that episode.
  const [rangeOverride, setRangeOverride] = useState(null);
  const defaultRange = Math.floor((currentEp - 1) / RANGE_SIZE);
  const range = rangeOverride && rangeOverride.episode === currentEp ? rangeOverride.value : defaultRange;
  const setRange = (value) => setRangeOverride({ episode: currentEp, value });
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState([]);
  // Track episodes this session so finished/failed downloads only toast once.
  const downloadNoticesRef = useRef({ seen: new Set(), done: new Set() });
  const toastRef = useRef(() => {});

  // Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = useCallback((msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  useEffect(() => {
    toastRef.current = triggerToast;
  }, [triggerToast]);

  // MAL rejected the session: tell the user exactly once, not per episode.
  useSyncExternalStore(subscribeMALAuth, getMALAuthVersion);
  const malAuthFailure = getMALAuthSnapshot();
  const notifiedMALFailureRef = useRef(0);

  useEffect(() => {
    if (!malAuthFailure || notifiedMALFailureRef.current === malAuthFailure.at) return;
    notifiedMALFailureRef.current = malAuthFailure.at;
    triggerToast("MyAnimeList session expired — auto-sync paused. Reconnect in Settings.");
  }, [malAuthFailure, triggerToast]);

  const iframeRef = useRef(null);
  // True once the embedded player reported that the episode finished.
  const endedRef = useRef(false);

  // The embed is cross-origin, so the only signal that an episode finished is
  // the bridge main.js injects into the player frame.
  useEffect(() => {
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.__relist !== "player-ended") return;
      endedRef.current = !!data.ended;
      window.electronAPI?.setPlayerEnded?.(!!data.ended);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // A new episode/server/language gets a fresh iframe and a fresh video.
  useEffect(() => {
    endedRef.current = false;
    window.electronAPI?.setPlayerEnded?.(false);
  }, [id, currentEp, currentSource, language]);

  useEffect(() => {
    let cancelled = false;
    getAnimeDetails(id)
      .then((data) => {
        if (!cancelled && data) {
          setAnime(data);
          setIsAdult(isAdultAnime(data));
          setCurrentSource((prev) =>
            prev >= STANDARD_SOURCES.length ? 0 : prev
          );
        }
      })
      .catch((err) => console.error("Could not load anime details:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    ensureWatchlistLoaded();

    const pollDownloads = async () => {
      const list = await getDownloadsList();
      if (cancelled) return;
      setActiveDownloads(list.filter((d) => d.status === "downloading"));

      const notices = downloadNoticesRef.current;
      list.forEach((item) => {
        if (item.status === "downloading") {
          notices.seen.add(item.id);
          return;
        }
        if (!notices.seen.has(item.id) || notices.done.has(item.id)) return;
        if (item.status === "completed") {
          notices.done.add(item.id);
          toastRef.current(`Episode ${item.episode} downloaded — see the Downloads tab.`);
        } else if (item.status === "error") {
          notices.done.add(item.id);
          toastRef.current(`Download failed: ${item.error || "unknown reason"}`);
        }
      });
    };
    pollDownloads();
    const dlTimer = setInterval(pollDownloads, 1500);

    return () => {
      cancelled = true;
      clearInterval(dlTimer);
    };
    // Intentionally keyed on the anime id only: switching servers used to
    // refetch details, reset the download poll and races with playback.
  }, [id]);

  const rawCount = getEpisodeCount(anime);
  const knownCount = rawCount || anime?.episodes || null;
  const totalEpisodes = Math.max(currentEp, knownCount || currentEp);

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

  const exitPageFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const goToEpisode = useCallback((ep) => {
    // Leaving fullscreen before swapping the embed avoids a stale fullscreen
    // state that can stop the next episode's player from going fullscreen
    // until the page is fully reloaded.
    exitPageFullscreen();
    navigate(`/watch/${id}/${ep}`);
  }, [id, navigate, exitPageFullscreen]);

  const selectSource = (idx) => {
    setCurrentSource(idx);
    if (!isAdult) {
      localStorage.setItem("playerSource", String(idx));
    }
  };

  const toggleTheater = useCallback(() => {
    setIsTheaterMode((prev) => {
      const next = !prev;
      localStorage.setItem("playerTheater", next ? "1" : "0");
      return next;
    });
  }, []);

  // Hotkeys (declared after toggleTheater so it is defined when the effect runs)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleTheater();
      } else if (e.key === "n" || e.key === "N") {
        if (currentEp < totalEpisodes) {
          e.preventDefault();
          goToEpisode(currentEp + 1);
        }
      } else if (e.key === "p" || e.key === "P") {
        if (currentEp > 1) {
          e.preventDefault();
          goToEpisode(currentEp - 1);
        }
      } else if (e.key === "ArrowRight" && endedRef.current) {
        // Episode finished: ">" advances, like every other player.
        if (currentEp < totalEpisodes) {
          e.preventDefault();
          goToEpisode(currentEp + 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, currentEp, totalEpisodes, goToEpisode, toggleTheater]);

  // Same thing for ">" pressed while the embed itself has keyboard focus: the
  // main process intercepts it and asks the app for the next episode.
  useEffect(() => {
    return window.electronAPI?.onNextEpisode?.(() => {
      if (currentEp < totalEpisodes) goToEpisode(currentEp + 1);
    });
  }, [id, currentEp, totalEpisodes, goToEpisode]);

  const handleWatchlistToggle = async () => {
    if (!anime) return;
    const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "";
    const nextInWatchlist = !inWatchlist;
    setInWatchlist(id, nextInWatchlist);
    try {
      if (nextInWatchlist) {
        await addToWatchlist({
          anime_id: id,
          title: primaryTitle,
          image: img,
          status: "watching",
        });
        triggerToast("Added to Watch List!");
      } else {
        await removeFromWatchlist(id);
        triggerToast("Removed from Watch List");
      }
    } catch (err) {
      setInWatchlist(id, !nextInWatchlist);
      console.error(err);
      triggerToast("Failed to update watchlist");
    }
  };

  const safeSourceIndex = currentSource % STANDARD_SOURCES.length;
  const source = STANDARD_SOURCES[safeSourceIndex];
  
  const sourceIds = useMemo(
    () => ({ mal: id, anilist: anime?.anilist_id || null }),
    [id, anime?.anilist_id]
  );

  const embedUrl = useMemo(
    () => source.build(sourceIds, currentEp, language),
    [source, sourceIds, currentEp, language]
  );
  // AniList-keyed hosts cannot build a link until the details (and with them
  // the AniList id) have loaded.
  const embedUnavailable = !embedUrl;

  // Derived from the URL currently loaded in the iframe: no effect, no
  // cascading render, and the spinner resets on every remount automatically.
  const iframeLoading = loadedEmbedUrl !== embedUrl;

  const handleDownloadThisEpisode = async () => {
    if (!anime) return;
    if (!embedUrl) {
      triggerToast("This server has no link for that title yet — pick another server.");
      return;
    }
    setDownloading(true);
    try {
      const img = anime.images?.jpg?.large_image_url || anime.image || "";
      await startEpisodeDownload(id, primaryTitle, currentEp, img, embedUrl);
      triggerToast(`Download started for Episode ${currentEp}!`);
    } catch (err) {
      console.error("Download failed:", err);
      triggerToast(err?.message ? `Download failed: ${err.message}` : "Failed to start download");
    } finally {
      setDownloading(false);
    }
  };

  const handleExternalSearch = () => {
    const query = encodeURIComponent(`${primaryTitle} episode ${currentEp}`);
    window.electronAPI?.openExternal
      ? window.electronAPI.openExternal(`https://duckduckgo.com/?q=${query}+watch+online`)
      : window.open(`https://duckduckgo.com/?q=${query}+watch+online`, "_blank");
  };

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
          {isAdult && (
            <span style={{ background: "#ef4444", color: "#ffffff", padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 900, marginLeft: "4px" }}>
              18+
            </span>
          )}
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
        {/* LEFT: Episodes Box */}
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
            ) : isAdult ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
                <span style={{ fontSize: "42px", marginBottom: "16px" }}>🔞</span>
                <h3 style={{ margin: "0 0 10px", color: "var(--text-primary)", fontSize: "20px" }}>18+ Content Warning</h3>
                <p style={{ maxWidth: "400px", lineHeight: 1.5, marginBottom: "20px" }}>
                  Standard streaming servers do not host adult content. You can search the web for external streams of this episode.
                </p>
                <button
                  type="button"
                  onClick={handleExternalSearch}
                  style={{
                    padding: "10px 20px",
                    background: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)"
                  }}
                >
                  Search External Sources ↗
                </button>
              </div>
            ) : embedUnavailable ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", padding: "20px", textAlign: "center" }}>
                <span style={{ fontSize: "38px", marginBottom: "14px" }}>🔌</span>
                <h3 style={{ margin: "0 0 8px", color: "var(--text-primary)", fontSize: "18px" }}>This server needs an AniList match</h3>
                <p style={{ maxWidth: "420px", lineHeight: 1.5, margin: 0 }}>
                  {source.name} looks episodes up by AniList id, which did not load for this title. Pick another server above.
                </p>
              </div>
            ) : (
              <>
                {iframeLoading && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--accent-color, #ff0080)", zIndex: 10 }}>
                    <div style={{ width: "40px", height: "40px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent-color, #ff0080)", borderRadius: "50%", animation: "relist-spin 1s linear infinite", marginBottom: "16px" }} />
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Connecting to server...</div>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  key={`${safeSourceIndex}-${language}-${currentEp}`}
                  title={`Episode ${currentEp}`}
                  src={embedUrl}
                  width="100%"
                  height="100%"
                  style={{ 
                    border: 0, 
                    opacity: iframeLoading ? 0 : 1, 
                    transition: "opacity 0.3s ease" 
                  }}
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  onLoad={() => setLoadedEmbedUrl(embedUrl)}
                />
              </>
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
                {!isAdult ? STANDARD_SOURCES.map((src, i) => {
                  const active = i === safeSourceIndex;
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
                }) : (
                  <span style={{ fontSize: "12.5px", color: "#ef4444", fontWeight: 700 }}>
                    Standard servers unavailable for 18+ content.
                  </span>
                )}
              </div>
            </div>

            {/* Download Episode Button */}
            {!isAdult && (
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
            )}
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
                  {d.title} (Ep {d.episode})
                </span>
                <span style={{ color: "var(--accent-color, #ff0080)" }}>{describeDownloadProgress(d)}</span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "var(--bg-primary)", borderRadius: "3px", overflow: "hidden" }}>
                {isIndeterminateDownload(d) ? (
                  <div style={{ width: "35%", height: "100%", background: "var(--accent-gradient, #ff0080)", borderRadius: "3px", animation: "relist-indeterminate 1.2s ease-in-out infinite" }} />
                ) : (
                  <div style={{ width: `${d.progress || 0}%`, height: "100%", background: "var(--accent-gradient, #ff0080)", transition: "width 0.3s ease" }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}