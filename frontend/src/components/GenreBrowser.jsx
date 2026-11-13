// frontend/src/components/GenreBrowser.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

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

// Subtle rotating accent colors that blend with the selected theme
const GENRE_COLORS = [
  "var(--accent-color, #ff0080)",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#60a5fa",
];

export default function GenreBrowser() {
  const [expanded, setExpanded] = useState(true);
  const displayedGenres = expanded ? ALL_GENRES : ALL_GENRES.slice(0, 24);

  return (
    <section style={{ margin: "48px 0 24px", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
            Browse by Genre
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
            Pick a mood — click any genre to explore all series and movies
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
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
          {expanded ? "Show less ▲" : "Show all ▼"}
        </button>
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
        {displayedGenres.map((genre, idx) => {
          const baseColor = GENRE_COLORS[idx % GENRE_COLORS.length];
          return (
            <Link
              key={genre}
              to={`/genre/${encodeURIComponent(genre)}`}
              style={{
                textDecoration: "none",
                color: baseColor,
                fontSize: "14px",
                fontWeight: 600,
                padding: "4px 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "opacity 0.15s ease, transform 0.15s ease",
                 opacity: 0.88,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateX(4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.88";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              {genre}
            </Link>
          );
        })}
      </div>
    </section>
  );
}