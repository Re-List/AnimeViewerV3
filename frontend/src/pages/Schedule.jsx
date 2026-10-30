// frontend/src/pages/Schedule.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAiringSchedule } from "../services/animeService";

const DAYS = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "+2 Days", offset: 2 },
  { label: "+3 Days", offset: 3 },
  { label: "+4 Days", offset: 4 },
  { label: "+5 Days", offset: 5 },
  { label: "+6 Days", offset: 6 },
];

function formatCountdown(seconds) {
  if (seconds <= 0) return "Aired Today";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `Airs in ${hours}h ${minutes}m`;
  return `Airs in ${minutes}m`;
}

function Schedule() {
  const [selectedDay, setSelectedDay] = useState(0);
  const [scheduleList, setScheduleList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getAiringSchedule(selectedDay).then((data) => {
      if (!cancelled) {
        setScheduleList(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", padding: "24px 28px 60px", transition: "all 0.25s ease" }}>
      {/* Title */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
          <span style={{ background: "var(--brand-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Weekly Airing Schedule
          </span>
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
          Live anime broadcast calendar with release countdowns
        </p>
      </div>

      {/* Days Tabs */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "20px" }}>
        {DAYS.map((d) => {
          const active = selectedDay === d.offset;
          return (
            <button
              key={d.offset}
              type="button"
              onClick={() => setSelectedDay(d.offset)}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: active ? "none" : "1px solid var(--border-color)",
                background: active ? "var(--accent-gradient)" : "var(--bg-surface)",
                color: active ? "white" : "var(--text-primary)",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Schedule Grid */}
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)" }}>
          Loading schedule…
        </div>
      ) : scheduleList.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "var(--text-muted)",
          background: "var(--bg-surface)",
          borderRadius: "14px",
          border: "1px dashed var(--border-color)",
        }}>
          <h3>No major scheduled broadcasts found for this day.</h3>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "18px" }}>
          {scheduleList.map((item) => (
            <Link
              key={item.id}
              to={`/anime/${item.mal_id}`}
              style={{ textDecoration: "none", color: "var(--text-primary)" }}
            >
              <div
                style={{
                  background: "var(--bg-surface)",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  overflow: "hidden",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                  transition: "transform 0.2s ease",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <div style={{ position: "relative" }}>
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: "100%", height: "240px", objectFit: "cover", display: "block" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      right: "8px",
                      background: "rgba(0,0,0,0.8)",
                      color: item.timeUntilAiring <= 0 ? "#10b981" : "#38bdf8",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    {formatCountdown(item.timeUntilAiring)}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      background: "var(--accent-gradient)",
                      color: "white",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    Ep {item.episode}
                  </div>
                </div>

                <div style={{ padding: "12px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "auto" }}>
                    {item.genres.slice(0, 2).join(", ")}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Schedule;