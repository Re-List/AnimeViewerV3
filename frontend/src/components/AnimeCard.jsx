// frontend/src/components/AnimeCard.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAnimeDetails } from "../services/animeService";

function isRealImageUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

// Jikan allows ~3 requests/sec. A watchlist page fires one lookup per tile,
// so serialize them or most of the posters 429 and stay blank.
let imageQueue = Promise.resolve();
function enqueueImageLookup(fn) {
  const run = imageQueue.then(fn, fn);
  imageQueue = run.then(
    () => new Promise((resolve) => setTimeout(resolve, 400)),
    () => new Promise((resolve) => setTimeout(resolve, 400))
  );
  return run;
}

function AnimeCard({
  anime,
  onDeleteClick,
  isSearchResult = false
}) {
  const id = anime.mal_id || anime.anime_id;

  const initialSrc = (() => {
    const cached = localStorage.getItem(`img_${id}`);
    const fromAnime =
      anime.images?.jpg?.large_image_url ||
      anime.images?.jpg?.image_url ||
      anime.image;
    // MAL XML import stores the literal "MAL_IMPORT", which is not a URL.
    // A cached non-http value is just as useless.
    if (isRealImageUrl(cached)) return cached;
    if (isRealImageUrl(fromAnime)) return fromAnime;
    return "";
  })();

  const [src, setSrc] = useState(initialSrc);

  useEffect(() => {
    if (isRealImageUrl(src)) return;

    let cancelled = false;
    enqueueImageLookup(async () => {
      try {
        const details = await getAnimeDetails(id);
        const newImg =
          details?.images?.jpg?.large_image_url ||
          details?.images?.jpg?.image_url;
        if (!cancelled && isRealImageUrl(newImg)) {
          setSrc(newImg);
          localStorage.setItem(`img_${id}`, newImg);
        }
      } catch {
        console.warn(`Failed to load image for anime ${id}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, src]);

  const displayTitle = anime.title_english || anime.title;

  return (
    <div style={{ background: "#1f1f1f", borderRadius: "8px", position: "relative", overflow: "hidden" }}>
      {!isSearchResult && onDeleteClick && (
        <button
          onClick={(e) => { e.preventDefault(); onDeleteClick(id); }}
          style={{
            position: "absolute", top: "8px", right: "8px", zIndex: 10,
            background: "rgba(0,0,0,0.7)", border: "none", color: "white",
            borderRadius: "50%", cursor: "pointer", width: "28px", height: "28px",
            fontSize: "16px"
          }}
        >
          ✕
        </button>
      )}

      <Link to={`/anime/${id}`} style={{ textDecoration: "none", color: "white" }}>
        {src ? (
          <img
            src={src}
            alt={displayTitle}
            referrerPolicy="no-referrer"
            onError={() => {
              localStorage.removeItem(`img_${id}`);
              setSrc("");
            }}
            style={{ width: "100%", height: "260px", objectFit: "cover", display: "block", background: "#111" }}
          />
        ) : (
          <div style={{ width: "100%", height: "260px", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "11px", color: "#444", fontWeight: "bold" }}>LOADING...</span>
          </div>
        )}

        <div style={{ padding: "12px" }}>
          <h4 style={{
            margin: 0,
            fontSize: "13.5px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: "1.3"
          }}>
            {displayTitle}
          </h4>
        </div>
      </Link>
    </div>
  );
}

export default AnimeCard;
