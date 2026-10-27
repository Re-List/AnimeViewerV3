// frontend/src/components/AnimeTile.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getEpisodeCount } from "../services/animeService";
import { addToWatchlist } from "../services/watchlistService";

const HOVER_DELAY_MS = 200;
const CLOSE_DELAY_MS = 0;

function AnimeTile({ anime, fluid = false }) {
  const navigate = useNavigate();
  const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || "";
  const title = anime.title_english || anime.title;
  const count = getEpisodeCount(anime);
  const episodes = anime.episodes
    ? `${anime.episodes} eps`
    : count
    ? `${count}+ eps`
    : "? eps";

  const [showPreview, setShowPreview] = useState(false);
  const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });
  const [adding, setAdding] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const tileRef = useRef(null);

  const clearOpenTimer = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPreview = () => {
    const el = tileRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelW = 280;
    let left = rect.right + 10;
    if (left + panelW > window.innerWidth - 12) {
      left = rect.left - panelW - 10;
    }
    if (left < 8) left = 8;
    let top = rect.top;
    if (top + 340 > window.innerHeight) {
      top = Math.max(8, window.innerHeight - 350);
    }
    setPreviewPos({ top, left });
    setShowPreview(true);
    setShowStatusMenu(false);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setShowPreview(false);
      setShowStatusMenu(false);
    }, CLOSE_DELAY_MS);
  };

  const onEnter = () => {
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = setTimeout(openPreview, HOVER_DELAY_MS);
  };

  const onLeave = () => {
    clearOpenTimer();
    scheduleClose();
  };

  const onPreviewEnter = () => {
    clearCloseTimer();
    clearOpenTimer();
    setShowPreview(true);
  };

  const onPreviewLeave = () => {
    scheduleClose();
  };

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, []);

  const synopsis = (anime.synopsis || "").replace(/\s+/g, " ").trim();
  const shortSyn =
    synopsis.length > 160
      ? synopsis.slice(0, 160).trim() + "…"
      : synopsis || "No synopsis available.";

  const handleWatch = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPreview(false);
    navigate(`/anime/${anime.mal_id}`);
  };

  const handleAdd = async (e, status = "planned") => {
    e.preventDefault();
    e.stopPropagation();
    if (adding) return;
    setAdding(true);
    try {
      await addToWatchlist(anime, status);
      const labels = {
        watching: "Watching",
        onhold: "On-Hold",
        planned: "Planned",
        completed: "Completed",
        dropped: "Dropped",
      };
      toast.success(`Added to ${labels[status] || status}`);
      setShowStatusMenu(false);
      setShowPreview(false);
    } catch {
      toast.error("Could not add — is the backend running?");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      ref={tileRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        flexShrink: 0,
        width: fluid ? "100%" : "150px",
        position: "relative",
      }}
    >
      <Link
        to={`/anime/${anime.mal_id}`}
        style={{ textDecoration: "none", color: "var(--text-primary)", display: "block" }}
      >
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            overflow: "hidden",
            transition: "all 0.25s ease",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ position: "relative" }}>
            {img ? (
              <img
                src={img}
                alt={title}
                loading="lazy"
                style={{ width: "100%", aspectRatio: "5 / 7", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", aspectRatio: "5 / 7", background: "var(--bg-primary)" }} />
            )}
            {anime.score && (
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  background: "rgba(0,0,0,0.75)",
                  color: "#fbbf24",
                  fontSize: "11px",
                  fontWeight: "bold",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                ★ {anime.score}
              </div>
            )}
            {anime.type && (
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  left: "8px",
                  background: "rgba(0,0,0,0.75)",
                  color: "white",
                  fontSize: "10px",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                }}
              >
                {anime.type}
              </div>
            )}
          </div>
          <div style={{ padding: "10px" }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginBottom: "3px",
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "6px",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              <span>{episodes}</span>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {anime.status || ""}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {showPreview && (
        <div
          onMouseEnter={onPreviewEnter}
          onMouseLeave={onPreviewLeave}
          style={{
            position: "fixed",
            top: previewPos.top,
            left: previewPos.left,
            width: "280px",
            zIndex: 9999,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "12px",
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            padding: "14px",
            color: "var(--text-primary)",
          }}
        >
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              background: "var(--brand-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "8px",
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
            {anime.type && <Chip>{anime.type}</Chip>}
            {anime.score && <Chip>★ {anime.score}</Chip>}
            {anime.episodes && <Chip>{anime.episodes} eps</Chip>}
            {anime.status && <Chip>{anime.status}</Chip>}
            {anime.year && <Chip>{anime.year}</Chip>}
          </div>

          <p
            style={{
              margin: "0 0 12px",
              fontSize: "12px",
              color: "var(--text-muted)",
              lineHeight: 1.5,
              maxHeight: "90px",
              overflow: "hidden",
            }}
          >
            {shortSyn}
          </p>

          <div style={{ display: "flex", gap: "8px", position: "relative" }}>
            <button
              type="button"
              onClick={handleWatch}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "13px",
                color: "white",
                background: "var(--accent-gradient)",
              }}
            >
              ▶ Watch
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowStatusMenu((v) => !v);
              }}
              disabled={adding}
              title="Add to list"
              style={{
                width: "42px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "18px",
                fontWeight: 700,
              }}
            >
              {adding ? "…" : "+"}
            </button>

            {showStatusMenu && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: "48px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  minWidth: "130px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  zIndex: 2,
                }}
              >
                {[
                  { id: "watching", label: "Watching" },
                  { id: "onhold", label: "On-Hold" },
                  { id: "planned", label: "Planned" },
                  { id: "completed", label: "Completed" },
                  { id: "dropped", label: "Dropped" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={(e) => handleAdd(e, s.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 12px",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-primary)",
                      cursor: "pointer",
                      fontSize: "13px",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children }) {
  return (
    <span
      style={{
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "4px",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-color)",
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export default AnimeTile;