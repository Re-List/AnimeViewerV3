// frontend/src/pages/Search.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { searchAnime } from "../services/animeService";
import AnimeCard from "../components/AnimeCard";

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchAnime(query)
      .then((data) => {
        if (!cancelled) setResults(data || []);
      })
      .catch((err) => {
        console.error("Search error:", err);
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", padding: "28px 36px 80px" }}>
      <h1 style={{ fontSize: "1.85rem", fontWeight: 800, margin: "0 0 6px" }}>
        Search Results for <span style={{ color: "var(--accent-color, #ff0080)" }}>"{query}"</span>
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "0 0 28px" }}>
        {loading ? "Searching AniList database..." : `Found ${results.length} matches`}
      </p>

      {loading ? (
        <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          <p style={{ fontSize: "16px", fontWeight: 600 }}>Loading results…</p>
        </div>
      ) : results.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "18px" }}>
          {results.map((anime) => (
            <AnimeCard key={anime.mal_id || anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-muted)" }}>
          <p style={{ fontSize: "15px" }}>No anime found matching your query.</p>
        </div>
      )}
    </div>
  );
}