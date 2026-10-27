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
    }
    setShowModal(false);
  };

  const tabs = [
    { id: "collections", label: "Collections" },
    { id: "history", label: `History (${history.length})` },
    { id: "all", label: `All Anime (${allAnime.length})` },
  ];

  const listItems =
    activeTab === "history" ? history : activeTab === "all" ? allAnime : [];

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "white" }}>
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: "58px",
          zIndex: 100,
          background: "rgba(10,10,10,0.95)",
          backdropFilter: "blur(10px)",
          padding: "22px 28px 16px",
          borderBottom: "1px solid #1f1f1f",
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
                background: "linear-gradient(90deg, #fff 0%, #c084fc 50%, #f43f5e 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Watch Management
            </h1>
            <p style={{ margin: "4px 0 0", color: "#666", fontSize: "13px" }}>
              Organize your list · track progress · revisit history
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "6px",
              background: "#141414",
              padding: "4px",
              borderRadius: "10px",
              border: "1px solid #222",
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
                    color: "white",
                    background: active
                      ? "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #f43f5e 100%)"
                      : "transparent",
                    transition: "all 0.15s",
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
              background: "#2a1414",
              border: "1px solid #5c2020",
              color: "#fca5a5",
              borderRadius: "10px",
              padding: "14px 18px",
              marginBottom: "20px",
            }}
          >
            Couldn’t load your list. Make sure the backend is running, then refresh.
          </div>
        )}

        {/* Collections */}
        {activeTab === "collections" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            {categories.map((c) => (
              <Link key={c.path} to={c.path} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    background: "#141414",
                    borderRadius: "14px",
                    border: "1px solid #222",
                    overflow: "hidden",
                    transition: "transform 0.15s, border-color 0.15s",
                    cursor: "pointer",
                    height: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.borderColor = c.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "#222";
                  }}
                >
                  <div style={{ height: "4px", background: c.gradient }} />
                  <div style={{ padding: "20px 18px 18px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "12px",
                      }}
                    >
                      <span
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "10px",
                          background: c.gradient,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "15px",
                          color: "white",
                        }}
                      >
                        {c.icon}
                      </span>
                      <span
                        style={{
                          fontSize: "22px",
                          fontWeight: 700,
                          color: "white",
                        }}
                      >
                        {c.count}
                      </span>
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "white", marginBottom: "4px" }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#777" }}>{c.desc}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* History / All Anime */}
        {(activeTab === "history" || activeTab === "all") && (
          <>
            {listItems.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "#666",
                  background: "#121212",
                  borderRadius: "14px",
                  border: "1px dashed #2a2a2a",
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.5 }}>
                  {activeTab === "history" ? "🕒" : "📚"}
                </div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "#999", marginBottom: "6px" }}>
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
                      setDeleteType(activeTab);
                      setShowModal(true);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "#161616",
              padding: "28px 32px",
              borderRadius: "14px",
              textAlign: "center",
              border: "1px solid #2a2a2a",
              maxWidth: "360px",
              width: "90%",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>Remove this title?</h3>
            <p style={{ margin: "0 0 22px", color: "#888", fontSize: "13px" }}>
              This can’t be undone from here.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={executeDelete}
                style={{
                  background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                  color: "white",
                  padding: "10px 22px",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "#222",
                  color: "white",
                  padding: "10px 22px",
                  border: "1px solid #333",
                  borderRadius: "8px",
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