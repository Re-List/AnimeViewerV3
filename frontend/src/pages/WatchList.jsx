// frontend/src/pages/WatchList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AnimeCard from "../components/AnimeCard";
import { getHistory, removeHistoryItem } from "../services/historyService";
import { getAllWatchlist, removeFromWatchlist } from "../services/watchlistService";

function WatchList() {
  const [activeTab, setActiveTab] = useState("collections");
  const [history, setHistory] = useState([]);
  const [allAnime, setAllAnime] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [hData, aData] = await Promise.all([getHistory(), getAllWatchlist()]);
        if (cancelled) return;
        setHistory(hData || []);
        setAllAnime(aData || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(true);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { watching: 0, completed: 0, onhold: 0, dropped: 0, planned: 0 };
    allAnime.forEach((a) => {
      if (a.status in c) c[a.status]++;
    });
    return c;
  }, [allAnime]);

  const categories = [
    {
      title: "Watching",
      count: counts.watching,
      path: "/watchlist/watching",
      color: "#3b82f6",
      gradient: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
      icon: "▶",
      desc: "Currently in progress",
    },
    {
      title: "Completed",
      count: counts.completed,
      path: "/watchlist/completed",
      color: "#10b981",
      gradient: "linear-gradient(135deg, #064e3b 0%, #10b981 100%)",
      icon: "✓",
      desc: "Finished series",
    },
    {
      title: "On-Hold",
      count: counts.onhold,
      path: "/watchlist/onhold",
      color: "#f59e0b",
      gradient: "linear-gradient(135deg, #78350f 0%, #f59e0b 100%)",
      icon: "⏸",
      desc: "Paused for later",
    },
    {
      title: "Dropped",
      count: counts.dropped,
      path: "/watchlist/dropped",
      color: "#ef4444",
      gradient: "linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)",
      icon: "✕",
      desc: "Stopped watching",
    },
    {
      title: "Planned",
      count: counts.planned,
      path: "/watchlist/planned",
      color: "#8b5cf6",
      gradient: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)",
      icon: "★",
      desc: "Want to watch",
    },
  ];

  const executeDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (deleteType === "history") {
        await removeHistoryItem(itemToDelete);
        setHistory((prev) => prev.filter((item) => item.anime_id !== itemToDelete));
      } else {
        await removeFromWatchlist(itemToDelete);
        setAllAnime((prev) => prev.filter((item) => item.anime_id !== itemToDelete));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setShowModal(false);
      setItemToDelete(null);
    }
  };

  const tabs = [
    { id: "collections", label: "Collections" },
    { id: "history", label: `History (${history.length})` },
    { id: "all", label: `All Anime (${allAnime.length})` },
  ];

  const listItems = activeTab === "history" ? history : allAnime;

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", transition: "all 0.25s ease" }}>
      {/* Sticky Sub-Header with Theme Background */}
      <div
        style={{
          position: "sticky",
          top: "58px",
          zIndex: 100,
          background: "var(--bg-surface)",
          backdropFilter: "blur(12px)",
          padding: "20px 28px 16px",
          borderBottom: "1px solid var(--border-color)",
          transition: "all 0.25s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 700,
                background: "var(--brand-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Watch Management
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
              Organize your list · track progress · revisit history
            </p>
          </div>

          {/* Sub-page Buttons with High-Contrast Text */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              background: "var(--bg-primary)",
              padding: "4px",
              borderRadius: "10px",
              border: "1px solid var(--border-color)",
            }}
          >
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "7px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: active ? 600 : 500,
                    color: active ? "white" : "var(--text-muted)",
                    background: active ? "var(--accent-gradient)" : "transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px 60px" }}>
        {loadError && (
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid #7f1d1d",
              color: "#f87171",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "13px",
            }}
          >
            Could not reach the database. Your backend may be stopped.
          </div>
        )}

        {/* Collections Tab */}
        {activeTab === "collections" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "16px",
            }}
          >
            {categories.map((c) => (
              <Link
                key={c.title}
                to={c.path}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  style={{
                    background: "var(--bg-surface)",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ height: "4px", background: c.gradient }} />
                  <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: c.gradient,
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "16px",
                          fontWeight: 700,
                        }}
                      >
                        {c.icon}
                      </div>
                      <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {c.count}
                      </div>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {c.desc}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* History / All Anime Tabs */}
        {(activeTab === "history" || activeTab === "all") && (
          <>
            {listItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "var(--text-muted)",
                  background: "var(--bg-surface)",
                  borderRadius: "14px",
                  border: "1px dashed var(--border-color)",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.5 }}>
                  {activeTab === "history" ? "🕒" : "📚"}
                </div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                  {activeTab === "history" ? "No watch history yet" : "No anime in your list"}
                </div>
                <div style={{ fontSize: "13px" }}>
                  {activeTab === "history"
                    ? "Play an episode and it will show up here."
                    : "Add titles from anime details pages."}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                  gap: "18px",
                }}
              >
                {listItems.map((item) => (
                  <AnimeCard
                    key={item.anime_id}
                    anime={item}
                    onDeleteClick={(id) => {
                      setItemToDelete(id);
                      setDeleteType(activeTab === "history" ? "history" : "watchlist");
                      setShowModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              padding: "26px 28px",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              maxWidth: "380px",
              width: "90%",
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", color: "var(--text-primary)" }}>Confirm Removal</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "0 0 22px 0" }}>
              Are you sure you want to remove this item?
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={executeDelete}
                style={{
                  padding: "9px 20px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "7px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  padding: "9px 20px",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "7px",
                  cursor: "pointer",
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

export default WatchList;