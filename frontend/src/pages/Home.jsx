// frontend/src/pages/Home.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  getTopAiring,
  getTrending,
  getThisSeason,
  getTopRated,
  uniqueById,
} from "../services/animeService";
import { getContinueWatching } from "../services/historyService";
import AnimeTile from "../components/AnimeTile";

const HERO_SLIDES = 6;
const HERO_INTERVAL_MS = 6000;

function readProgressPercent(animeId, episode) {
  try {
    const saved = localStorage.getItem(`progress_${animeId}_${episode}`);
    if (!saved) return null;
    const data = JSON.parse(saved);
    if (data.duration > 0) {
      return Math.min(100, Math.round((data.currentTime / data.duration) * 100));
    }
  } catch {
    /* corrupt progress entry */
  }
  return null;
}

function Home() {
  const [data, setData] = useState({ airing: [], trending: [], season: [], rated: [], cont: [] });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const results = await Promise.allSettled([
        getTopAiring(1),
        getTrending(1),
        getThisSeason(1),
        getTopRated(1),
        getContinueWatching(),
      ]);
      if (cancelled) return;

      const list = (r) => (r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []);
      setData({
        airing: list(results[0]),
        trending: list(results[1]),
        season: list(results[2]),
        rated: list(results[3]),
        cont: list(results[4]),
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const heroItems = data.airing.slice(0, HERO_SLIDES);
  const heroCount = heroItems.length;

  // Always keep latest count available inside the interval
  const heroCountRef = useRef(heroCount);
  heroCountRef.current = heroCount;

  // Auto-rotate
  useEffect(() => {
    if (heroCount < 2) return;

    const timer = setInterval(() => {
      const n = heroCountRef.current;
      if (n < 2) return;
      setHeroIndex((i) => (i + 1) % n);
    }, HERO_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [heroCount]);

  const retry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const prevHero = () => {
    const n = heroCountRef.current;
    if (n < 2) return;
    setHeroIndex((i) => (i - 1 + n) % n);
  };

  const nextHero = () => {
    const n = heroCountRef.current;
    if (n < 2) return;
    setHeroIndex((i) => (i + 1) % n);
  };

  if (loading) {
    return (
      <div
        style={{
          background: "#0a0a0a",
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
        }}
      >
        Loading Re:List…
      </div>
    );
  }

  const nothingLoaded =
    data.airing.length + data.trending.length + data.season.length + data.rated.length === 0;

  if (nothingLoaded) {
    return (
      <div
        style={{
          background: "#0a0a0a",
          minHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          alignItems: "center",
          justifyContent: "center",
          color: "#aaa",
          textAlign: "center",
          padding: "20px",
        }}
      >
        <div>Couldn’t load anime from AniList. Check your internet connection and try again.</div>
        <button
          onClick={retry}
          style={{
            background: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "10px 22px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const safeIndex = heroCount > 0 ? heroIndex % heroCount : 0;
  const hero = heroItems[safeIndex];

  return (
    <div style={{ background: "#0a0a0a", color: "white", paddingBottom: "80px" }}>
      {/* ========== HERO BANNER ========== */}
      {hero && (
        <div style={{ position: "relative", height: "460px", overflow: "hidden", marginBottom: "28px" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${hero.images?.jpg?.large_image_url || hero.images?.jpg?.image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              filter: "brightness(0.35)",
              transform: "scale(1.04)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.55) 50%, transparent 75%), linear-gradient(to top, #0a0a0a 0%, transparent 45%)",
            }}
          />

          {/* Manual prev / next */}
          {heroCount > 1 && (
            <>
              <button type="button" onClick={prevHero} aria-label="Previous slide" style={heroArrowStyle("left")}>
                ‹
              </button>
              <button type="button" onClick={nextHero} aria-label="Next slide" style={heroArrowStyle("right")}>
                ›
              </button>
            </>
          )}

          <div
            style={{
              position: "relative",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "40px 48px 48px",
              maxWidth: "680px",
              zIndex: 2,
            }}
          >
            <div style={{ display: "flex", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
              <span
                style={{
                  background: "#3b82f6",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: "bold",
                  padding: "3px 8px",
                  borderRadius: "4px",
                }}
              >
                {hero.type || "TV"}
              </span>
              {hero.score && (
                <span
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  ★ {hero.score}
                </span>
              )}
            </div>

            <h1
              style={{
                fontSize: "clamp(26px, 4vw, 40px)",
                margin: "0 0 12px 0",
                lineHeight: 1.15,
                fontWeight: 700,
              }}
            >
              {hero.title_english || hero.title}
            </h1>

            <p
              style={{
                color: "#bbb",
                fontSize: "14px",
                lineHeight: 1.5,
                marginBottom: "22px",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {hero.synopsis || "No synopsis available."}
            </p>

            <div style={{ display: "flex", gap: "12px" }}>
              <Link
                to={`/player/${hero.mal_id}/1`}
                style={{
                  background: "#7c3aed",
                  color: "white",
                  padding: "12px 26px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: "15px",
                }}
              >
                ▶ Watch Now
              </Link>
              <Link
                to={`/anime/${hero.mal_id}`}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  padding: "12px 22px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "600",
                  fontSize: "15px",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                Details
              </Link>
            </div>
          </div>

          {/* Dots */}
          <div
            style={{
              position: "absolute",
              bottom: "18px",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "6px",
              zIndex: 3,
            }}
          >
            {heroItems.map((item, i) => (
              <button
                key={item.mal_id}
                type="button"
                onClick={() => setHeroIndex(i)}
                aria-label={`Show ${item.title_english || item.title}`}
                style={{
                  width: i === safeIndex ? "18px" : "8px",
                  height: "8px",
                  borderRadius: "4px",
                  border: "none",
                  background: i === safeIndex ? "#7c3aed" : "rgba(255,255,255,0.3)",
                  cursor: "pointer",
                  transition: "all 0.25s",
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "0 28px" }}>
        {/* ========== CONTINUE WATCHING ========== */}
        {data.cont.length > 0 && (
          <section style={{ marginBottom: "36px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "15px" }}>▶</span>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>Continue Watching</h2>
              </div>
              <Link to="/continue" style={{ color: "#a78bfa", fontSize: "13px", textDecoration: "none" }}>
                See all
              </Link>
            </div>

            <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "6px" }}>
              {data.cont.slice(0, 12).map((item) => {
                const percent = readProgressPercent(item.anime_id, item.episode);
                return (
                  <Link
                    key={item.anime_id}
                    to={`/player/${item.anime_id}/${item.episode || 1}`}
                    style={{ textDecoration: "none", color: "white", flexShrink: 0, width: "130px" }}
                  >
                    <div style={{ background: "#141414", borderRadius: "8px", overflow: "hidden" }}>
                      <div style={{ position: "relative" }}>
                        <img
                          src={item.image || ""}
                          alt={item.title}
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "72px",
                            objectFit: "cover",
                            display: "block",
                            background: "#111",
                          }}
                        />
                        <div style={{ height: "3px", background: "#2a2a2a" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${percent ?? 4}%`,
                              background: "#7c3aed",
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ padding: "6px 8px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            marginBottom: "1px",
                          }}
                        >
                          {item.title}
                        </div>
                        <div style={{ fontSize: "10px", color: "#777" }}>Ep {item.episode || 1}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <ShelfRow icon="●" iconColor="#f59e0b" title="Currently Airing" initial={data.airing} fetchPage={getTopAiring} />
        <ShelfRow icon="🔥" title="Trending Now" initial={data.trending} fetchPage={getTrending} />
        <ShelfRow icon="✨" title="This Season" initial={data.season} fetchPage={getThisSeason} />
        <ShelfRow icon="★" iconColor="#fbbf24" title="Top Rated" initial={data.rated} fetchPage={getTopRated} />
      </div>
    </div>
  );
}

function ShelfRow({ icon, iconColor, title, initial, fetchPage }) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(initial.length === 0);
  const rowRef = useRef(null);
  const busyRef = useRef(false);

  const loadMore = async () => {
    if (busyRef.current || done) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const more = await fetchPage(page + 1);
      if (more.length) {
        setItems((prev) => uniqueById([...prev, ...more]));
        setPage((p) => p + 1);
      } else {
        setDone(true);
      }
    } catch {
      setDone(true);
    }
    busyRef.current = false;
    setLoadingMore(false);
  };

  const checkEnd = () => {
    const el = rowRef.current;
    if (el && el.scrollWidth - el.scrollLeft - el.clientWidth < 400) loadMore();
  };

  const scrollByDir = (dir) => rowRef.current?.scrollBy({ left: dir * 520, behavior: "smooth" });

  if (initial.length === 0) return null;

  return (
    <section style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: iconColor, fontSize: "18px" }}>{icon}</span>
          <h2 style={{ margin: 0, fontSize: "20px" }}>{title}</h2>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => scrollByDir(-1)} aria-label={`Scroll ${title} left`} style={navBtn}>
            ‹
          </button>
          <button onClick={() => scrollByDir(1)} aria-label={`Scroll ${title} right`} style={navBtn}>
            ›
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        onScroll={checkEnd}
        style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "8px", scrollbarWidth: "none" }}
      >
        {items.map((anime) => (
          <AnimeTile key={anime.mal_id} anime={anime} />
        ))}
        {loadingMore && (
          <div
            style={{
              flexShrink: 0,
              width: "150px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
            }}
          >
            Loading…
          </div>
        )}
      </div>
    </section>
  );
}

function heroArrowStyle(side) {
  return {
    position: "absolute",
    [side]: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 5,
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(0,0,0,0.55)",
    color: "white",
    fontSize: "22px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

const navBtn = {
  background: "#1f1f1f",
  border: "1px solid #333",
  color: "white",
  width: "32px",
  height: "32px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default Home;