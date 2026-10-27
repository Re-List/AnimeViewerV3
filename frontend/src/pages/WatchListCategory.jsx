// frontend/src/pages/WatchListCategory.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
    planned: "Planned"
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getWatchlistByStatus(category);
        setAnimeList(data || []);
      } catch (err) {
        console.error("Failed to load category:", err);
      }
    }
    loadData();
  }, [category]);

  const handleDeleteClick = (id) => {
    setAnimeToDelete(id);
    setShowModal(true);
  };

  const executeDelete = async () => {
    if (!animeToDelete) return;
    try {
      await removeFromWatchlist(animeToDelete);
      setAnimeList((prev) => prev.filter((item) => item.anime_id !== animeToDelete));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setShowModal(false);
  };

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", padding: "24px 28px 60px", transition: "all 0.25s ease" }}>
      <h1 style={{ 
        marginTop: 0, 
        marginBottom: "24px", 
        borderLeft: "4px solid #7c3aed", 
        paddingLeft: "12px",
        fontSize: "24px",
        fontWeight: 700,
        color: "var(--text-primary)"
      }}>
        {titleMap[category] || category.charAt(0).toUpperCase() + category.slice(1)}
      </h1>

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
              onDeleteClick={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showModal && (
        <div style={{ 
          position: "fixed", 
          inset: 0, 
          background: "rgba(0,0,0,0.7)", 
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
                onClick={executeDelete} 
                style={{ 
                  background: "#ef4444", color: "white", padding: "10px 24px", 
                  border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" 
                }}
              >
                Delete
              </button>
              <button 
                onClick={() => setShowModal(false)} 
                style={{ 
                  background: "var(--bg-primary)", color: "var(--text-primary)", padding: "10px 24px", 
                  border: "1px solid var(--border-color)", borderRadius: "6px", cursor: "pointer" 
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