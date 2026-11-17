// One place for the backend address.
// Priority: VITE_API_URL from .env, then the Electron desktop default,
// then same-origin (the backend serves the built frontend itself).

const configuredBase = import.meta.env.VITE_API_URL;

function resolveBase() {
  if (configuredBase) return configuredBase;

  if (typeof window === "undefined") return "http://localhost:5000";

  const isElectron = Boolean(window.electronAPI);
  if (isElectron) return "http://localhost:5000";

  // vite dev server proxies nothing, so talk to the local backend directly.
  if (import.meta.env.DEV) return "http://localhost:5000";

  // Served by the Express backend: same origin, works on any host/port.
  return window.location.origin;
}

export const API_BASE = resolveBase().replace(/\/$/, "");
