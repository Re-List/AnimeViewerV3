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
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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

  const confirmClearAll = async () => {
    setIsClearing(true);
    try {
      await hideAllFromContinueWatching();
      setContinueList([]);
      toast.success("Continue Watching cleared");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear the list");
    } finally {
      setIsClearing(false);
      setShowClearModal(false);
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
      <div style={{ padding: "60px", color: "var(--text-muted)", textAlign: "center", background: "var(--bg-primary)", minHeight: "100vh" }}>
        Loading continue watching…
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", padding: "24px 28px 60px", transition: "all 0.25s ease" }}>
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
          <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
            <span
              style={{
                background: "var(--brand-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                display: "inline-block",
              }}
            >
              Continue Watching
            </span>
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
            Pick up exactly where you left off
          </p>
        </div>

        {continueList.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #7f1d1d",
              background: "var(--bg-surface)",
              color: "#f87171",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.2s ease",
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
            color: "var(--text-muted)",
            background: "var(--bg-surface)",
            borderRadius: "14px",
            border: "1px dashed var(--border-color)",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.45 }}>▶</div>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
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
              background: "var(--accent-gradient)",
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✕
                </button>

                <Link to={`/player/${id}/${episode}`} style={{ textDecoration: "none", color: "var(--text-primary)" }}>
                  <div
                    style={{
                      background: "var(--bg-surface)",
                      borderRadius: "12px",
                      overflow: "hidden",
                      border: "1px solid var(--border-color)",
                      transition: "transform 0.15s, border-color 0.15s",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      {image ? (
                        <img
                          src={image}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          style={{ width: "100%", height: "240px", objectFit: "cover", display: "block", background: "var(--bg-primary)" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "240px",
                            background: "var(--bg-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
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
                          color: "white",
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
                            background: "var(--border-color)",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progress.percent}%`,
                              background: "var(--accent-gradient)",
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
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.title}
                      </h4>
                      {progress ? (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                          {progress.percent}% · {formatTime(progress.current)} / {formatTime(progress.duration)}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Episode {episode}</div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Themed Clear Confirmation Modal */}
      {showClearModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              padding: "28px",
              borderRadius: "14px",
              border: "1px solid var(--border-color)",
              maxWidth: "380px",
              width: "90%",
              textAlign: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🧹</div>
            <h3 style={{ margin: "0 0 8px 0", color: "var(--text-primary)", fontSize: "18px", fontWeight: 700 }}>
              Clear Continue Watching?
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "0 0 22px 0", lineHeight: 1.5 }}>
              Your full Watch History is preserved. Shows can be restarted anytime from their details page.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                disabled={isClearing}
                onClick={confirmClearAll}
                style={{
                  padding: "10px 20px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                  transition: "all 0.15s ease",
                }}
              >
                {isClearing ? "Clearing…" : "Yes, Clear All"}
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearModal(false)}
                style={{
                  padding: "10px 20px",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 500,
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

export default ContinueWatching;