// frontend/src/components/AnimeCard.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addToWatchlist,
  removeFromWatchlist,
  getAllWatchlist,
} from "../services/watchlistService";
import { getAnimeDetails } from "../services/animeService";

let cachedWatchlistPromise = null;
let cachedWatchlistTime = 0;

function getCachedWatchlist() {
  const now = Date.now();
  if (!cachedWatchlistPromise || now - cachedWatchlistTime > 5000) {
    cachedWatchlistTime = now;
    cachedWatchlistPromise = getAllWatchlist().catch(() => []);
  }
  return cachedWatchlistPromise;
}

export default function AnimeCard({ anime, onDelete }) {
  const [showPopup, setShowPopup] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [liveStatus, setLiveStatus] = useState(anime?.status || anime?.airing_status || null);
  const [liveTitle, setLiveTitle] = useState(null);
  const [allow18Plus, setAllow18Plus] = useState(localStorage.getItem("relist_show_18plus") === "true");
  
  const enterTimeoutRef = useRef(null);
  const leaveTimeoutRef = useRef(null);
  const navigate = useNavigate();

  // Listen for changes to the 18+ setting across the app
  useEffect(() => {
    const handleStorageChange = () => {
      setAllow18Plus(localStorage.getItem("relist_show_18plus") === "true");
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (!anime) return null;

  const animeId = anime.id || anime.anime_id || anime.mal_id;

  // 18+ Detection Logic (Supports both Jikan and AniList metadata)
  const ratingStr = String(anime.rating || "").toLowerCase();
  const is18Plus = 
    anime.isAdult === true || 
    ratingStr.includes("rx") || 
    ratingStr.includes("hentai") || 
    (anime.genres || []).some(g => {
      const n = String(typeof g === 'string' ? g : g.name).toLowerCase();
      return n === "hentai" || n === "erotica";
    });

  // Hide card entirely if it's 18+ and the user has the setting disabled
  if (is18Plus && !allow18Plus) return null;

  const hasEnglishTitleAlready = Boolean(
    anime.title_english || (typeof anime.title === "object" && anime.title?.english)
  );
  const isWatchlistRowStatus = ["watching", "planned", "plan_to_watch", "completed", "on_hold", "onhold", "dropped"].includes(
    String(anime.status || "").toLowerCase()
  );

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      try {
        const list = await getCachedWatchlist();
        if (cancelled) return;

        if (list && Array.isArray(list)) {
          setInWatchlist(list.some((item) => String(item.anime_id) === String(animeId)));
        }

        if (!hasEnglishTitleAlready && (isWatchlistRowStatus || !anime.status)) {
          const details = await getAnimeDetails(animeId).catch(() => null);
          if (cancelled || !details) return;

          const engTitle =
            details.title_english ||
            details.title?.english ||
            details.title?.romaji;
          if (engTitle) setLiveTitle(engTitle);

          if (details.status) {
            setLiveStatus(details.status);
          }
        }
      } catch (e) {}
    }

    loadMeta();
    return () => {
      cancelled = true;
      if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, [animeId, hasEnglishTitleAlready, isWatchlistRowStatus, anime.status]);

  const title =
    liveTitle ||
    anime.title_english ||
    anime.title?.english ||
    (typeof anime.title === "string" ? anime.title : anime.title?.romaji) ||
    anime.title_romaji ||
    "Anime";

  const image =
    anime.images?.jpg?.large_image_url ||
    anime.images?.jpg?.image_url ||
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    anime.coverImage?.medium ||
    anime.main_picture?.large ||
    anime.main_picture?.medium ||
    anime.image ||
    "";

  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : anime.score || null;
  const format = anime.format || anime.type || "TV";
  const episodes = anime.episodes || anime.totalEpisodes || null;

  const displayStatus = (() => {
    const s = String(liveStatus || "").toUpperCase();
    if (["WATCHING", "PLANNED", "PLAN_TO_WATCH", "COMPLETED", "ON_HOLD", "ONHOLD", "DROPPED"].includes(s)) {
      return "Finished Airing";
    }
    if (s.includes("FINISHED") || s === "COMPLETED") return "Finished Airing";
    if (s.includes("RELEASING") || s.includes("AIRING")) return "Currently Airing";
    if (s.includes("NOT_YET") || s.includes("UPCOMING")) return "Not yet aired";
    if (s.includes("CANCELLED")) return "Cancelled";
    if (s.includes("HIATUS")) return "On Hiatus";
    return liveStatus ? liveStatus.replace(/_/g, " ") : "Finished Airing";
  })();

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);

    enterTimeoutRef.current = setTimeout(() => {
      setShowPopup(true);
    }, 250);
  };

  const handleMouseLeave = () => {
    if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);

    leaveTimeoutRef.current = setTimeout(() => {
      setShowPopup(false);
    }, 250);
  };

  const handleWatchlistToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      cachedWatchlistTime = 0;
      if (inWatchlist) {
        await removeFromWatchlist(animeId);
        setInWatchlist(false);
      } else {
        await addToWatchlist({
          anime_id: animeId,
          title,
          image,
          status: "watching",
        });
        setInWatchlist(true);
      }
    } catch (err) {
      console.error("Watchlist toggle error:", err);
    }
  };

  const handleWatchClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/watch/${animeId}/1`);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        borderRadius: "12px",
        cursor: "pointer",
        transition: "transform 0.2s ease",
      }}
    >
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(animeId);
          }}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            background: "rgba(0,0,0,0.85)",
            color: "#ef4444",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: 800,
            zIndex: 30,
            boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
          }}
          title="Remove from collection"
        >
          ✕
        </button>
      )}

      <Link to={`/details/${animeId}`} style={{ textDecoration: "none", display: "block" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "145%",
            borderRadius: "10px",
            overflow: "hidden",
            backgroundColor: "var(--bg-surface, #141414)",
            border: "1px solid var(--border-color, #222)",
            transition: "border-color 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-color, #ff0080)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-color, #222)")}
        >
          <img
            src={image || "https://placehold.co/300x400/111/fff?text=No+Image"}
            alt={title}
            loading="lazy"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          <span
            style={{
              position: "absolute",
              top: "8px",
              left: "8px",
              background: "rgba(0, 0, 0, 0.78)",
              backdropFilter: "blur(4px)",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: "4px",
              letterSpacing: "0.5px",
            }}
          >
            {format}
          </span>

          {score && (
            <span
              style={{
                position: "absolute",
                top: "8px",
                right: onDelete ? "44px" : "8px",
                background: "rgba(0, 0, 0, 0.78)",
                backdropFilter: "blur(4px)",
                color: "#f59e0b",
                fontSize: "11px",
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              ★ {score}
            </span>
          )}

          {/* 18+ Label at Bottom Right */}
          {is18Plus && (
            <span
              style={{
                position: "absolute",
                bottom: "8px",
                right: "8px",
                background: "#ef4444",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: 900,
                padding: "2px 6px",
                borderRadius: "4px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
                letterSpacing: "0.5px"
              }}
            >
              18+
            </span>
          )}
        </div>

        <div style={{ padding: "8px 2px 2px" }}>
          <h4
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--text-primary, #ffffff)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h4>
          <div
            style={{
              fontSize: "11px",
              color: "var(--text-muted, #888)",
              marginTop: "3px",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{episodes ? `${episodes} eps` : format}</span>
            <span style={{ color: displayStatus === "Finished Airing" ? "var(--text-muted)" : "var(--accent-color, #ff0080)" }}>
              {displayStatus}
            </span>
          </div>
        </div>
      </Link>

      {showPopup && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: "absolute",
            bottom: "65px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "275px",
            backgroundColor: "var(--bg-surface, #181824)",
            border: "1px solid var(--border-color, rgba(255, 255, 255, 0.15))",
            borderRadius: "14px",
            padding: "16px",
            zIndex: 9999,
            boxShadow: "0 18px 45px rgba(0, 0, 0, 0.75)",
            pointerEvents: "auto",
          }}
        >
          <h4
            style={{
              margin: "0 0 6px",
              fontSize: "14px",
              fontWeight: 800,
              color: "var(--accent-color, #ff0080)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h4>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: "4px", color: "var(--text-primary, #fff)", fontWeight: 700 }}>
              {format}
            </span>
            {score && (
              <span style={{ fontSize: "10px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                ★ {score}
              </span>
            )}
            <span style={{ fontSize: "9px", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", color: "var(--text-muted, #aaa)", fontWeight: 700 }}>
              {displayStatus}
            </span>
            {is18Plus && (
              <span style={{ fontSize: "10px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", padding: "2px 6px", borderRadius: "4px", fontWeight: 900 }}>
                18+
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: "11.5px",
              color: "var(--text-muted, #b0b0cc)",
              margin: "0 0 14px",
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {(anime.description || anime.synopsis || "")?.replace(/<[^>]*>/g, "") || "Click card to view full synopsis and episodes."}
          </p>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={handleWatchClick}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "none",
                borderRadius: "8px",
                background: "var(--accent-gradient, var(--brand-primary, #ff0080))",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "5px",
              }}
            >
              <span>▶</span> Watch
            </button>

            <button
              type="button"
              onClick={handleWatchlistToggle}
              title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
              style={{
                width: "36px",
                padding: "8px 0",
                border: "1px solid var(--border-color, rgba(255, 255, 255, 0.15))",
                borderRadius: "8px",
                background: inWatchlist ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.06)",
                color: inWatchlist ? "#10b981" : "var(--text-primary, #ffffff)",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {inWatchlist ? "✓" : "+"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}