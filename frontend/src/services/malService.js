// frontend/src/services/malService.js
// The MAL access token never reaches the browser: the backend exchanges the
// code, stores the token in SQLite and performs every API call. This module
// only talks to our own backend.
import axios from "axios";
import { API_BASE } from "../config";

const MAL_API = `${API_BASE}/auth/mal`;
const LEGACY_TOKEN_KEY = "mal_token";
const RECONNECT_FLAG = "relist_mal_reconnect_needed";

// ---- Reconnect state ------------------------------------------------------
// Tokens used to live in the browser. Anything still stored there belongs to a
// user who must sign in again so the backend can hold the token.

let authFailure = null;
// "Never linked" is silent: it must not block a later connect, but it also must
// not send a request per episode or show any warning.
let notConnected = false;
let version = 0;
const listeners = new Set();

// Shared connection status so the app shell (not only Settings) can react.
let status = { loaded: false, connected: false, user: null };
let statusVersion = 0;
const statusListeners = new Set();

function setStatus(next) {
  status = { loaded: true, ...next };
  statusVersion += 1;
  statusListeners.forEach((listener) => listener());
}

export function subscribeMALStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function getMALStatusSnapshot() {
  return status;
}

export function getMALStatusVersion() {
  return statusVersion;
}

function emit() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribeMALAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Stable snapshot for useSyncExternalStore.
export function getMALAuthSnapshot() {
  return authFailure;
}

export function getMALAuthVersion() {
  return version;
}

export function isMALAuthBlocked() {
  return Boolean(authFailure) || notConnected;
}

// Recorded once per session: further sync attempts short-circuit instead of
// hammering a dead token and toasting on every episode.
function reportAuthFailure(status) {
  markMALReconnectNeeded(true);
  if (authFailure) return;
  authFailure = { status, at: Date.now() };
  console.warn(
    `[MAL] Session rejected (HTTP ${status}). Auto-sync paused until you reconnect.`
  );
  emit();
}

export function clearMALAuthFailure() {
  markMALReconnectNeeded(false);
  notConnected = false;
  if (!authFailure) return;
  authFailure = null;
  emit();
}

export function readLegacyMALToken() {
  try {
    return localStorage.getItem(LEGACY_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Tokens used to live in localStorage; purge anything left behind.
export function purgeLegacyMALToken() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}

export function markMALReconnectNeeded(needed) {
  try {
    if (needed) localStorage.setItem(RECONNECT_FLAG, "1");
    else localStorage.removeItem(RECONNECT_FLAG);
  } catch {
    // storage unavailable
  }
}

export function isMALReconnectNeeded() {
  try {
    return localStorage.getItem(RECONNECT_FLAG) === "1";
  } catch {
    return false;
  }
}

export async function getMALStatus() {
  try {
    const res = await axios.get(`${MAL_API}/status`, { timeout: 5000 });
    const next = {
      connected: Boolean(res.data?.connected),
      user: res.data?.user || null,
    };
    setStatus(next);
    return next;
  } catch (error) {
    console.warn("[MAL] Status check failed:", error?.message || error);
    return { connected: false, user: null };
  }
}

// Re-check status without forcing every caller to read the promise.
export function refreshMALStatus() {
  return getMALStatus();
}

// Detect accounts migrated from the old build: their token is still in the
// browser, so it has to go and they must sign in again. Runs at app start, not
// just when Settings is opened.
export function detectLegacyMALToken() {
  const legacy = readLegacyMALToken();
  if (!legacy) return false;
  purgeLegacyMALToken();
  markMALReconnectNeeded(true);
  return true;
}

// Opens the MAL consent screen and waits for the backend to report a session.
// Shared by Settings and the app-wide reconnect banner.
export async function startMALLogin({ intervalMs = 2000, timeoutMs = 120000 } = {}) {
  const loginUrl = `${MAL_API}/login`;

  if (typeof window !== "undefined" && window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(loginUrl);
  } else if (typeof window !== "undefined") {
    window.open(loginUrl, "_blank");
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const current = await getMALStatus();
    if (current.connected) {
      clearMALAuthFailure();
      setStatus({ connected: true, user: current.user });
      return current;
    }
  }
  return null;
}

export async function disconnectMAL() {
  await axios.post(`${MAL_API}/disconnect`, {}, { timeout: 5000 });
  setStatus({ connected: false, user: null });
  try {
    localStorage.removeItem("mal_user");
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // storage unavailable
  }
}

export async function syncMALWatchlist() {
  try {
    const res = await axios.post(`${MAL_API}/sync-watchlist`, {}, { timeout: 30000 });
    return res.data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 401) reportAuthFailure(status);
    if (status === 409) notConnected = true;
    throw error;
  }
}

export function getMALUser() {
  try {
    const raw = localStorage.getItem("mal_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function cacheMALUser(user) {
  try {
    if (user) localStorage.setItem("mal_user", JSON.stringify(user));
    else localStorage.removeItem("mal_user");
  } catch {
    // storage unavailable
  }
}

// Pause / Resume Auto-Sync state
export function isMALAutoSyncPaused() {
  return localStorage.getItem("mal_sync_paused") === "1";
}

export function setMALAutoSyncPaused(paused) {
  localStorage.setItem("mal_sync_paused", paused ? "1" : "0");
}

// Automatically syncs the watched episode directly to your MAL list (respects pause state)
export async function syncEpisodeToMAL(malId, episode, isCompleted = false) {
  if (isMALAutoSyncPaused()) {
    console.log("[MAL] Auto-sync is currently paused by user.");
    return;
  }

  if (!malId) return;

  // Already known to be signed out: do not send another request per episode.
  if (isMALAuthBlocked()) return;

  try {
    await axios.post(
      `${MAL_API}/sync-episode`,
      { mal_id: Number(malId), episode: Number(episode), completed: Boolean(isCompleted) },
      { timeout: 15000 }
    );
  } catch (err) {
    const status = err?.response?.status;
    // 401 only: our backend answers 403 for a rejected request origin, which
    // has nothing to do with the MAL session.
    if (status === 401) {
      reportAuthFailure(status);
      return;
    }
    if (status === 409) {
      // Quietly stop asking until the user connects MAL again.
      notConnected = true;
      return;
    }
    // Offline or MAL hiccup: auto-sync is best effort.
    console.warn("[MAL] Auto-sync skipped:", err?.message || err);
  }
}
