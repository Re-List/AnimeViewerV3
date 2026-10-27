// frontend/src/services/watchlistService.js
import axios from "axios";
import { API_BASE } from "../config";

const API = `${API_BASE}/favorites`;

export async function addToWatchlist(anime, status) {
  try {
    await axios.post(API, {
      anime_id: anime.mal_id,
      title: anime.title,
      title_english: anime.title_english,
      title_japanese: anime.title_japanese,
      image: anime.images?.jpg?.large_image_url || anime.image,
      status
    });
    return true;
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
