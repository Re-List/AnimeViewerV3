// frontend/src/pages/GenreResults.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AnimeCard from "../components/AnimeCard";
import GenreBrowser from "../components/GenreBrowser";

// In-memory cache so switching tabs or revisiting genres is instant (0ms)
const genrePageCache = new Map();

// Official Jikan v4 (MyAnimeList) Genre, Theme, and Demographic IDs
const JIKAN_GENRE_MAP = {
  "action": "1",
  "action & adventure": "1,2",
  "adventure": "2",
  "animation": "",
  "avant garde": "5",
  "award winning": "46",
  "boys love": "28",
  "cars": "3",
  "racing": "3",
  "comedy": "4",
  "dementia": "5",
  "demons": "6",
  "mythology": "6",
  "drama": "8",
  "ecchi": "9",
  "erotica": "49",
  "fantasy": "10",
  "game": "79",
  "girls love": "26",
  "gourmet": "47",
  "harem": "35",
  "hentai": "12",
  "historical": "13",
  "horror": "14",
  "isekai": "62",
  "josei": "43",
  "kids": "15",
  "magic": "10",
  "mahou shoujo": "66",
  "martial arts": "17",
  "mecha": "18",
  "military": "38",
  "music": "19",
  "mystery": "7",
  "parody": "20",
  "performing arts": "70",
  "police": "39",
  "psychological": "40",
  "romance": "22",
  "samurai": "21",
  "school": "23",
  "sci-fi": "24",
  "sci fi": "24",
  "sci-fi & fantasy": "24,10",
  "seinen": "42",
  "shoujo": "25",
  "shoujo ai": "26",
  "shounen": "27",
  "shounen ai": "28",
  "slice of life": "36",
  "space": "29",
  "sports": "30",
  "super power": "31",
  "supernatural": "37",
  "suspense": "41",
  "thriller": "41",
  "time travel": "78",
  "vampire": "32",
  "workplace": "48",
};

// Map UI genre names to AniList's exact Genre or Tag filter
const ANILIST_FILTER_MAP = {
  "action": { genres: ["Action"] },
  "action & adventure": { genres: ["Action", "Adventure"] },
  "adventure": { genres: ["Adventure"] },
  "animation": {},
  "avant garde": { tags: ["Surreal Comedy"] },
  "award winning": null, // Use Jikan for MAL Award Winning list
  "boys love": { tags: ["Boys' Love"] },
  "cars": { tags: ["Cars"] },
  "comedy": { genres: ["Comedy"] },
  "dementia": { tags: ["Denpa"] },
  "demons": { tags: ["Demons"] },
  "drama": { genres: ["Drama"] },
  "ecchi": { genres: ["Ecchi"] },
  "erotica": null,
  "fantasy": { genres: ["Fantasy"] },
  "game": { tags: ["Video Games"] },
  "girls love": { tags: ["Yuri"] },
  "gourmet": { tags: ["Food"] },
  "harem": { tags: ["Harem"] },
  "hentai": { genres: ["Hentai"], isAdult: true },
  "historical": { tags: ["Historical"] },
  "horror": { genres: ["Horror"] },
  "isekai": { tags: ["Isekai"] },
  "josei": { tags: ["Josei"] },
  "kids": { tags: ["Kids"] },
  "magic": { tags: ["Magic"] },
  "mahou shoujo": { genres: ["Mahou Shoujo"] },
  "martial arts": { tags: ["Martial Arts"] },
  "mecha": { genres: ["Mecha"] },
  "military": { tags: ["Military"] },
  "music": { genres: ["Music"] },
  "mystery": { genres: ["Mystery"] },
  "parody": { tags: ["Parody"] },
  "police": { tags: ["Police"] },
  "psychological": { genres: ["Psychological"] },
  "romance": { genres: ["Romance"] },
  "samurai": { tags: ["Swordplay"] },
  "school": { tags: ["School"] },
  "sci-fi": { genres: ["Sci-Fi"] },
  "sci-fi & fantasy": { genres: ["Sci-Fi", "Fantasy"] },
  "seinen": { tags: ["Seinen"] },
  "shoujo": { tags: ["Shoujo"] },
  "shounen": { tags: ["Shounen"] },
  "slice of life": { genres: ["Slice of Life"] },
  "space": { tags: ["Space"] },
  "sports": { genres: ["Sports"] },
  "super power": { tags: ["Super Power"] },
  "supernatural": { genres: ["Supernatural"] },
  "suspense": { genres: ["Thriller"] },
  "thriller": { genres: ["Thriller"] },
  "time travel": { tags: ["Time Manipulation"] },
  "vampire": { tags: ["Vampire"] },
  "workplace": { tags: ["Work"] },
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchFromAniList(genreKey, page = 1, typeFilter = "all", sortBy = "score") {
  const mapping = ANILIST_FILTER_MAP[genreKey];
  if (!mapping) return null;

  const sortMap = {
    score: "SCORE_DESC",
    popular: "POPULARITY_DESC",
    newest: "START_DATE_DESC",
    az: "TITLE_ROMAJI",
  };

  const formatFilter =
    typeFilter === "tv" ? ", format_in: [TV, TV_SHORT]" :
    typeFilter === "movie" ? ", format_in: [MOVIE]" :
    typeFilter === "ona" ? ", format_in: [ONA, OVA, SPECIAL]" : "";

  const isAdultFilter = mapping.isAdult ? "" : ", isAdult: false";
  const hasGenres = mapping.genres && mapping.genres.length > 0;
  const hasTags = mapping.tags && mapping.tags.length > 0;

  const query = `
    query ($page: Int${hasGenres ? ", $genres: [String]" : ""}${hasTags ? ", $tags: [String]" : ""}) {
      Page(page: $page, perPage: 28) {
        pageInfo { hasNextPage }
        media(
          type: ANIME
          ${hasGenres ? "genre_in: $genres" : ""}
          ${hasTags ? "tag_in: $tags" : ""}
          sort: [${sortMap[sortBy] || "SCORE_DESC"}]
          ${formatFilter}
          ${isAdultFilter}
        ) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large }
          format
          episodes
          status
          averageScore
          description
          genres
        }
      }
    }
  `;

  const variables = { page };
  if (hasGenres) variables.genres = mapping.genres;
  if (hasTags) variables.tags = mapping.tags;

  const res = await fetchWithTimeout(
    "https://graphql.anilist.co",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    },
    3500
  );

  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json();
  const pageData = json?.data?.Page;
  if (!pageData?.media) return null;

  const items = pageData.media
    .filter((m) => m.idMal)
    .map((m) => ({
      mal_id: m.idMal,
      id: m.idMal,
      title: m.title?.english || m.title?.romaji || "Anime",
      title_english: m.title?.english || m.title?.romaji || "Anime",
      images: {
        jpg: {
          large_image_url: m.coverImage?.extraLarge || m.coverImage?.large || "",
          image_url: m.coverImage?.large || "",
        },
      },
      type: m.format || "TV",
      format: m.format || "TV",
      episodes: m.episodes || null,
      status: m.status,
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      synopsis: m.description?.replace(/<[^>]*>/g, "") || "",
      description: m.description?.replace(/<[^>]*>/g, "") || "",
      genres: m.genres || [],
    }));

  if (items.length === 0) return null;
  return { items, hasMore: Boolean(pageData.pageInfo?.hasNextPage) };
}

async function fetchFromJikan(cleanName, page = 1, typeFilter = "all", sortBy = "score") {
  const key = cleanName.toLowerCase();
  const jikanGenreId = JIKAN_GENRE_MAP[key];

  const orderMap = {
    score: "order_by=score&sort=desc",
    popular: "order_by=members&sort=desc",
    newest: "order_by=start_date&sort=desc",
    az: "order_by=title&sort=asc",
  };

  const typeParam =
    typeFilter === "tv" ? "&type=tv" :
    typeFilter === "movie" ? "&type=movie" :
    typeFilter === "ona" ? "&type=ona" : "";

  const isAdult = ["ecchi", "erotica", "hentai"].includes(key);
  const sfwParam = isAdult ? "" : "&sfw=true";
  const genreParam = jikanGenreId ? `&genres=${jikanGenreId}` : `&q=${encodeURIComponent(cleanName)}`;

  const url = `https://api.jikan.moe/v4/anime?page=${page}&limit=24${genreParam}${typeParam}&${orderMap[sortBy] || orderMap.score}${sfwParam}`;

  const res = await fetchWithTimeout(url, {}, 5000);
  if (!res.ok) throw new Error(`Jikan status ${res.status}`);

  const json = await res.json();
  const items = (Array.isArray(json.data) ? json.data : []).map((item) => ({
    ...item,
    title_english: item.title_english || item.title,
  }));
  const hasMore = Boolean(json.pagination?.has_next_page);

  return { items, hasMore };
}

async function fetchGenrePage(genreName, page = 1, typeFilter = "all", sortBy = "score") {
  const cleanName = decodeURIComponent(genreName).trim();
  const key = cleanName.toLowerCase();
  const cacheKey = `${key}__${typeFilter}__${sortBy}__${page}`;

  if (genrePageCache.has(cacheKey)) {
    return genrePageCache.get(cacheKey);
  }

  // 1. Try fast AniList GraphQL first (~150ms response time, no 3 req/sec bottleneck)
  try {
    const anilistResult = await fetchFromAniList(key, page, typeFilter, sortBy);
    if (anilistResult && anilistResult.items.length > 0) {
      genrePageCache.set(cacheKey, anilistResult);
      return anilistResult;
    }
  } catch (err) {
    console.warn("AniList fast genre fetch fell back to Jikan:", err);
  }

  // 2. Fallback to Jikan v4 if AniList didn't have a direct mapping
  const jikanResult = await fetchFromJikan(cleanName, page, typeFilter, sortBy);
  if (jikanResult.items.length > 0) {
    genrePageCache.set(cacheKey, jikanResult);
  }
  return jikanResult;
}

export default function GenreResults() {
  const { genreName } = useParams();
  const navigate = useNavigate();

  const [animeList, setAnimeList] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [typeFilter, setTypeFilter] = useState("all"); // all | tv | movie | ona
  const [sortBy, setSortBy] = useState("score"); // score | popular | newest | az

  const decodedGenre = decodeURIComponent(genreName || "");

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      setPage(1);

      try {
        const { items, hasMore: more } = await fetchGenrePage(decodedGenre, 1, typeFilter, sortBy);
        if (cancelled) return;

        const seen = new Set();
        const unique = items.filter((item) => {
          const id = item.mal_id || item.id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        setAnimeList(unique);
        setHasMore(more);
      } catch (err) {
        console.error("Error loading genre anime:", err);
        if (!cancelled) setAnimeList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, [decodedGenre, typeFilter, sortBy]);

  // Scroll to top only when switching to a different genre
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [decodedGenre]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const { items, hasMore: more } = await fetchGenrePage(decodedGenre, nextPage, typeFilter, sortBy);
      setAnimeList((prev) => {
        const seen = new Set(prev.map((a) => a.mal_id || a.id));
        const added = items.filter((a) => {
          const id = a.mal_id || a.id;
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        return [...prev, ...added];
      });
      setPage(nextPage);
      setHasMore(more);
    } catch (err) {
      console.error("Failed to load more genre items:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh", padding: "28px 36px 80px" }}>
      {/* Breadcrumb / Back navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "13px", color: "var(--text-muted)" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            padding: 0,
          }}
        >
          ← Back
        </button>
        <span>›</span>
        <span>Browse</span>
        <span>›</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{decodedGenre}</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "22px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "2.1rem", fontWeight: 800, margin: 0 }}>
            {decodedGenre} anime
          </h1>
          {!loading && (
            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>
              {animeList.length}{hasMore ? "+" : ""} titles loaded
            </span>
          )}
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "6px 0 0" }}>
          Series and movies tagged {decodedGenre}, sorted the way you choose.
        </p>
      </div>

      {/* Filter & Sort Pill Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "28px",
        }}
      >
        {/* Left: Type Filter */}
        <div
          style={{
            display: "inline-flex",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "999px",
            padding: "4px",
            gap: "4px",
          }}
        >
          {[
            { id: "all", label: "Everything" },
            { id: "tv", label: "Series" },
            { id: "movie", label: "Movies" },
            { id: "ona", label: "ONA / Specials" },
          ].map((tab) => {
            const active = typeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                style={{
                  background: active ? "var(--accent-gradient, var(--accent-color, #ff0080))" : "transparent",
                  color: active ? "#ffffff" : "var(--text-muted)",
                  border: "none",
                  borderRadius: "999px",
                  padding: "6px 16px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right: Sort Filter */}
        <div
          style={{
            display: "inline-flex",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: "999px",
            padding: "4px",
            gap: "4px",
          }}
        >
          {[
            { id: "score", label: "Top rated" },
            { id: "popular", label: "Most popular" },
            { id: "newest", label: "Newest" },
            { id: "az", label: "A-Z" },
          ].map((s) => {
            const active = sortBy === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortBy(s.id)}
                style={{
                  background: active ? "var(--accent-gradient, var(--accent-color, #ff0080))" : "transparent",
                  color: active ? "#ffffff" : "var(--text-muted)",
                  border: "none",
                  borderRadius: "999px",
                  padding: "6px 16px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
            gap: "20px",
          }}
        >
          {Array.from({ length: 14 }).map((_, idx) => (
            <div key={idx} style={{ borderRadius: "10px", overflow: "hidden" }}>
              <div
                style={{
                  width: "100%",
                  paddingBottom: "145%",
                  backgroundColor: "var(--bg-surface, #141414)",
                  border: "1px solid var(--border-color, #222)",
                  borderRadius: "10px",
                  opacity: 0.5,
                }}
              />
              <div style={{ height: "14px", width: "75%", background: "var(--bg-surface)", marginTop: "8px", borderRadius: "4px", opacity: 0.5 }} />
            </div>
          ))}
        </div>
      ) : animeList.length === 0 ? (
        <div style={{ textAlign: "center", padding: "90px 20px", color: "var(--text-muted)" }}>
          <h3>No titles found for {decodedGenre} with the selected filter.</h3>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "20px" }}>
            {animeList.map((anime) => (
              <AnimeCard key={anime.mal_id || anime.id} anime={anime} />
            ))}
          </div>

          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "36px" }}>
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "999px",
                  padding: "10px 28px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: loadingMore ? "wait" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {loadingMore ? "Loading more…" : `Load More ${decodedGenre} Anime ▼`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Keep GenreBrowser at the bottom so users can switch genres anytime */}
      <div style={{ marginTop: "60px", borderTop: "1px solid var(--border-color)", paddingTop: "10px" }}>
        <GenreBrowser />
      </div>
    </div>
  );
}