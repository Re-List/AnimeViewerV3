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
        setAnimeList(data);
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
      setAnimeList(prev => prev.filter(item => item.anime_id !== animeToDelete));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setShowModal(false);
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "white", padding: "20px" }}>
      <h1 style={{ 
        marginTop: 0, 
        marginBottom: "20px", 
        borderLeft: "4px solid #3b82f6", 
        paddingLeft: "10px" 
      }}>
        {titleMap[category] || category.charAt(0).toUpperCase() + category.slice(1)}
      </h1>

      {animeList.length === 0 ? (
        <h3 style={{ color: "#888", textAlign: "center", marginTop: "50px" }}>
          No anime in this category yet.
        </h3>
      ) : (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", 
          gap: "20px" 
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
          top: 0, left: 0, width: "100%", height: "100%", 
          background: "rgba(0,0,0,0.85)", 
          display: "flex", alignItems: "center", justifyContent: "center", 
          zIndex: 1000 
        }}>
          <div style={{ 
            background: "#1f1f1f", 
            padding: "30px", 
            borderRadius: "8px", 
            textAlign: "center", 
            border: "1px solid #333",
            minWidth: "300px"
          }}>
            <h3>Confirm Removal?</h3>
            <p style={{ color: "#aaa", margin: "15px 0" }}>This action cannot be undone.</p>
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "20px" }}>
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
                  background: "#333", color: "white", padding: "10px 24px", 
                  border: "none", borderRadius: "6px", cursor: "pointer" 
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