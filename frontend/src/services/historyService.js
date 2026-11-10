// frontend/src/services/historyService.js
import axios from "axios";
import { API_BASE } from "../config";

const API = `${API_BASE}/history`;

// Saves "last watched episode" for an anime.
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

// Everything ever watched
export async function getHistory() {
  const response = await axios.get(API);
  return response.data;
}

// Recent shows for Continue Watching page
export async function getContinueWatching() {
  const response = await axios.get(`${API}/continue`);
  return response.data;
}

// Deletes a show from history completely
export async function removeHistoryItem(animeId) {
  await axios.delete(`${API}/${animeId}`);
}

// Hides a show from Continue Watching
export async function hideFromContinueWatching(animeId) {
  await axios.post(`${API}/hide/${animeId}`);
}

export async function hideAllFromContinueWatching() {
  await axios.post(`${API}/hide-all`);
}

// Last episode opened
export async function getLatestEpisode(animeId) {
  const response = await axios.get(`${API}/latest/${animeId}`);
  return response.data.episode;
}

export const addHistoryItem = (item, ep) => addHistory(item, ep || item?.episode);
export const saveHistory = addHistory;