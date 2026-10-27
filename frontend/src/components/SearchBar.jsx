// frontend/src/components/SearchBar.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchAnime, getTrending } from "../services/animeService";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

function SearchBar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  const trimmed = query.trim();
  const ready = trimmed.length >= MIN_CHARS;

  // Real-time trending data fetch whenever search opens
  useEffect(() => {
    if (open) {
      getTrending(1)
        .then((list) => {
          if (Array.isArray(list) && list.length > 0) {
            setTrending(
              list.slice(0, 8).map((a) => a.title_english || a.title).filter(Boolean)
            );
          }
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;

      if (
        (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!ready) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const list = await searchAnime(trimmed);
        if (!cancelled) setResults(Array.isArray(list) ? list.slice(0, 8) : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, ready]);

  const close = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
  };

  const goSearch = (q) => {
    const text = (q ?? trimmed).trim();
    if (!text) return;
    close();
    navigate(`/search?q=${encodeURIComponent(text)}`);
  };

  const pickAnime = (anime) => {
    close();
    navigate(`/anime/${anime.mal_id}`);
  };

  return (
    <>
      {/* Header Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "7px 14px",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "13px",
          minWidth: "170px",
          transition: "all 0.2s ease",
        }}
      >
        <span>🔍</span>
        <span style={{ flex: 1, textAlign: "left", color: "var(--text-muted)" }}>Search...</span>
        <span
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            padding: "1px 6px",
            fontSize: "11px",
            color: "var(--text-muted)",
            fontWeight: 600,
          }}
        >
          /
        </span>
      </button>

      {/* Modal Dialog */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            paddingTop: "10vh",
          }}
          onClick={close}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(620px, 94vw)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.45)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <span style={{ fontSize: "18px" }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    goSearch();
                  }
                }}
                placeholder="Search anime..."
                autoFocus
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontSize: "16px",
                }}
              />
              <span
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-muted)",
                  fontSize: "11px",
                  padding: "4px 8px",
                  borderRadius: "5px",
                  fontWeight: 600,
                }}
              >
                ESC
              </span>
            </div>

            <div style={{ padding: "16px 20px 22px", maxHeight: "60vh", overflowY: "auto" }}>
              {/* Clickable Trending Pill Boxes */}
              {!ready && (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      letterSpacing: "0.06em",
                      marginBottom: "12px",
                      fontWeight: 600,
                    }}
                  >
                    REAL-TIME TRENDING SEARCHES
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(trending.length
                      ? trending
                      : ["One Piece", "Demon Slayer", "Jujutsu Kaisen", "Solo Leveling", "Bleach"]
                    ).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => goSearch(t)}
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-color)",
                          color: "var(--text-primary)",
                          borderRadius: "20px",
                          padding: "8px 14px",
                          fontSize: "13px",
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "all 0.15s ease",
                        }}
                      >
                        🔥 {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ready && searching && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0" }}>
                  Searching…
                </div>
              )}

              {ready && !searching && results.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0" }}>
                  No results for “{trimmed}”
                </div>
              )}

              {/* Rich Clickable Search Results */}
              {ready && !searching && results.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {results.map((anime) => {
                    const img =
                      anime.images?.jpg?.image_url ||
                      anime.images?.jpg?.large_image_url ||
                      "";
                    const itemTitle = anime.title_english || anime.title || "Untitled";
                    return (
                      <button
                        key={anime.mal_id}
                        type="button"
                        onClick={() => pickAnime(anime)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          width: "100%",
                          background: "transparent",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "var(--text-primary)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            style={{
                              width: "42px",
                              height: "58px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "42px",
                              height: "58px",
                              background: "var(--bg-primary)",
                              borderRadius: "4px",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {itemTitle}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {anime.type || "Anime"}
                            {anime.score ? ` · ★ ${anime.score}` : ""}
                            {anime.episodes ? ` · ${anime.episodes} eps` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => goSearch()}
                    style={{
                      marginTop: "10px",
                      width: "100%",
                      padding: "11px",
                      background: "var(--accent-gradient)",
                      border: "none",
                      borderRadius: "8px",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    See all results for “{trimmed}”
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SearchBar;