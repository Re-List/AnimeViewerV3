// frontend/src/services/historyService.js
import axios from "axios";
import { API_BASE } from "../config";

const API = `${API_BASE}/history`;

// Saves "last watched episode" for an anime.
// `anime` can be the shaped object from animeService (mal_id / images.jpg.image_url)
// or a plain history/watchlist row (anime_id / image).
export async function addHistory(anime, episode) {
  await axios.post(API, {
    anime: {
      mal_id: anime.mal_id || anime.id || anime.anime_id,
      title: anime.title || anime.title_english || "Unknown",
      images: {
        jpg: {
          image_url: anime.images?.jpg?.image_url || anime.image || "",
        },
      },
    },
    episode: Number(episode),
  });
}

// Everything ever watched (used by the Watch List "History" tab and the Player).
export async function getHistory() {
  const response = await axios.get(API);
  return response.data;
}

// Recent shows for the Continue Watching page / Home row
// (hidden shows and shows marked Completed are filtered out by the server).
export async function getContinueWatching() {
  const response = await axios.get(`${API}/continue`);
  return response.data;
}

// Deletes a show from history completely.
export async function removeHistoryItem(animeId) {
  await axios.delete(`${API}/${animeId}`);
}

// Hides a show from Continue Watching but keeps it in History.
export async function hideFromContinueWatching(animeId) {
  await axios.post(`${API}/hide/${animeId}`);
}

export async function hideAllFromContinueWatching() {
  await axios.post(`${API}/hide-all`);
}

// Last episode opened for one anime, or null if never watched.
export async function getLatestEpisode(animeId) {
  const response = await axios.get(`${API}/latest/${animeId}`);
  return response.data.episode;
}
