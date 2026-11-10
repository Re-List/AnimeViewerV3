// frontend/src/services/watchlistService.js
import axios from "axios";
import { API_BASE } from "../config";

const API = `${API_BASE}/favorites`;

export async function addToWatchlist(animeOrPayload, statusArg) {
  try {
    let payload;
    if (animeOrPayload && typeof animeOrPayload === "object" && animeOrPayload.anime_id) {
      payload = {
        anime_id: Number(animeOrPayload.anime_id),
        title: animeOrPayload.title || "Anime",
        image: animeOrPayload.image || "",
        status: animeOrPayload.status || statusArg || "watching",
      };
    } else {
      payload = {
        anime_id: Number(animeOrPayload?.mal_id || animeOrPayload?.id),
        title: animeOrPayload?.title || animeOrPayload?.title_english || "Anime",
        image: animeOrPayload?.images?.jpg?.large_image_url || animeOrPayload?.images?.jpg?.image_url || animeOrPayload?.image || "",
        status: statusArg || "watching",
      };
    }

    const response = await axios.post(API, payload);
    return response.data;
  } catch (error) {
    console.error("Failed to add to watchlist:", error);
    throw error;
  }
}

export async function getWatchlistByStatus(status) {
  const response = await axios.get(`${API}/${status}`);
  return response.data;
}

export async function getAllWatchlist() {
  const response = await axios.get(`${API}/all`);
  return response.data;
}

export async function removeFromWatchlist(animeId) {
  await axios.delete(`${API}/${animeId}`);
}

export async function importWatchlistBulk(items) {
  await axios.post(`${API}/bulk`, { items });
}