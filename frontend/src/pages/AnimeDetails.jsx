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
        setRelatedAnime(related);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }

      // Resume info is optional: if it fails the page must still work.
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
        onhold: "On Hold"
      };
      triggerToast(`📌 Added to ${statusNames[status]}!`);
      setSelectedStatus("");
    } catch (error) {
      console.error(error);
      triggerToast("❌ Failed to add to watchlist");
    }
  };

  if (loading) return <h2 style={{ textAlign: "center", padding: "50px", color: "white" }}>Loading...</h2>;
  if (!anime) return <h2 style={{ textAlign: "center", padding: "50px", color: "white" }}>Anime not found.</h2>;

  const title = anime.title_english || anime.title;
  const japaneseTitle = anime.title_japanese;
  const synopsis = anime.synopsis || "No synopsis available.";
  const truncatedSynopsis = synopsis.length > 420 ? synopsis.substring(0, 420) + "..." : synopsis;

  const visibleRelated = showRelated ? relatedAnime : relatedAnime.slice(0, 6);

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "white", padding: "20px" }}>
      {showToast && (
        <div style={{
          position: "fixed", bottom: "30px", left: "90px", backgroundColor: "rgba(30,30,30,0.9)",
          color: "#fff", padding: "14px 24px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
          zIndex: 9999, fontSize: "14px", fontWeight: "600"
        }}>
          {toastMessage}
        </div>
      )}

      <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
        {/* Fixed Poster */}
        <div style={{ flexShrink: 0 }}>
          <img
            src={anime.images.jpg.large_image_url}
            alt={title}
            referrerPolicy="no-referrer"
            style={{ width: "320px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}
          />
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, minWidth: "300px" }}>
          <h1 style={{ marginBottom: "8px" }} title={japaneseTitle || title}>
            {title}
          </h1>
          
          {japaneseTitle && (
            <p style={{ color: "#888", fontSize: "15px", marginBottom: "20px" }}>
              <strong>Alternate Title:</strong> {japaneseTitle}
            </p>
          )}

          <div style={{ marginBottom: "25px" }}>
            <p style={{ marginBottom: "14px", fontSize: "15px", color: "#e0e0e0" }}>
              <strong>Score:</strong> {anime.score || "N/A"}
            </p>
            <p style={{ marginBottom: "14px", fontSize: "15px", color: "#e0e0e0" }}>
              <strong>Status:</strong> {anime.status}
            </p>
            <p style={{ marginBottom: "14px", fontSize: "15px", color: "#e0e0e0" }}>
              <strong>Started Airing:</strong> {anime.aired?.from ? new Date(anime.aired.from).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Unknown"}
            </p>
            <p style={{ marginBottom: "14px", fontSize: "15px", color: "#e0e0e0" }}>
              <strong>Finished Airing:</strong> {anime.aired?.to ? new Date(anime.aired.to).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Ongoing"}
            </p>
            <p style={{ marginBottom: "14px", fontSize: "15px", color: "#e0e0e0" }}>
              <strong>Episodes:</strong> {anime.episodes || "Ongoing"}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "15px", marginBottom: "30px", flexWrap: "wrap" }}>
            <select
              value={selectedStatus}
              onChange={handleWatchlistChange}
              style={{ padding: "12px", background: "#1f1f1f", color: "white", border: "1px solid #333", borderRadius: "6px", fontSize: "14px", cursor: "pointer" }}
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
                backgroundColor: "#3b82f6", color: "white", fontWeight: "bold",
                border: "none", padding: "12px 28px", borderRadius: "8px", fontSize: "16px", cursor: "pointer"
              }}>
                {hasHistory ? `▶ Resume Ep. ${targetEpisode}` : "▶ Start Watching"}
              </button>
            </Link>
          </div>

          {/* Synopsis Box */}
          <div style={{
            backgroundColor: "#141414",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #252525"
          }}>
            <h3 style={{ marginTop: 0, marginBottom: "12px", color: "#aaa" }}>Synopsis</h3>
            
            <p style={{ 
              lineHeight: "1.7", 
              color: "#ddd", 
              fontSize: "15px",
              maxHeight: showFullSynopsis ? "none" : "195px",
              overflow: "hidden"
            }}>
              {showFullSynopsis ? synopsis : truncatedSynopsis}
            </p>

            {synopsis.length > 420 && (
              <button 
                onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                style={{
                  marginTop: "12px",
                  background: "none",
                  border: "none",
                  color: "#3b82f6",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                {showFullSynopsis ? "Read Less ▲" : "Read More ▼"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible Related Seasons & Media */}
      {relatedAnime.length > 0 && (
        <div style={{
          marginTop: "40px", backgroundColor: "#141414", padding: "20px",
          borderRadius: "8px", border: "1px solid #252525"
        }}>
          <div 
            onClick={() => setShowRelated(!showRelated)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer", paddingBottom: "15px", borderBottom: "1px solid #252525"
            }}
          >
            <h3 style={{ margin: 0, fontSize: "16px", color: "#aaa" }}>
              Related Seasons & Media ({relatedAnime.length})
            </h3>
            <span style={{ fontSize: "18px", transition: "transform 0.3s" }}>
              {showRelated ? "▲" : "▼"}
            </span>
          </div>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", 
            gap: "12px",
            marginTop: "20px"
          }}>
            {visibleRelated.map((rel, idx) => (
              <Link to={`/anime/${rel.mal_id}`} key={idx} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  backgroundColor: "#1f1f1f", border: "1px solid #2a2a2a", borderRadius: "6px",
                  padding: "12px", cursor: "pointer", minHeight: "70px", transition: "all 0.2s"
                }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#2a2a2a"; e.currentTarget.style.borderColor = "#3b82f6"; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#1f1f1f"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
                >
                  <span style={{ fontSize: "10px", color: "#3b82f6", textTransform: "uppercase", fontWeight: "bold" }}>
                    {rel.relation}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: "600", display: "block", marginTop: "4px" }}>
                    {rel.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {!showRelated && relatedAnime.length > 6 && (
            <div style={{ textAlign: "center", marginTop: "15px", color: "#666", fontSize: "14px" }}>
              + {relatedAnime.length - 6} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnimeDetails;