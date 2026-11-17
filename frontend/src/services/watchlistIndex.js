// frontend/src/services/watchlistIndex.js
// Shared, subscribable index of which anime ids are on the watchlist.
// Cards used to keep a private 5 second promise cache, so toggling one card
// left every other mounted card showing a stale +/✓. One store fixes that.

import { getAllWatchlist } from "./watchlistService";

let ids = new Set();
let loaded = false;
let loading = null;
let version = 0;
const listeners = new Set();

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function applyList(list) {
  ids = new Set(
    (Array.isArray(list) ? list : [])
      .map((item) => item?.anime_id)
      .filter((id) => id !== undefined && id !== null)
      .map(String)
  );
  loaded = true;
}

export function subscribeWatchlistIndex(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getWatchlistIndexVersion() {
  return version;
}

export function ensureWatchlistLoaded() {
  if (loaded) return Promise.resolve();
  if (loading) return loading;

  loading = getAllWatchlist()
    .then((list) => applyList(list))
    .catch((error) => {
      console.warn("[watchlist] Could not load watchlist:", error?.message || error);
      loaded = true;
    })
    .then(() => {
      loading = null;
      emit();
    });

  return loading;
}

export function isInWatchlist(animeId) {
  if (animeId === undefined || animeId === null) return false;
  return ids.has(String(animeId));
}

// Optimistic update: the caller awaits the API call and rolls back on failure.
export function setInWatchlist(animeId, present) {
  if (animeId === undefined || animeId === null) return;
  const key = String(animeId);
  if (present) ids.add(key);
  else ids.delete(key);
  loaded = true;
  emit();
}

export function refreshWatchlistIndex() {
  loaded = false;
  loading = null;
  return ensureWatchlistLoaded();
}
