// frontend/src/pages/AnimeDetails.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getAnimeDetails, getAnimeRelations } from "../services/animeService";
import { getLatestEpisode } from "../services/historyService";
import { addToWatchlist } from "../services/watchlistService";

function AnimeDetails() {
  const { id } = useParams();
  const [anime, setAnime] = useState(null);
  const [relatedAnime, setRelatedAnime] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetEpisode, setTargetEpisode] = useState(1);
  const [hasHistory, setHasHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showRelated, setShowRelated] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadAnimeData() {
      setLoading(true);
      setHasHistory(false);
      setTargetEpisode(1);
      window.scrollTo(0, 0);

      try {
        const data = await getAnimeDetails(id);
        if (cancelled) return;
        setAnime(data);

        const related = await getAnimeRelations(id);
        if (cancelled) return;
        setRelatedAnime(related || []);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }

      try {
        const latestEp = await getLatestEpisode(id);
        if (cancelled) return;
        if (latestEp) {
          setTargetEpisode(latestEp);
          setHasHistory(true);
        }
      } catch (err) {
        console.warn("Could not load watch progress:", err);
      }

      if (!cancelled) setLoading(false);
    }

    loadAnimeData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleWatchlistChange = async (e) => {
    const status = e.target.value;
    if (!status || !anime) return;

    try {
      await addToWatchlist(anime, status);
      const statusNames = {
        watching: "Currently Watching",
        completed: "Completed",
        dropped: "Dropped",
        planned: "Plan to Watch",
        onhold: "On Hold",
      };
      triggerToast(`📌 Added to ${statusNames[status]}!`);
      setSelectedStatus("");
    } catch (error) {
      console.error(error);
      triggerToast("❌ Failed to add to watchlist");
    }
  };

  if (loading) return <h2 style={{ textAlign: "center", padding: "50px", color: "var(--text-primary)" }}>Loading...</h2>;
  if (!anime) return <h2 style={{ textAlign: "center", padding: "50px", color: "var(--text-primary)" }}>Anime not found.</h2>;

  const title = anime.title_english || anime.title;
  const japaneseTitle = anime.title_japanese;
  const synopsis = anime.synopsis || "No synopsis available.";
  const truncatedSynopsis = synopsis.length > 420 ? synopsis.substring(0, 420) + "..." : synopsis;
  const visibleRelated = showRelated ? relatedAnime : relatedAnime.slice(0, 6);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", padding: "24px 28px 60px", transition: "all 0.25s ease" }}>
      {showToast && (
        <div style={{
          position: "fixed", bottom: "30px", right: "30px", background: "var(--bg-surface)",
          color: "var(--text-primary)", padding: "14px 24px", borderRadius: "10px", border: "1px solid var(--border-color)",
          zIndex: 9999, fontSize: "14px", fontWeight: "600", boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
        {/* Poster */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={anime.images.jpg.large_image_url}
            alt={title}
            referrerPolicy="no-referrer"
            style={{ width: "300px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <h1 style={{ marginBottom: "8px", fontSize: "28px", fontWeight: 700 }} title={japaneseTitle || title}>
            {title}
          </h1>

          {japaneseTitle && (
            <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "20px" }}>
              <strong>Alternate Title:</strong> {japaneseTitle}
            </p>
          )}

          <div style={{ marginBottom: "25px", color: "var(--text-primary)", fontSize: "15px" }}>
            <p style={{ marginBottom: "12px" }}>
              <strong style={{ color: "var(--text-muted)" }}>Score:</strong> ★ {anime.score || "N/A"}
            </p>
            <p style={{ marginBottom: "12px" }}>
              <strong style={{ color: "var(--text-muted)" }}>Status:</strong> {anime.status}
            </p>
            <p style={{ marginBottom: "12px" }}>
              <strong style={{ color: "var(--text-muted)" }}>Started Airing:</strong> {anime.aired?.from ? new Date(anime.aired.from).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Unknown"}
            </p>
            <p style={{ marginBottom: "12px" }}>
              <strong style={{ color: "var(--text-muted)" }}>Episodes:</strong> {anime.episodes || "Ongoing"}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "15px", marginBottom: "30px", flexWrap: "wrap" }}>
            <select
              value={selectedStatus}
              onChange={handleWatchlistChange}
              style={{
                padding: "12px 16px",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <option value="">➕ Add to List...</option>
              <option value="watching">▶ Watching</option>
              <option value="completed">✔️ Completed</option>
              <option value="onhold">⏸️ On Hold</option>
              <option value="dropped">❌ Dropped</option>
              <option value="planned">⏳ Plan to Watch</option>
            </select>

            <Link to={`/player/${id}/${targetEpisode}`} style={{ textDecoration: 'none' }}>
              <button style={{
                background: "var(--accent-gradient)", color: "white", fontWeight: "bold",
                border: "none", padding: "12px 28px", borderRadius: "8px", fontSize: "15px", cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0,0,0,0.2)"
              }}>
                {hasHistory ? `▶ Resume Ep. ${targetEpisode}` : "▶ Start Watching"}
              </button>
            </Link>
          </div>

          {/* Synopsis */}
          <div style={{
            background: "var(--bg-surface)",
            padding: "22px",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "12px", color: "var(--text-primary)" }}>Synopsis</h3>
            <p style={{ lineHeight: "1.7", color: "var(--text-muted)", fontSize: "14px" }}>
              {showFullSynopsis ? synopsis : truncatedSynopsis}
            </p>
            {synopsis.length > 420 && (
              <button
                onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                style={{
                  marginTop: "12px",
                  background: "none",
                  border: "none",
                  color: "#38bdf8",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                {showFullSynopsis ? "Read Less ▲" : "Read More ▼"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Related Seasons & Media */}
      {relatedAnime.length > 0 && (
        <div style={{
          marginTop: "40px",
          background: "var(--bg-surface)",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
        }}>
          {/* Clickable Header with Expand Toggle Chevron */}
          <div
            onClick={() => setShowRelated(!showRelated)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              paddingBottom: "15px",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <h2 style={{ fontSize: "18px", margin: 0, color: "var(--text-primary)", fontWeight: 700 }}>
              Related Seasons & Media ({relatedAnime.length})
            </h2>
            <span
              style={{
                fontSize: "16px",
                color: "var(--text-muted)",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                padding: "4px 10px",
                borderRadius: "6px",
                fontWeight: 600,
              }}
            >
              {showRelated ? "Collapse ▲" : `Expand (${relatedAnime.length}) ▼`}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginTop: "18px" }}>
            {visibleRelated.map((rel, idx) => (
              <Link
                key={idx}
                to={`/anime/${rel.mal_id}`}
                style={{
                  textDecoration: "none",
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "block",
                  color: "var(--text-primary)",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: "bold", color: "#38bdf8", textTransform: "uppercase", marginBottom: "4px" }}>
                  {rel.relation || "Related"}
                </div>
                {/* Shows the actual anime name */}
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rel.name || rel.title || "Related Anime"}
                </div>
              </Link>
            ))}
          </div>

          {!showRelated && relatedAnime.length > 6 && (
            <div
              onClick={() => setShowRelated(true)}
              style={{ textAlign: "center", marginTop: "15px", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}
            >
              + {relatedAnime.length - 6} more (click to show all)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnimeDetails;