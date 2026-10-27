// frontend/src/pages/Settings.jsx
import { useState, useEffect } from "react";
import { getHistory, removeHistoryItem } from "../services/historyService";
import {
  getWatchlistByStatus,
  getAllWatchlist,
  importWatchlistBulk,
  removeFromWatchlist,
} from "../services/watchlistService";

const SOURCES = ["MegaPlay", "Megavid", "Anixo", "VidHawk"];

function Settings() {
  const [globalLanguage, setGlobalLanguage] = useState(
    () => localStorage.getItem("globalLanguage") || "sub"
  );
  const [defaultSource, setDefaultSource] = useState(
    () => parseInt(localStorage.getItem("playerSource") || "0", 10) % SOURCES.length
  );
  const [autoNext, setAutoNext] = useState(
    () => localStorage.getItem("autoNext") !== "0"
  );
  const [theaterDefault, setTheaterDefault] = useState(
    () => localStorage.getItem("playerTheater") === "1"
  );

  const [history, setHistory] = useState([]);
  const [watchlistStats, setWatchlistStats] = useState({
    watching: 0,
    completed: 0,
    onhold: 0,
    dropped: 0,
    planned: 0,
    total: 0,
  });

  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  useEffect(() => {
    async function loadStatsData() {
      try {
        const historyData = await getHistory();
        setHistory(historyData || []);

        const [watching, completed, onhold, dropped, planned] = await Promise.all([
          getWatchlistByStatus("watching"),
          getWatchlistByStatus("completed"),
          getWatchlistByStatus("onhold"),
          getWatchlistByStatus("dropped"),
          getWatchlistByStatus("planned"),
        ]);

        setWatchlistStats({
          watching: watching.length,
          completed: completed.length,
          onhold: onhold.length,
          dropped: dropped.length,
          planned: planned.length,
          total:
            watching.length +
            completed.length +
            onhold.length +
            dropped.length +
            planned.length,
        });
      } catch (err) {
        console.error("Error loading stats context:", err);
      }
    }
    loadStatsData();
  }, []);

  const handleLanguageChange = (mode) => {
    setGlobalLanguage(mode);
    localStorage.setItem("globalLanguage", mode);
    triggerToast(`Default playback set to ${mode.toUpperCase()}`);
  };

  const handleSourceChange = (i) => {
    setDefaultSource(i);
    localStorage.setItem("playerSource", String(i));
    triggerToast(`Default source → ${SOURCES[i]}`);
  };

  const handleAutoNext = (on) => {
    setAutoNext(on);
    localStorage.setItem("autoNext", on ? "1" : "0");
    triggerToast(on ? "Auto-next enabled" : "Auto-next disabled");
  };

  const handleTheater = (on) => {
    setTheaterDefault(on);
    localStorage.setItem("playerTheater", on ? "1" : "0");
    triggerToast(on ? "Theater mode default: On" : "Theater mode default: Off");
  };

  const exportMAL = async () => {
    try {
      const allItems = await getAllWatchlist();
      let xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist>\n\t<myinfo>\n\t\t<user_name>ReList_User</user_name>\n\t\t<user_export_type>1</user_export_type>\n\t</myinfo>\n\n`;
      const statusMap = {
        watching: "Watching",
        completed: "Completed",
        onhold: "On-Hold",
        dropped: "Dropped",
        planned: "Plan to Watch",
      };

      allItems.forEach((item) => {
        xml += `\t<anime>\n`;
        xml += `\t\t<series_animedb_id>${item.anime_id}</series_animedb_id>\n`;
        xml += `\t\t<series_title><![CDATA[${item.title}]]></series_title>\n`;
        xml += `\t\t<my_status>${statusMap[item.status] || "Plan to Watch"}</my_status>\n`;
        xml += `\t\t<update_on_import>1</update_on_import>\n`;
        xml += `\t</anime>\n`;
      });
      xml += `</myanimelist>`;

      const blob = new Blob([xml], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animelist_export_${Date.now()}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast("MAL XML export downloaded");
    } catch (error) {
      console.error(error);
      triggerToast("Failed to generate export file");
    }
  };

  const importMAL = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        triggerToast("Parsing XML…");
        const xmlText = event.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const animes = xmlDoc.getElementsByTagName("anime");
        const itemsToImport = [];

        for (let i = 0; i < animes.length; i++) {
          const node = animes[i];
          const id = node.getElementsByTagName("series_animedb_id")[0]?.textContent;
          let title = node.getElementsByTagName("series_title")[0]?.textContent;
          if (title) title = title.replace("<![CDATA[", "").replace("]]>", "").trim();
          const malStatus = node.getElementsByTagName("my_status")[0]?.textContent;

          let mappedStatus = "planned";
          if (malStatus === "Watching") mappedStatus = "watching";
          else if (malStatus === "Completed") mappedStatus = "completed";
          else if (malStatus === "On-Hold") mappedStatus = "onhold";
          else if (malStatus === "Dropped") mappedStatus = "dropped";
          else if (malStatus === "Plan to Watch") mappedStatus = "planned";

          if (id && title) {
            itemsToImport.push({
              anime_id: parseInt(id, 10),
              title,
              image: "",
              status: mappedStatus,
            });
          }
        }

        if (itemsToImport.length > 0) {
          await importWatchlistBulk(itemsToImport);
          triggerToast(`Synced ${itemsToImport.length} records`);
          setTimeout(() => window.location.reload(), 1500);
        } else {
          triggerToast("No valid rows found in file");
        }
      } catch (error) {
        console.error(error);
        triggerToast("Failed to read XML");
      }
    };
    reader.readAsText(file);
  };

  const executeClearAllData = async () => {
    setIsClearing(true);
    try {
      const allHistory = await getHistory();
      const allWatchlist = await getAllWatchlist();
      await Promise.all([
        ...allHistory.map((item) => removeHistoryItem(item.anime_id)),
        ...allWatchlist.map((item) => removeFromWatchlist(item.anime_id)),
      ]);
      triggerToast("All data wiped. Reloading…");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error(error);
      triggerToast("Failed to clear database");
      setIsClearing(false);
      setShowClearModal(false);
    }
  };

  const card = {
    background: "#141414",
    borderRadius: "14px",
    border: "1px solid #222",
    padding: "22px",
    minHeight: "160px",
    display: "flex",
    flexDirection: "column",
  };

  const pill = (active) => ({
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    color: "white",
    background: active
      ? "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #f43f5e 100%)"
      : "#1f1f1f",
  });

  const title = { fontSize: "16px", margin: "0 0 6px", fontWeight: 600 };
  const desc = { color: "#777", fontSize: "13px", margin: "0 0 14px", lineHeight: 1.4 };

  return (
    <div
      style={{
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "white",
        padding: "24px 28px 60px",
        position: "relative",
      }}
    >
      {showToast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#1f1f1f",
            border: "1px solid #333",
            color: "white",
            padding: "12px 18px",
            borderRadius: "10px",
            zIndex: 2000,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          {toastMessage}
        </div>
      )}

      <h1
        style={{
          margin: "0 0 6px",
          fontSize: "24px",
          fontWeight: 700,
          background: "linear-gradient(90deg, #fff 0%, #c084fc 50%, #f43f5e 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Application Settings
      </h1>
      <p style={{ margin: "0 0 24px", color: "#666", fontSize: "13px" }}>
        Playback, data sync, and account tools
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "14px",
          alignItems: "stretch",
        }}
      >
        {/* 1 Playback */}
        <div style={card}>
          <h2 style={title}>Playback Preferences</h2>
          <p style={desc}>Default audio language for new episodes.</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "auto" }}>
            <button type="button" onClick={() => handleLanguageChange("sub")} style={pill(globalLanguage === "sub")}>
              Japanese (SUB)
            </button>
            <button type="button" onClick={() => handleLanguageChange("dub")} style={pill(globalLanguage === "dub")}>
              English (DUB)
            </button>
          </div>
        </div>

        {/* 2 Quick Stats */}
        <div style={card}>
          <h2 style={title}>📊 Quick Stats</h2>
          <p style={desc}>Snapshot of your list and history.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto" }}>
            {[
              { label: "Watching", value: watchlistStats.watching, color: "#3b82f6" },
              { label: "Completed", value: watchlistStats.completed, color: "#10b981" },
              { label: "Planned", value: watchlistStats.planned, color: "#8b5cf6" },
              { label: "History", value: history.length, color: "#94a3b8" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#1a1a1a",
                  borderRadius: "10px",
                  border: "1px solid #2a2a2a",
                  padding: "10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "18px", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 3 Default source */}
        <div style={card}>
          <h2 style={title}>Default Video Source</h2>
          <p style={desc}>Used first when you open the player.</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "auto" }}>
            {SOURCES.map((name, i) => (
              <button key={name} type="button" onClick={() => handleSourceChange(i)} style={pill(defaultSource === i)}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Theater */}
        <div style={card}>
          <h2 style={title}>🎬 Theater Mode</h2>
          <p style={desc}>Open the player expanded by default.</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
            <button type="button" onClick={() => handleTheater(true)} style={pill(theaterDefault)}>
              On
            </button>
            <button type="button" onClick={() => handleTheater(false)} style={pill(!theaterDefault)}>
              Off
            </button>
          </div>
        </div>

        {/* 5 Auto-next */}
        <div style={card}>
          <h2 style={title}>Auto-Next Episode</h2>
          <p style={desc}>Jump to the next episode near the end of playback.</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
            <button type="button" onClick={() => handleAutoNext(true)} style={pill(autoNext)}>
              On
            </button>
            <button type="button" onClick={() => handleAutoNext(false)} style={pill(!autoNext)}>
              Off
            </button>
          </div>
        </div>

        {/* 6 Full distribution */}
        <div style={card}>
          <h2 style={title}>📊 Full Distribution</h2>
          <p style={desc}>All collection buckets.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "auto" }}>
            {[
              { label: "Watching", value: watchlistStats.watching, color: "#3b82f6" },
              { label: "Done", value: watchlistStats.completed, color: "#10b981" },
              { label: "Hold", value: watchlistStats.onhold, color: "#f59e0b" },
              { label: "Drop", value: watchlistStats.dropped, color: "#ef4444" },
              { label: "Plan", value: watchlistStats.planned, color: "#8b5cf6" },
              { label: "Total", value: watchlistStats.total, color: "#e2e8f0" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#1a1a1a",
                  borderRadius: "8px",
                  border: "1px solid #2a2a2a",
                  padding: "8px 6px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "15px", fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "10px", color: "#888" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 7 MAL Sync */}
        <div style={card}>
          <h2 style={title}>📁 MAL Data Sync</h2>
          <p style={desc}>Import or export XML backups mapped to MAL.</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "auto" }}>
            <label
              style={{
                ...pill(false),
                background: "#1f1f1f",
                border: "1px solid #333",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Import
              <input type="file" accept=".xml" onChange={importMAL} style={{ display: "none" }} />
            </label>
            <button
              type="button"
              onClick={exportMAL}
              style={{ ...pill(false), background: "#065f46", border: "1px solid #047857" }}
            >
              Export
            </button>
          </div>
        </div>

        {/* 8 About */}
        <div style={card}>
          <h2 style={title}>ℹ️ About Re:List</h2>
          <p style={{ ...desc, marginBottom: "8px" }}>
            Local anime tracker with continue-watching, MAL sync, and multi-source player.
          </p>
          <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.7, marginTop: "auto" }}>
            Version 3 · Vite + React
            <br />
            Press <strong style={{ color: "#aaa" }}>/</strong> or{" "}
            <strong style={{ color: "#aaa" }}>Ctrl+K</strong> to search
          </div>
        </div>

        {/* 9 Danger */}
        <div style={{ ...card, border: "1px solid #7f1d1d", background: "#140f0f" }}>
          <h2 style={title}>🚨 Danger Zone</h2>
          <p style={desc}>Permanently wipe history and all collections.</p>
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            style={{
              marginTop: "auto",
              padding: "10px 16px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "13px",
              alignSelf: "flex-start",
            }}
          >
            Wipe All Data
          </button>
        </div>
      </div>

      {/* Responsive: 2 cols on medium, 1 on small */}
      <style>{`
        @media (max-width: 1100px) {
          .settings-grid-fallback {}
        }
      `}</style>

      {showClearModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3000,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              background: "#161616",
              padding: "28px",
              borderRadius: "14px",
              border: "1px solid #3f1f1f",
              maxWidth: "400px",
              width: "90%",
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: "0 0 8px" }}>Wipe everything?</h3>
            <p style={{ color: "#888", fontSize: "13px", margin: "0 0 20px" }}>
              History + all watchlist statuses will be deleted permanently.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                disabled={isClearing}
                onClick={executeClearAllData}
                style={{
                  padding: "10px 18px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isClearing ? "Wiping…" : "Yes, wipe all"}
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={() => setShowClearModal(false)}
                style={{
                  padding: "10px 18px",
                  background: "#222",
                  color: "white",
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

export default Settings;