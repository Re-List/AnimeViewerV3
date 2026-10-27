// frontend/src/pages/Search.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AnimeTile from "../components/AnimeTile";
import { searchAnime } from "../services/animeService";

function Search() {
  const [params] = useSearchParams();
  const q = (params.get("q") || "").trim();

  // The results remember which query they belong to, so "loading" is simply
  // "results are for a different query" - and a slow old request can't win.
  const [state, setState] = useState({ q: "", results: [] });

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    searchAnime(q).then((results) => {
      if (!cancelled) setState({ q, results });
    });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const loading = q && state.q !== q;

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "white", padding: "24px 28px" }}>
      {!q ? (
        <h3 style={{ color: "#888", textAlign: "center", marginTop: "80px" }}>
          Type something in the search box to find anime.
        </h3>
      ) : (
        <>
          <h2 style={{ margin: "0 0 20px 0" }}>Results for “{q}”</h2>

          {loading && <p style={{ color: "#888" }}>Searching…</p>}

          {!loading && state.results.length === 0 && (
            <p style={{ color: "#888" }}>
              Nothing found. Check the spelling, or try the original (romaji) title.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "18px" }}>
            {!loading && state.results.map((anime) => (
              <AnimeTile key={anime.mal_id} anime={anime} fluid />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Search;
