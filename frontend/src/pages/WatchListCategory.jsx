// frontend/src/pages/WatchListCategory.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AnimeCard from "../components/AnimeCard";
import { getWatchlistByStatus, removeFromWatchlist } from "../services/watchlistService";

function WatchListCategory() {
  const { category } = useParams();
  const [animeList, setAnimeList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [animeToDelete, setAnimeToDelete] = useState(null);

  const titleMap = {
    watching: "Watching",
    completed: "Completed",
    onhold: "On-Hold",
    dropped: "Dropped",
    planned: "Plan to Watch",
  };

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const data = await getWatchlistByStatus(category);
        if (!cancelled) setAnimeList(data || []);
      } catch (err) {
        console.error("Failed to load category:", err);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const handleDeleteClick = (id) => {
    setAnimeToDelete(id);
    setShowModal(true);
  };

  const executeDelete = async () => {
    if (!animeToDelete) return;
    try {
      await removeFromWatchlist(animeToDelete);
      setAnimeList((prev) => prev.filter((item) => Number(item.anime_id) !== Number(animeToDelete)));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setShowModal(false);
    setAnimeToDelete(null);
  };

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", padding: "28px 36px 80px", transition: "all 0.25s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <Link to="/watchlist" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>
          ← Back to Collections
        </Link>
        <span style={{ color: "var(--border-color)" }}>/</span>
        <h1 style={{ margin: 0, fontSize: "1.85rem", fontWeight: 800, color: "var(--text-primary)" }}>
          {titleMap[category] || category.charAt(0).toUpperCase() + category.slice(1)}
        </h1>
      </div>

      {animeList.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "var(--text-muted)",
          background: "var(--bg-surface)",
          borderRadius: "14px",
          border: "1px dashed var(--border-color)",
          marginTop: "20px",
        }}>
          <h3>No anime in this category yet.</h3>
        </div>
      ) : (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", 
          gap: "18px" 
        }}>
          {animeList.map((item) => (
            <AnimeCard
              key={item.anime_id}
              anime={item}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showModal && (
        <div style={{ 
          position: "fixed", 
          inset: 0, 
          background: "rgba(0,0,0,0.75)", 
          display: "flex", alignItems: "center", justifyContent: "center", 
          zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{ 
            background: "var(--bg-surface)", 
            padding: "28px", 
            borderRadius: "12px", 
            textAlign: "center", 
            border: "1px solid var(--border-color)",
            minWidth: "320px",
            color: "var(--text-primary)"
          }}>
            <h3 style={{ margin: "0 0 10px 0" }}>Confirm Removal?</h3>
            <p style={{ color: "var(--text-muted)", margin: "0 0 20px 0", fontSize: "14px" }}>
              This action cannot be undone.
            </p>
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                type="button"
                onClick={executeDelete} 
                style={{ 
                  background: "#ef4444", color: "white", padding: "10px 24px", 
                  border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" 
                }}
              >
                Delete
              </button>
              <button 
                type="button"
                onClick={() => setShowModal(false)} 
                style={{ 
                  background: "var(--bg-primary)", color: "var(--text-primary)", padding: "10px 24px", 
                  border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer" 
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WatchListCategory;