// frontend/src/services/downloadService.js
import axios from "axios";

const API_BASE = "http://localhost:5000/downloads";

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
    throw new Error(err.response?.data?.error || "Failed to start download");
  }
}

/**
 * Delete a downloaded episode file from disk and database
 * @param {number|string} id - Database download record ID
 * @returns {Promise<boolean>}
 */
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
 * Format bytes into readable MB or GB string
 * @param {number} bytes 
 * @returns {string} e.g. "245.5 MB"
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export default {
  getDownloadsList,
  startEpisodeDownload,
  deleteDownload,
  checkEpisodeDownloaded,
  formatFileSize,
};