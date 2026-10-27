// frontend/src/pages/ContinueWatching.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getContinueWatching,
  hideFromContinueWatching,
  hideAllFromContinueWatching,
} from "../services/historyService";

function ContinueWatching() {
  const [continueList, setContinueList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getContinueWatching();
        setContinueList(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleHide = async (e, animeId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await hideFromContinueWatching(animeId);
      setContinueList((prev) => prev.filter((item) => item.anime_id !== animeId));
    } catch (err) {
      console.error(err);
      toast.error("Could not remove it — is the backend running?");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear the Continue Watching list? Your Watch History is kept.")) return;
    try {
      await hideAllFromContinueWatching();
      setContinueList([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear the list");
    }
  };

  const getProgress = (animeId, episode) => {
    try {
      const saved = localStorage.getItem(`progress_${animeId}_${episode}`);
      if (!saved) return null;
      const data = JSON.parse(saved);
      if (data.duration > 0) {
        return {
          current: data.currentTime || 0,
          duration: data.duration,
          percent: Math.min(100, Math.round((data.currentTime / data.duration) * 100)),
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div style={{ padding: "60px", color: "#888", textAlign: "center" }}>
        Loading continue watching…
      </div>
    );
  }

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "white", padding: "24px 28px 60px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              background: "linear-gradient(90deg, #fff 0%, #c084fc 50%, #f43f5e 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Continue Watching
          </h1>
          <p style={{ margin: "6px 0 0", color: "#666", fontSize: "13px" }}>
            Pick up exactly where you left off
          </p>
        </div>

        {continueList.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #3f1f1f",
              background: "#1a1212",
              color: "#f87171",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {continueList.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "70px 20px",
            color: "#666",
            background: "#121212",
            borderRadius: "14px",
            border: "1px dashed #2a2a2a",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.45 }}>▶</div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#999", marginBottom: "6px" }}>
            Nothing to continue
          </div>
          <div style={{ fontSize: "13px" }}>Start watching an episode and it will appear here.</div>
          <Link
            to="/"
            style={{
              display: "inline-block",
              marginTop: "18px",
              padding: "10px 18px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #7c3aed, #f43f5e)",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            Browse Home
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "18px",
          }}
        >
          {continueList.map((item) => {
            const id = item.anime_id;
            const episode = parseInt(item.episode, 10) || 1;
            const progress = getProgress(id, episode);
            const image =
              item.image ||
              item.images?.jpg?.large_image_url ||
              item.images?.jpg?.image_url ||
              localStorage.getItem(`img_${id}`) ||
              "";

            return (
              <div key={`${id}-${episode}`} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={(e) => handleHide(e, id)}
                  title="Remove from Continue Watching"
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    zIndex: 5,
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(0,0,0,0.75)",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  ✕
                </button>

                <Link to={`/player/${id}/${episode}`} style={{ textDecoration: "none", color: "white" }}>
                  <div
                    style={{
                      background: "#141414",
                      borderRadius: "12px",
                      overflow: "hidden",
                      border: "1px solid #222",
                      transition: "transform 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.borderColor = "#7c3aed";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.borderColor = "#222";
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      {image ? (
                        <img
                          src={image}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          style={{ width: "100%", height: "240px", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "240px",
                            background: "#111",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#555",
                            fontSize: "12px",
                          }}
                        >
                          No Image
                        </div>
                      )}

                      <div
                        style={{
                          position: "absolute",
                          bottom: "10px",
                          left: "10px",
                          background: "rgba(0,0,0,0.8)",
                          color: "#c4b5fd",
                          padding: "3px 8px",
                          borderRadius: "5px",
                          fontSize: "11px",
                          fontWeight: 700,
                        }}
                      >
                        EP {episode}
                      </div>

                      {progress && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: "rgba(255,255,255,0.12)",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progress.percent}%`,
                              background: "linear-gradient(90deg, #7c3aed, #f43f5e)",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ padding: "12px" }}>
                      <h4
                        style={{
                          margin: "0 0 6px",
                          fontSize: "13.5px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </h4>
                      {progress ? (
                        <div style={{ fontSize: "12px", color: "#aaa" }}>
                          {progress.percent}% · {formatTime(progress.current)} / {formatTime(progress.duration)}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "#666" }}>Episode {episode}</div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContinueWatching;