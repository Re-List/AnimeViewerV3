// frontend/src/services/adultFilter.js
// Single source of truth for the 18+ content filter.
// Components subscribe with useSyncExternalStore(subscribe, getVersion) so a
// toggle in Settings updates every mounted card, grid and player at once.

const STORAGE_KEY = "relist_show_18plus";

let version = 0;
const listeners = new Set();

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeAdultFilter(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAdultFilterVersion() {
  return version;
}

export function isAdultAllowed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAdultAllowed(allowed) {
  try {
    localStorage.setItem(STORAGE_KEY, allowed ? "true" : "false");
  } catch {
    // Private mode / storage disabled: still update the in-memory subscribers.
  }
  emit();
}

// Detect adult titles from either AniList or Jikan shaped metadata.
export function isAdultAnime(anime) {
  if (!anime) return false;
  if (anime.isAdult === true) return true;

  const rating = String(anime.rating || "").toLowerCase();
  if (rating.includes("rx") || rating.includes("hentai")) return true;

  const genres = Array.isArray(anime.genres) ? anime.genres : [];
  return genres.some((genre) => {
    const name = String(typeof genre === "string" ? genre : genre?.name || "").toLowerCase();
    return name === "hentai" || name === "erotica";
  });
}

// Keep other tabs/windows in sync with the stored preference.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === STORAGE_KEY) emit();
  });
}
