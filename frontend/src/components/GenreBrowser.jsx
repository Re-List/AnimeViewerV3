// frontend/src/components/GenreBrowser.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { isAdultAnime } from "../services/adultFilter";

// Adult-only genres stay hidden until the 18+ filter is enabled.
const ALL_GENRES = [
  "Action", "Action & Adventure", "Adventure", "Animation", "Avant Garde",
  "Award Winning", "Boys Love", "Cars", "Comedy", "Dementia", "Demons",
  "Drama", "Ecchi", "Erotica", "Fantasy", "Game", "Girls Love",
  "Gourmet", "Harem", "Hentai", "Historical", "Horror", "Isekai",
  "Josei", "Kids", "Magic", "Mahou Shoujo", "Martial Arts", "Mecha",
  "Military", "Music", "Mystery", "Parody", "Police", "Psychological",
  "Romance", "Samurai", "School", "Sci-Fi", "Sci-Fi & Fantasy",
  "Seinen", "Shoujo", "Shounen", "Slice of Life", "Space", "Sports",
  "Super Power", "Supernatural", "Suspense", "Thriller", "Time Travel",
  "Vampire", "Workplace"
];

const ADULT_GENRES = new Set(["erotica", "hentai"]);

const COLLAPSED_COUNT = 24;

// Theme-aware colors (set per theme in themeService). The old hard-coded hex
// values failed contrast on the light themes.
const GENRE_COLORS = [
  "var(--genre-1)",
  "var(--genre-2)",
  "var(--genre-3)",
  "var(--genre-4)",
  "var(--genre-5)",
];

export default function GenreBrowser() {
  const [expanded, setExpanded] = useState(false);
  const genres = ALL_GENRES.filter(
    (genre) => !ADULT_GENRES.has(genre.toLowerCase()) || isAdultAnime({ genres: [genre] })
  );
  const displayedGenres = expanded ? genres : genres.slice(0, COLLAPSED_COUNT);

  return (
    <section style={{ margin: "48px 0 24px", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
            Browse by Genre
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
            Pick a mood — click any genre to explore all series and movies
          </p>
        </div>

        {genres.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent-color, #ff0080)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            {expanded ? "Show less ▲" : `Show all ${genres.length} ▼`}
          </button>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
          columnGap: "24px",
          rowGap: "14px",
          padding: "8px 0",
        }}
      >
        {displayedGenres.map((genre, idx) => (
          <Link
            key={genre}
            to={`/genre/${encodeURIComponent(genre)}`}
            style={{
              textDecoration: "none",
              color: GENRE_COLORS[idx % GENRE_COLORS.length],
              fontSize: "14px",
              fontWeight: 600,
              padding: "4px 0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "opacity 0.15s ease, transform 0.15s ease",
              opacity: 0.92,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "1";
              e.currentTarget.style.transform = "translateX(4px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "0.92";
              e.currentTarget.style.transform = "translateX(0)";
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = "2px solid var(--accent-color)";
              e.currentTarget.style.outlineOffset = "3px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = "none";
            }}
          >
            {genre}
          </Link>
        ))}
      </div>
    </section>
  );
}
