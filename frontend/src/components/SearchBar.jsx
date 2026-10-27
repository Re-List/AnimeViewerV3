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

  useEffect(() => {
    let cancelled = false;
    getTrending(1)
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        setTrending(
          list.slice(0, 10).map((a) => a.title_english || a.title).filter(Boolean)
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#1a1a1a",
          border: "1px solid #333",
          borderRadius: "8px",
          padding: "8px 14px",
          color: "#aaa",
          cursor: "pointer",
          fontSize: "13px",
          minWidth: "170px",
        }}
      >
        <span>🔍</span>
        <span style={{ flex: 1, textAlign: "left" }}>Search...</span>
        <span
          style={{
            background: "#2a2a2a",
            border: "1px solid #444",
            borderRadius: "4px",
            padding: "2px 7px",
            fontSize: "11px",
            color: "#ccc",
            fontWeight: 600,
          }}
        >
          /
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.8)",
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
              background: "#161616",
              border: "1px solid #333",
              borderRadius: "12px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "18px 20px",
                borderBottom: "1px solid #2a2a2a",
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
                  color: "#fff",
                  fontSize: "18px",
                }}
              />
              <span
                style={{
                  background: "#2a2a2a",
                  border: "1px solid #444",
                  color: "#ccc",
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
              {!ready && (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#666",
                      letterSpacing: "0.06em",
                      marginBottom: "12px",
                      fontWeight: 600,
                    }}
                  >
                    TRENDING SEARCHES
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(trending.length
                      ? trending
                      : ["One Piece", "Demon Slayer", "Jujutsu Kaisen"]
                    ).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => goSearch(t)}
                        style={{
                          background: "#222",
                          border: "1px solid #333",
                          color: "#ccc",
                          borderRadius: "20px",
                          padding: "8px 14px",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ready && searching && (
                <div style={{ textAlign: "center", color: "#888", padding: "24px 0" }}>
                  Searching…
                </div>
              )}

              {ready && !searching && results.length === 0 && (
                <div style={{ textAlign: "center", color: "#666", padding: "24px 0" }}>
                  No results for “{trimmed}”
                </div>
              )}

              {ready && !searching && results.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {results.map((anime) => {
                    const img =
                      anime.images?.jpg?.image_url ||
                      anime.images?.jpg?.large_image_url ||
                      "";
                    const title = anime.title_english || anime.title || "Untitled";
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
                          color: "white",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#222")}
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
                              background: "#2a2a2a",
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
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {title}
                          </div>
                          <div style={{ fontSize: "12px", color: "#888", marginTop: "2px" }}>
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
                      background: "#7c3aed",
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