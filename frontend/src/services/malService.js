// frontend/src/services/malService.js
import axios from "axios";

const MAL_API_BASE = "https://api.myanimelist.net/v2";

export function getMALToken() {
  return localStorage.getItem("mal_token") || null;
}

export function saveMALToken(token) {
  if (token) {
    localStorage.setItem("mal_token", token.trim());
  }
}

export function removeMALToken() {
  localStorage.removeItem("mal_token");
  localStorage.removeItem("mal_user");
}

export function getMALUser() {
  try {
    const raw = localStorage.getItem("mal_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Pause / Resume Auto-Sync state
export function isMALAutoSyncPaused() {
  return localStorage.getItem("mal_sync_paused") === "1";
}

export function setMALAutoSyncPaused(paused) {
  localStorage.setItem("mal_sync_paused", paused ? "1" : "0");
}

export async function fetchMALProfile(token) {
  try {
    const res = await axios.get(`${MAL_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 15000,
    });
    const user = {
      id: res.data?.id,
      name: res.data?.name,
      picture: res.data?.picture || null,
    };
    if (user.name) {
      localStorage.setItem("mal_user", JSON.stringify(user));
    }
    return user;
  } catch (err) {
    console.error("Failed to fetch MAL profile:", err);
    return null;
  }
}

// Automatically syncs the watched episode directly to your MAL list (respects pause state)
export async function syncEpisodeToMAL(malId, episode, isCompleted = false) {
  if (isMALAutoSyncPaused()) {
    console.log("[MAL] Auto-sync is currently paused by user.");
    return;
  }

  const token = getMALToken();
  if (!token || !malId) return;

  const status = isCompleted ? "completed" : "watching";
  const params = new URLSearchParams({
    status,
    num_watched_episodes: String(episode),
  });

  try {
    await axios.put(
      `${MAL_API_BASE}/anime/${malId}/my_list_status`,
      params.toString(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 15000,
      }
    );
    console.log(`[MAL] Auto-synced Anime ${malId} to episode ${episode}`);
  } catch (err) {
    console.warn("[MAL] Auto-sync skipped or failed:", err.message);
  }
}