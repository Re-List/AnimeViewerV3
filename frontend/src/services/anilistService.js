// frontend/src/services/anilistService.js
import axios from "axios";

const ANILIST_API = "https://graphql.anilist.co";

export function getAniListToken() {
  return localStorage.getItem("anilist_token") || null;
}

export function saveAniListToken(token) {
  if (token) {
    localStorage.setItem("anilist_token", token.trim());
  }
}

export function removeAniListToken() {
  localStorage.removeItem("anilist_token");
  localStorage.removeItem("anilist_user");
}

export function getAniListUser() {
  try {
    const raw = localStorage.getItem("anilist_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Fetches the logged-in user's profile info
export async function fetchViewerProfile(token) {
  const query = `
    query {
      Viewer {
        id
        name
        avatar { large medium }
      }
    }
  `;
  try {
    const res = await axios.post(
      ANILIST_API,
      { query },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    const viewer = res.data?.data?.Viewer;
    if (viewer) {
      localStorage.setItem("anilist_user", JSON.stringify(viewer));
    }
    return viewer;
  } catch (err) {
    console.error("Failed to fetch AniList viewer profile:", err);
    return null;
  }
}

// Automatically syncs the watched episode to AniList
export async function syncEpisodeToAniList(malId, episode, isCompleted = false) {
  const token = getAniListToken();
  if (!token || !malId) return;

  const mutation = `
    mutation ($idMal: Int, $progress: Int, $status: MediaListStatus) {
      SaveMediaListEntry (idMal: $idMal, progress: $progress, status: $status) {
        id
        status
        progress
      }
    }
  `;

  const variables = {
    idMal: parseInt(malId, 10),
    progress: parseInt(episode, 10),
    status: isCompleted ? "COMPLETED" : "CURRENT",
  };

  try {
    await axios.post(
      ANILIST_API,
      { query: mutation, variables },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    console.log(`[AniList] Auto-synced MAL ${malId} to episode ${episode}`);
  } catch (err) {
    console.warn("[AniList] Auto-sync skipped or failed:", err.message);
  }
}