// frontend/src/services/downloadService.js
import axios from "axios";
import { API_BASE as SERVER_BASE } from "../config";

const API_BASE = `${SERVER_BASE}/downloads`;

/**
 * Fetch all local downloads from the backend database
 * @returns {Promise<Array>} List of downloaded/downloading episodes
 */
export async function getDownloadsList() {
  try {
    const res = await axios.get(`${API_BASE}/list`);
    return res.data?.downloads || [];
  } catch (err) {
    console.error("Failed to load downloads list:", err);
    return [];
  }
}

/**
 * Start downloading an episode in the background
 * @param {number|string} anime_id - The AniList / MAL anime ID
 * @param {string} title - The anime title
 * @param {number|string} episode - Episode number
 * @param {string} image - Cover or episode thumbnail URL
 * @param {string} streamUrl - Direct video stream or source URL
 * @returns {Promise<Object>} { success: true, downloadId }
 */
export async function startEpisodeDownload(anime_id, title, episode, image, streamUrl) {
  try {
    const res = await axios.post(`${API_BASE}/start`, {
      anime_id,
      title,
      episode: Number(episode) || 1,
      image,
      streamUrl,
    });
    return res.data;
  } catch (err) {
    console.error("Failed to start download:", err);
    throw new Error(err.response?.data?.error || "Failed to start download", { cause: err });
  }
}

/**
 * Delete a downloaded episode file from disk and database
 * @param {number|string} id - Database download record ID
 * @returns {Promise<boolean>}
 */
// The backend resolves embed pages and HLS playlists itself; a rejected start
// now carries a readable reason instead of silently "completing".
export async function deleteDownload(id) {
  try {
    const res = await axios.delete(`${API_BASE}/${id}`);
    return res.data?.success || false;
  } catch (err) {
    console.error("Failed to delete download:", err);
    return false;
  }
}

/**
 * Check if a specific episode has already been downloaded
 * @param {number|string} anime_id 
 * @param {number|string} episode 
 * @returns {Promise<Object|null>} The download object if completed, null otherwise
 */
export async function checkEpisodeDownloaded(anime_id, episode) {
  try {
    const list = await getDownloadsList();
    const found = list.find(
      (d) =>
        String(d.anime_id) === String(anime_id) &&
        Number(d.episode) === Number(episode) &&
        d.status === "completed"
    );
    return found || null;
  } catch {
    return null;
  }
}

/**
 * Opens a downloaded file in the system's default video player. Used for
 * MPEG-TS files (what HLS downloads become), which <video> cannot play.
 * @param {number|string} id - Database download record ID
 * @returns {Promise<boolean>}
 */
export async function openDownloadFile(id) {
  try {
    const res = await axios.post(`${API_BASE}/open/${id}`);
    return res.data?.success || false;
  } catch (err) {
    console.error("Failed to open download:", err);
    throw new Error(err.response?.data?.error || "Could not open the file", { cause: err });
  }
}

/**
 * Format bytes into readable KB / MB / GB string
 * @param {number} bytes
 * @returns {string} e.g. "245.5 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Human readable state for an in-flight download. A download spends its first
 * seconds resolving the embed page to a real video URL, and some hosts send no
 * Content-Length, so a plain percentage would sit at 0% and look frozen.
 * @param {Object} item - download row merged with live progress
 * @returns {string}
 */
export function describeDownloadProgress(item) {
  if (!item) return "";
  if (item.stage === "resolving") return "Contacting server…";
  if (item.stage === "saving") return "Finishing download…";

  if (item.progressKnown === false) {
    return item.received > 0
      ? `Downloading — ${formatFileSize(item.received)}`
      : "Starting download…";
  }

  const percent = item.progress || 0;
  return item.received > 0
    ? `Downloading ${percent}% · ${formatFileSize(item.received)}`
    : `Downloading ${percent}%`;
}

/**
 * True while there is no meaningful percentage to display.
 * @param {Object} item
 * @returns {boolean}
 */
export function isIndeterminateDownload(item) {
  if (!item) return false;
  return (
    item.stage === "resolving" || item.stage === "saving" || item.progressKnown === false
  );
}

export default {
  getDownloadsList,
  startEpisodeDownload,
  deleteDownload,
  checkEpisodeDownloaded,
  openDownloadFile,
  formatFileSize,
  describeDownloadProgress,
  isIndeterminateDownload,
};