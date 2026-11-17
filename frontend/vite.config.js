import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single source of truth for the version shown in the header / What's New modal.
const rootPackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPackage.version),
  },
  // Pages are lazy-loaded in App.jsx, which already splits the bundle per route.
});
