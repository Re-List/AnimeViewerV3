// frontend/src/pages/AnimeDetails.jsx
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAnimeDetails, getAnimeRelations, getEpisodeCount } from "../services/animeService";
import {
  addToWatchlist,
  removeFromWatchlist,
  getAllWatchlist,
} from "../services/watchlistService";
import { getHistory, getLatestEpisode } from "../services/historyService";
import { startEpisodeDownload } from "../services/downloadService";

// Direct fallback fetcher (AniList by idMal -> Jikan retry) so details never fail on 429 rate limits
async function fetchReliableAnimeDetails(malId) {
  // 1. Try existing service first
  try {
    const primary = await getAnimeDetails(malId);
    if (primary && (primary.mal_id || primary.id || primary.title)) {
      return { details: primary, fallbackRelations: null };
    }
  } catch (e) {
    console.warn("Primary getAnimeDetails failed, trying fallbacks:", e);
  }

  // 2. Fast AniList fallback by idMal (fetches details + genres + tags + relations in 1 call)
  try {
    const query = `
      query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          format
          episodes
          status
          averageScore
          description
          genres
          tags { name rank isMediaSpoiler }
          relations {
            edges {
              relationType(version: 2)
              node {
                id
                idMal
                type
                title { english romaji }
              }
            }
          }
        }
      }
    `;

    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { idMal: Number(malId) },
      }),
    });

    if (res.ok) {
      const json = await res.json();
      const m = json?.data?.Media;
      if (m) {
        const topTags = (m.tags || [])
          .filter((t) => !t.isMediaSpoiler && (t.rank || 0) >= 60)
          .slice(0, 6)
          .map((t) => ({ name: t.name }));

        const details = {
          mal_id: m.idMal || Number(malId),
          id: m.idMal || m.id,
          title: m.title?.romaji || m.title?.english || "Anime",
          title_english: m.title?.english || null,
          title_japanese: m.title?.native || null,
          images: {
            jpg: {
              large_image_url: m.coverImage?.extraLarge || m.coverImage?.large || "",
              image_url: m.coverImage?.large || "",
            },
          },
          bannerImage: m.bannerImage || null,
          type: m.format || "TV",
          format: m.format || "TV",
          episodes: m.episodes || null,
          status: m.status || "FINISHED",
          score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
          synopsis: m.description?.replace(/<[^>]*>/g, "") || "No synopsis available.",
          genres: (m.genres || []).map((g) => ({ name: g })),
          themes: topTags,
        };

        const fallbackRelations = (m.relations?.edges || [])
          .filter((edge) => edge?.node?.idMal && edge?.node?.type === "ANIME")
          .map((edge) => ({
            mal_id: edge.node.idMal,
            relation: (edge.relationType || "RELATED").replace(/_/g, " "),
            name: edge.node.title?.english || edge.node.title?.romaji || "Related Anime",
          }));

        return { details, fallbackRelations };
      }
    }
  } catch (err) {
    console.warn("AniList fallback error:", err);
  }

  // 3. Final direct Jikan retry after a short pause
  await new Promise((r) => setTimeout(r, 850));
  const jikanRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`);
  if (jikanRes.ok) {
    const jikanJson = await jikanRes.json();
    if (jikanJson?.data) {
      return { details: jikanJson.data, fallbackRelations: null };
    }
  }

  return { details: null, fallbackRelations: null };
}

export default function AnimeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [anime, setAnime] = useState(null);
  const [relatedAnime, setRelatedAnime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState("watching");
  const [watchedEpisodes, setWatchedEpisodes] = useState([]);
  const [lastWatchedEp, setLastWatchedEp] = useState(1);

  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const [episodeRange, setEpisodeRange] = useState(0);

  const [episodesExpanded, setEpisodesExpanded] = useState(false);
  const [franchiseExpanded, setFranchiseExpanded] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAllDetails() {
      setLoading(true);
      setError(null);
      window.scrollTo(0, 0);

      try {
        // Load local DB data + reliable anime details first (avoids firing two Jikan calls simultaneously)
        const [{ details, fallbackRelations }, watchlist, history, latestEp] = await Promise.all([
          fetchReliableAnimeDetails(id),
          getAllWatchlist().catch(() => []),
          getHistory().catch(() => []),
          getLatestEpisode(id).catch(() => null),
        ]);

        if (cancelled) return;

        if (!details) {
          throw new Error("Unable to retrieve anime metadata.");
        }

        setAnime(details);

        if (latestEp) {
          setLastWatchedEp(Number(latestEp));
        }

        if (watchlist && Array.isArray(watchlist)) {
          const match = watchlist.find((item) => String(item.anime_id) === String(id));
          if (match) {
            setInWatchlist(true);
            setWatchlistStatus(match.status || "watching");
          } else {
            setInWatchlist(false);
          }
        }

        if (history && Array.isArray(history)) {
          const watched = history
            .filter((h) => String(h.anime_id) === String(id))
            .map((h) => Number(h.episode));
          setWatchedEpisodes(watched);
        }

        // Load relations non-blockingly so the page renders immediately
        if (fallbackRelations && fallbackRelations.length > 0) {
          setRelatedAnime(fallbackRelations);
        } else {
          getAnimeRelations(id)
            .then((rel) => {
              if (!cancelled && Array.isArray(rel)) setRelatedAnime(rel);
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("Failed to load anime details:", err);
        if (!cancelled) setError(err.message || "Failed to load details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAllDetails();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
        <p style={{ fontSize: "16px", fontWeight: 600 }}>Loading anime details…</p>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div style={{ textAlign: "center", padding: "100px 20px", color: "var(--text-muted)" }}>
        <h2 style={{ color: "var(--text-primary)" }}>{error || "Anime Not Found"}</h2>
        <Link to="/" style={{ color: "var(--accent-color, #ff0080)", textDecoration: "none", fontWeight: 700, marginTop: "12px", display: "inline-block" }}>
          ← Return to Home
        </Link>
      </div>
    );
  }

  const romajiTitle = (typeof anime.title === "string" ? anime.title : anime.title?.romaji) || "Anime";
  const englishTitle = anime.title_english || anime.title?.english || null;
  const nativeTitle = anime.title_japanese || anime.title?.native || null;
  const primaryTitle = englishTitle || romajiTitle;

  const poster =
    anime.images?.jpg?.large_image_url ||
    anime.images?.jpg?.image_url ||
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    anime.image ||
    "";
  const banner = anime.bannerImage || poster;
  const totalEps = getEpisodeCount(anime) || anime.episodes || anime.totalEpisodes || 12;
  const score = anime.score || (anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null);
  const status = anime.status?.replace(/_/g, " ") || "AIRING";
  const type = anime.type || anime.format || "TV";

  const genres = Array.from(
    new Set(
      [
        ...(anime.genres || []),
        ...(anime.themes || []),
        ...(anime.demographics || []),
      ]
        .map((g) => (typeof g === "string" ? g : g?.name))
        .filter(Boolean)
    )
  );

  const synopsis = (anime.synopsis || anime.description || "No synopsis available.").replace(/<[^>]*>/g, "");

  const allEpNumbers = Array.from({ length: totalEps }, (_, i) => i + 1);
  const filteredEpisodes = episodeSearch.trim()
    ? allEpNumbers.filter((ep) => String(ep).includes(episodeSearch.trim()))
    : allEpNumbers.slice(episodeRange * 100, (episodeRange + 1) * 100);

  const displayedEpisodes = episodesExpanded ? filteredEpisodes : filteredEpisodes.slice(0, 12);
  const rangeCount = Math.ceil(totalEps / 100);

  const handleWatchlistToggle = async () => {
    try {
      if (inWatchlist) {
        await removeFromWatchlist(id);
        setInWatchlist(false);
        triggerToast("Removed from Watch List");
      } else {
        await addToWatchlist({
          anime_id: id,
          title: primaryTitle,
          image: poster,
          status: watchlistStatus,
        });
        setInWatchlist(true);
        triggerToast("Added to Watch List!");
      }
    } catch (err) {
      console.error("Watchlist error:", err);
      triggerToast("Failed to update watchlist");
    }
  };

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setWatchlistStatus(newStatus);
    if (inWatchlist) {
      try {
        await addToWatchlist({
          anime_id: id,
          title: primaryTitle,
          image: poster,
          status: newStatus,
        });
        triggerToast("Watchlist status updated!");
      } catch (err) {
        console.error("Status update error:", err);
      }
    }
  };

  const handleDownloadAnime = async () => {
    triggerToast(`Queuing ${Math.min(totalEps, 24)} episodes for download. Check Downloads tab!`);
    for (let i = 1; i <= Math.min(totalEps, 24); i++) {
      const streamUrl = `https://megaplay.buzz/stream/mal/${id}/${i}/sub`;
      await startEpisodeDownload(id, primaryTitle, i, poster, streamUrl).catch(() => {});
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", paddingBottom: "70px", position: "relative" }}>
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

      {/* 1. Hero Banner */}
      <div style={{ position: "relative", width: "100%", height: "340px", overflow: "hidden", backgroundColor: "#0a0a10" }}>
        {banner && (
          <img
            src={banner}
            alt={primaryTitle}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.35, filter: "blur(3px)" }}
          />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10, 10, 18, 0.25) 0%, var(--bg-primary) 100%)" }} />
      </div>

      {/* 2. Main Details Wrapper */}
      <div style={{ maxWidth: "1280px", margin: "-150px auto 0", padding: "0 24px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", gap: "34px", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left Column: Poster & Actions */}
          <div style={{ width: "240px", flexShrink: 0 }}>
            <img
              src={poster}
              alt={primaryTitle}
              style={{
                width: "100%",
                borderRadius: "14px",
                border: "1px solid var(--border-color)",
                boxShadow: "0 18px 45px rgba(0, 0, 0, 0.65)",
                display: "block",
              }}
            />

            <button
              type="button"
              onClick={handleWatchlistToggle}
              style={{
                width: "100%",
                marginTop: "16px",
                padding: "12px",
                borderRadius: "10px",
                border: inWatchlist ? "1px solid rgba(16, 185, 129, 0.4)" : "none",
                background: inWatchlist ? "rgba(16, 185, 129, 0.15)" : "var(--accent-gradient, var(--brand-primary, #ff0080))",
                color: inWatchlist ? "#10b981" : "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>{inWatchlist ? "✓ In Watch List" : "+ Add to Watch List"}</span>
            </button>

            {inWatchlist && (
              <select
                value={watchlistStatus}
                onChange={handleStatusChange}
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="watching">Currently Watching</option>
                <option value="completed">Completed</option>
                <option value="onhold">On-Hold</option>
                <option value="dropped">Dropped</option>
                <option value="planned">Plan to Watch</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => navigate(`/watch/${id}/${lastWatchedEp || 1}`)}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: "var(--accent-gradient, var(--brand-primary, #ff0080))",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
              }}
            >
              <span>▶</span> {lastWatchedEp > 1 ? `Continue Ep ${lastWatchedEp}` : "Start Watching Ep 1"}
            </button>

            <button
              type="button"
              onClick={handleDownloadAnime}
              style={{
                width: "100%",
                marginTop: "8px",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>📥</span> Download Anime
            </button>
          </div>

          {/* Right Column: Titles & Metadata */}
          <div style={{ flex: 1, minWidth: "300px" }}>
            <h1 style={{ margin: "0 0 6px", fontSize: "2.1rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {primaryTitle}
            </h1>

            {/* Alternate Romaji & Japanese Titles */}
            <div style={{ marginBottom: "14px", display: "flex", flexDirection: "column", gap: "2px" }}>
              {romajiTitle && romajiTitle !== primaryTitle && (
                <div style={{ fontSize: "1.05rem", color: "var(--accent-color, #ff0080)", fontWeight: 600 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", textTransform: "uppercase", marginRight: "6px" }}>Romaji:</span>
                  {romajiTitle}
                </div>
              )}
              {nativeTitle && (
                <div style={{ fontSize: "0.95rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", textTransform: "uppercase", marginRight: "6px" }}>Japanese:</span>
                  {nativeTitle}
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px", flexWrap: "wrap" }}>
              <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                {type}
              </span>

              {score && (
                <span style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                  ★ {score}
                </span>
              )}

              <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>
                {totalEps} Episodes
              </span>

              <span style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, color: "var(--accent-color, #ff0080)" }}>
                {status}
              </span>
            </div>

            {/* Clickable Genre / Theme / Demographic Badges Section */}
            {genres && genres.length > 0 && (
              <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
                {genres.map((g, idx) => (
                  <Link
                    key={idx}
                    to={`/genre/${encodeURIComponent(g)}`}
                    style={{
                      textDecoration: "none",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "4px 12px",
                      borderRadius: "20px",
                      background: "rgba(255, 255, 255, 0.06)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border-color)",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-color, #ff0080)";
                      e.currentTarget.style.color = "var(--accent-color, #ff0080)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.color = "var(--text-primary)";
                    }}
                  >
                    {g}
                  </Link>
                ))}
              </div>
            )}

            <div style={{ marginBottom: "28px", maxWidth: "880px" }}>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  margin: 0,
                  display: showFullSynopsis ? "block" : "-webkit-box",
                  WebkitLineClamp: showFullSynopsis ? "none" : 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {synopsis}
              </p>
              {synopsis.length > 250 && (
                <button
                  type="button"
                  onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-color, #ff0080)",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "6px 0 0",
                  }}
                >
                  {showFullSynopsis ? "Show Less ▲" : "Read More ▼"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 3. Episodes Grid — Collapsible (1 row of 12 episodes by default) */}
        <div style={{ marginTop: "45px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", borderBottom: "1px solid var(--border-color)", paddingBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)" }}>
                Episodes ({totalEps})
              </h3>
              <button
                type="button"
                onClick={() => setEpisodesExpanded(!episodesExpanded)}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  color: "var(--accent-color, #ff0080)",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {episodesExpanded ? "Collapse ▲ (Show 1 Row)" : "Show All Episodes ▼"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {episodesExpanded && rangeCount > 1 && (
                <div style={{ display: "flex", gap: "4px", background: "var(--bg-surface)", padding: "2px", borderRadius: "6px", border: "1px solid var(--border-color)" }}>
                  {Array.from({ length: rangeCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEpisodeRange(i)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "none",
                        fontSize: "11px",
                        fontWeight: episodeRange === i ? 700 : 500,
                        color: episodeRange === i ? "#ffffff" : "var(--text-muted)",
                        background: episodeRange === i ? "var(--accent-gradient, #ff0080)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      {i * 100 + 1}-{Math.min((i + 1) * 100, totalEps)}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                placeholder="Find episode #..."
                value={episodeSearch}
                onChange={(e) => {
                  setEpisodeSearch(e.target.value);
                  if (e.target.value.trim()) setEpisodesExpanded(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  width: "130px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
            {displayedEpisodes.map((ep) => {
              const isWatched = watchedEpisodes.includes(ep);
              return (
                <button
                  key={ep}
                  type="button"
                  onClick={() => navigate(`/watch/${id}/${ep}`)}
                  style={{
                    backgroundColor: "var(--bg-surface)",
                    border: isWatched ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-color)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Ep {ep}
                  </span>
                  {isWatched && (
                    <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700 }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Related Franchise Entries — Collapsible */}
        {relatedAnime && relatedAnime.length > 0 && (
          <div style={{ marginTop: "50px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-primary)" }}>
                Related Franchise Entries ({relatedAnime.length})
              </h3>
              <button
                type="button"
                onClick={() => setFranchiseExpanded(!franchiseExpanded)}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  color: "var(--accent-color, #ff0080)",
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                {franchiseExpanded ? "Collapse ▲" : "Expand Franchise ▼"}
              </button>
            </div>

            {franchiseExpanded && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                {relatedAnime.map((item, idx) => (
                  <Link
                    key={idx}
                    to={`/details/${item.mal_id}`}
                    style={{
                      textDecoration: "none",
                      backgroundColor: "var(--bg-surface)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-color)",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "10px", color: "var(--accent-color, #ff0080)", fontWeight: 700, textTransform: "uppercase" }}>
                      {item.relation}
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}