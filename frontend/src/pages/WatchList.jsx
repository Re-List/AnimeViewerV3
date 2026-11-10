// frontend/src/pages/WatchList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AnimeCard from "../components/AnimeCard";
import { getHistory, removeHistoryItem } from "../services/historyService";
import { getAllWatchlist, removeFromWatchlist } from "../services/watchlistService";
import { getDownloadsList, deleteDownload, formatFileSize } from "../services/downloadService";

function WatchList() {
  const [activeTab, setActiveTab] = useState("collections");
  const [history, setHistory] = useState([]);
  const [allAnime, setAllAnime] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState("");
  const [expandedAnimeTitle, setExpandedAnimeTitle] = useState(null);
  const [offlinePlayingItem, setOfflinePlayingItem] = useState(null);

  const [selectedDownloadIds, setSelectedDownloadIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const [hData, aData, dData] = await Promise.all([
          getHistory(),
          getAllWatchlist(),
          getDownloadsList(),
        ]);
        if (cancelled) return;
        setHistory(hData || []);
        setAllAnime(aData || []);
        setDownloads(dData || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadError(true);
      }
    }

    init();
    const timer = setInterval(init, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
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
    { title: "Watching", count: counts.watching, path: "/watchlist/watching", color: "#3b82f6", gradient: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", icon: "▶", desc: "Currently in progress" },
    { title: "Completed", count: counts.completed, path: "/watchlist/completed", color: "#10b981", gradient: "linear-gradient(135deg, #064e3b 0%, #10b981 100%)", icon: "✓", desc: "Finished series" },
    { title: "On-Hold", count: counts.onhold, path: "/watchlist/onhold", color: "#f59e0b", gradient: "linear-gradient(135deg, #78350f 0%, #f59e0b 100%)", icon: "⏸", desc: "Paused for later" },
    { title: "Dropped", count: counts.dropped, path: "/watchlist/dropped", color: "#ef4444", gradient: "linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)", icon: "✕", desc: "Discontinued" },
    { title: "Plan to Watch", count: counts.planned, path: "/watchlist/planned", color: "#8b5cf6", gradient: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)", icon: "★", desc: "Queued for later" },
  ];

  const groupedDownloads = useMemo(() => {
    const map = {};
    downloads.forEach((d) => {
      const key = d.title || "Unknown Anime";
      if (!map[key]) {
        map[key] = { title: key, image: d.image, items: [] };
      }
      map[key].items.push(d);
    });
    return Object.values(map);
  }, [downloads]);

  const handleDeleteClick = (id, type) => {
    setItemToDelete(id);
    setDeleteType(type);
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteType === "history") {
        await removeHistoryItem(itemToDelete);
        setHistory((prev) => prev.filter((item) => item.anime_id !== itemToDelete));
      } else if (deleteType === "downloads") {
        await deleteDownload(itemToDelete);
        setDownloads((prev) => prev.filter((d) => d.id !== itemToDelete));
        setSelectedDownloadIds((prev) => {
          const next = new Set(prev);
          next.delete(itemToDelete);
          return next;
        });
      } else if (deleteType === "bulk_downloads") {
        for (const id of selectedDownloadIds) {
          await deleteDownload(id);
        }
        setDownloads((prev) => prev.filter((d) => !selectedDownloadIds.has(d.id)));
        setSelectedDownloadIds(new Set());
      } else {
        await removeFromWatchlist(itemToDelete);
        setAllAnime((prev) => prev.filter((item) => item.anime_id !== itemToDelete));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setShowModal(false);
      setItemToDelete(null);
      setDeleteType("");
    }
  };

  const toggleSelectDownload = (id) => {
    setSelectedDownloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDownloadsForAnime = (groupItems) => {
    setSelectedDownloadIds((prev) => {
      const next = new Set(prev);
      const allSelected = groupItems.every((item) => next.has(item.id));
      groupItems.forEach((item) => {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  };

  const tabs = [
    { id: "collections", label: "Collections" },
    { id: "history", label: `History (${history.length})` },
    { id: "all", label: `All Anime (${allAnime.length})` },
    { id: "downloads", label: `Downloads (${downloads.length})` },
  ];

  const listItems = activeTab === "history" ? history : allAnime;

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", transition: "all 0.25s ease" }}>
      {/* Sticky Sub-Header */}
      <div style={{ position: "sticky", top: "58px", zIndex: 100, background: "var(--bg-surface)", backdropFilter: "blur(12px)", padding: "20px 28px 16px", borderBottom: "1px solid var(--border-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, background: "var(--brand-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Watch Management
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
              Organize your list · track progress · offline downloads
            </p>
          </div>

          <div style={{ display: "flex", gap: "6px", background: "var(--bg-surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
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
                    border: active ? "1px solid transparent" : "1px solid var(--border-color)",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#ffffff" : "var(--text-primary)",
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

      <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto" }}>
        {loadError && (
          <div style={{ padding: "14px 18px", background: "#7f1d1d", color: "#fca5a5", borderRadius: "10px", marginBottom: "20px" }}>
            Failed to load your lists. Please try refreshing.
          </div>
        )}

        {/* Collections View */}
        {activeTab === "collections" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "18px" }}>
            {categories.map((c) => (
              <Link
                key={c.title}
                to={c.path}
                style={{
                  textDecoration: "none",
                  background: "var(--bg-surface)",
                  borderRadius: "14px",
                  border: "1px solid var(--border-color)",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "130px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: c.gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "16px", fontWeight: "bold" }}>
                    {c.icon}
                  </div>
                  <span style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {c.count}
                  </span>
                </div>
                <div>
                  <h3 style={{ margin: "14px 0 2px", fontSize: "16px", color: "var(--text-primary)", fontWeight: 600 }}>
                    {c.title}
                  </h3>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>
                    {c.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Downloads View with Huge Disclaimer */}
        {activeTab === "downloads" && (
          <div>
            {/* Huge Disclaimer Banner in the Middle */}
            <div
              style={{
                backgroundColor: "rgba(245, 158, 11, 0.1)",
                border: "2px dashed #f59e0b",
                borderRadius: "16px",
                padding: "36px 32px",
                textAlign: "center",
                marginBottom: "28px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>⚠️</div>
              <h2 style={{ color: "#f59e0b", margin: "0 0 10px", fontSize: "22px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" }}>
                Offline Downloads Feature Under Development
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "650px", margin: "0 auto", lineHeight: 1.6 }}>
                The offline video downloading and stream capture functionality is currently being rebuilt to support external encrypted HLS streams. Please check back in a future update! You can still browse and manage your existing downloads below or use online streaming.
              </p>
            </div>

            {downloads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                  No downloaded episodes currently stored.
                </div>
              </div>
            ) : (
              <div>
                {selectedDownloadIds.size > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px 20px", borderRadius: "10px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#ef4444" }}>
                      {selectedDownloadIds.size} episode(s) selected
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(null, "bulk_downloads")}
                      style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                    >
                      Delete Selected
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {groupedDownloads.map((group) => {
                    const isExpanded = expandedAnimeTitle === group.title;
                    const allGroupSelected = group.items.every((i) => selectedDownloadIds.has(i.id));

                    return (
                      <div
                        key={group.title}
                        style={{
                          background: "var(--bg-surface)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "14px",
                          overflow: "hidden",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
                        }}
                      >
                        <div
                          style={{
                            padding: "16px 20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            background: "var(--bg-surface)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "16px", cursor: "pointer", flex: 1 }} onClick={() => setExpandedAnimeTitle(isExpanded ? null : group.title)}>
                            <img
                              src={group.image || "https://placehold.co/100x140/111/fff?text=Anime"}
                              alt={group.title}
                              style={{ width: "48px", height: "64px", objectFit: "cover", borderRadius: "6px" }}
                            />
                            <div>
                              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                                {group.title}
                              </h3>
                              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                {group.items.length} Episode{group.items.length > 1 ? "s" : ""} Downloaded
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                            <button
                              type="button"
                              onClick={() => selectAllDownloadsForAnime(group.items)}
                              style={{ padding: "5px 10px", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}
                            >
                              {allGroupSelected ? "Deselect Series" : "Select Series"}
                            </button>
                            <span onClick={() => setExpandedAnimeTitle(isExpanded ? null : group.title)} style={{ fontSize: "13px", color: "var(--accent-color, #ff0080)", fontWeight: 700, cursor: "pointer" }}>
                              {isExpanded ? "Collapse ▲" : "View Episodes ▼"}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: "1px solid var(--border-color)", padding: "14px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px", background: "var(--bg-primary)" }}>
                            {group.items.map((ep) => {
                              const isSelected = selectedDownloadIds.has(ep.id);
                              return (
                                <div key={ep.id} style={{ background: "var(--bg-surface)", border: isSelected ? "1px solid var(--accent-color, #ff0080)" : "1px solid var(--border-color)", borderRadius: "10px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectDownload(ep.id)}
                                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                                    />
                                    <div>
                                      <div style={{ fontSize: "13px", fontWeight: 700 }}>Episode {ep.episode}</div>
                                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                        {formatFileSize(ep.file_size)}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClick(ep.id, "downloads")}
                                      style={{ padding: "5px 10px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
                                    >
                                      ✕ Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History / All Anime View */}
        {activeTab !== "collections" && activeTab !== "downloads" && (
          <div>
            {listItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📂</div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" }}>
                  No items in this section yet.
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "18px" }}>
                {listItems.map((item) => (
                  <AnimeCard key={item.anime_id} anime={item} onDelete={(id) => handleDeleteClick(id, activeTab)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Offline Video Player Modal */}
      {offlinePlayingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 3000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div style={{ width: "100%", maxWidth: "1000px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0, color: "white", fontSize: "18px" }}>{offlinePlayingItem.title}</h3>
              <span style={{ fontSize: "13px", color: "var(--accent-color, #ff0080)" }}>Offline Episode {offlinePlayingItem.episode}</span>
            </div>
            <button
              onClick={() => setOfflinePlayingItem(null)}
              style={{ padding: "8px 16px", background: "#333", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
            >
              ✕ Close Player
            </button>
          </div>
          <video
            controls
            autoPlay
            src={`http://localhost:5000/downloads/stream/${offlinePlayingItem.id}`}
            style={{ width: "100%", maxWidth: "1000px", maxHeight: "80vh", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-color)", padding: "24px", borderRadius: "14px", maxWidth: "360px", width: "90%", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px", color: "var(--text-primary)" }}>
              {deleteType === "bulk_downloads" ? "Delete selected episodes?" : `Remove from ${deleteType === "downloads" ? "Downloads" : deleteType === "history" ? "History" : "Watchlist"}?`}
            </h3>
            <p style={{ margin: "0 0 20px", color: "var(--text-muted)", fontSize: "13px" }}>
              {deleteType === "downloads" || deleteType === "bulk_downloads" ? "This will delete the downloaded video file(s) from your disk." : "This action cannot be undone."}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "var(--text-primary)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WatchList;