// One place for the backend address.
// To change it, copy .env.example to .env and edit VITE_API_URL.
export const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");
