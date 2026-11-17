// backend/lib/createApp.js
const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const getDB = require("../database/db");
const { getSetting, setSetting, deleteSetting } = require("../database/db");
const favoritesRoute = require("../routes/Favorites");
const historyRoute = require("../routes/history");
const downloadsRoute = require("../routes/downloads");

// Initialised by the Electron launcher, overridable for local development.
const MASTER_MAL_CLIENT_ID = "956acf7dab4c48da35604da2c88e151a";
const MAL_REDIRECT_URI = "http://localhost:5000";
const MAL_SCOPES = "user_edit";

const TOKEN_KEY = "mal_access_token";
const REFRESH_KEY = "mal_refresh_token";
const EXPIRES_KEY = "mal_expires_at";
const USER_KEY = "mal_user";

function openInSystemBrowser(url) {
  if (process.platform === "win32") {
    exec(`start "" "${url}"`);
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

function buildOriginCheck() {
  const configured = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set([
    MAL_REDIRECT_URI,
    "http://127.0.0.1:5000",
    ...configured,
  ]);

  // No Origin header means a non-browser client (Electron main process, curl)
  // — trusted. Otherwise the origin must be allow-listed or match the host the
  // request arrived on (same-origin deployments, including reverse proxies).
  return (req) => {
    const origin = req.get("origin");
    if (!origin) return true;
    if (allowed.has(origin)) return true;

    try {
      const originHost = new URL(origin).host;
      const requestHost = req.get("x-forwarded-host") || req.get("host");
      return Boolean(requestHost) && originHost === requestHost;
    } catch {
      return false;
    }
  };
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);

  const isAllowedOrigin = buildOriginCheck();

  // CORS headers are per-request (the decision needs the request host), so the
  // cors package's static config cannot express it.
  app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin && isAllowedOrigin(req)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    if (req.method === "OPTIONS") {
      if (origin && !isAllowedOrigin(req)) {
        return res.status(403).json({ success: false, error: "Origin not allowed" });
      }
      return res.sendStatus(204);
    }
    next();
  });

  // Writes from foreign origins are rejected outright (local API + CSRF).
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    if (isAllowedOrigin(req)) return next();
    return res.status(403).json({ success: false, error: "Origin not allowed" });
  });

  app.use(express.json({ limit: "5mb" }));

  // API routes
  app.use("/favorites", favoritesRoute);
  app.use("/history", historyRoute);
  app.use("/downloads", downloadsRoute);

  // ========================================================
  // MYANIMELIST (MAL) OAUTH & WATCHLIST SYNC
  // The access token never leaves the backend: it is stored in SQLite here and
  // used for every MAL call, including the per-episode auto-sync.
  // ========================================================
  let malSession = { clientId: null, codeVerifier: null };

  async function readMALUser() {
    const raw = await getSetting(USER_KEY, null);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function clearMALSession() {
    await Promise.all([
      deleteSetting(TOKEN_KEY),
      deleteSetting(REFRESH_KEY),
      deleteSetting(EXPIRES_KEY),
      deleteSetting(USER_KEY),
    ]);
    malSession = { clientId: null, codeVerifier: null };
  }

  async function exchangeRefreshToken() {
    const refreshToken = await getSetting(REFRESH_KEY, null);
    const clientId = (await getSetting("mal_client_id", null)) || MASTER_MAL_CLIENT_ID;
    if (!refreshToken || !clientId) return null;

    try {
      const params = new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      const res = await axios.post(
        "https://myanimelist.net/v1/oauth2/token",
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 }
      );
      const token = res.data?.access_token;
      if (!token) return null;

      await setSetting(TOKEN_KEY, token);
      if (res.data?.refresh_token) await setSetting(REFRESH_KEY, res.data.refresh_token);
      const expiresIn = Number(res.data?.expires_in) || 0;
      await setSetting(EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
      return token;
    } catch (error) {
      console.warn("MAL token refresh failed:", error.response?.data || error.message);
      return null;
    }
  }

  async function getMALToken() {
    const token = await getSetting(TOKEN_KEY, null);
    if (!token) return null;

    const expiresAt = Number(await getSetting(EXPIRES_KEY, "0")) || 0;
    if (expiresAt && expiresAt - Date.now() < 60_000) {
      return exchangeRefreshToken();
    }
    return token;
  }

  // 1. Initiate MAL Login
  app.get("/auth/mal/login", async (req, res) => {
    const clientId = req.query.client_id || MASTER_MAL_CLIENT_ID;
    if (!clientId || clientId === "YOUR_MAL_CLIENT_ID_HERE") {
      return res.status(400).send("Master MAL Client ID is not configured in backend/lib/createApp.js");
    }

    const codeVerifier = crypto.randomBytes(64).toString("hex");
    malSession = { clientId, codeVerifier };
    await setSetting("mal_client_id", clientId);

    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&code_challenge=${codeVerifier}&code_challenge_method=plain&redirect_uri=${encodeURIComponent(MAL_REDIRECT_URI)}`;

    openInSystemBrowser(authUrl);
    res.redirect(authUrl);
  });

  // Helper: Token Exchange + Profile Fetch (in Node, avoiding CORS)
  async function handleMALTokenExchange(code, res) {
    if (!malSession.clientId || !malSession.codeVerifier || !code) {
      return res
        .status(400)
        .send("Expired or invalid login session. Please return to Re:List and click Authorize again.");
    }

    try {
      const params = new URLSearchParams({
        client_id: malSession.clientId,
        code,
        code_verifier: malSession.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: MAL_REDIRECT_URI,
      });

      const tokenRes = await axios.post(
        "https://myanimelist.net/v1/oauth2/token",
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 }
      );

      const token = tokenRes.data?.access_token;
      if (!token) throw new Error("No access token returned from MAL");

      // Fetch user profile through backend (bypasses CORS restrictions)
      let profile = null;
      try {
        const userRes = await axios.get("https://api.myanimelist.net/v2/users/@me", {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        });
        profile = {
          id: userRes.data?.id,
          name: userRes.data?.name,
          picture: userRes.data?.picture || null,
        };
      } catch (error) {
        console.warn("Failed to fetch MAL profile in backend:", error.message);
      }

      await setSetting(TOKEN_KEY, token);
      if (tokenRes.data?.refresh_token) {
        await setSetting(REFRESH_KEY, tokenRes.data.refresh_token);
      }
      const expiresIn = Number(tokenRes.data?.expires_in) || 0;
      await setSetting(EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
      await setSetting(USER_KEY, profile ? JSON.stringify(profile) : "");

      malSession = { clientId: null, codeVerifier: null };

      res.send(`<!DOCTYPE html>
      <html>
        <head>
          <title>MAL Connected - Re:List</title>
          <style>
            body { background: #0a0a0a; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .box { background: #141414; border: 1px solid #333; padding: 36px 48px; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h2 { color: #38bdf8; margin: 0 0 10px; font-size: 22px; }
            p { color: #888; font-size: 14px; margin: 0; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>🎉 MyAnimeList Connected!</h2>
            <p>You can close this tab and return to Re:List.</p>
            <script>setTimeout(() => { window.close(); }, 2000);</script>
          </div>
        </body>
      </html>`);
    } catch (err) {
      console.error("MAL token exchange failed:", err.response?.data || err.message);
      res.status(500).send("Failed to exchange authorization code for MAL token. Please try again.");
    }
  }

  // 2. Intercept callback routes BEFORE loading website files
  app.get("/auth/mal/callback", (req, res) => {
    handleMALTokenExchange(req.query.code, res);
  });

  app.get("/", (req, res, next) => {
    if (req.query && req.query.code) {
      return handleMALTokenExchange(req.query.code, res);
    }
    next();
  });

  // 3. Status check endpoint for frontend polling (never returns the token)
  app.get("/auth/mal/status", async (req, res) => {
    const [token, user] = await Promise.all([getSetting(TOKEN_KEY, null), readMALUser()]);
    res.json({ connected: Boolean(token), user });
  });

  // 4. One-Click Watchlist Sync: Pulls all anime from MAL into Re:List's SQLite database
  app.post("/auth/mal/sync-watchlist", async (req, res) => {
    const token = await getMALToken();
    if (!token) {
      return res.status(400).json({ success: false, error: "Not logged into MAL" });
    }

    try {
      const malRes = await axios.get(
        "https://api.myanimelist.net/v2/users/@me/animelist?limit=1000&fields=list_status",
        { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
      );

      const rawList = malRes.data?.data || [];
      const itemsToImport = [];

      rawList.forEach((entry) => {
        const node = entry.node;
        const statusObj = entry.list_status;
        if (!node || !node.id) return;

        let status = "planned";
        const s = statusObj?.status?.toLowerCase();
        if (s === "watching") status = "watching";
        else if (s === "completed") status = "completed";
        else if (s === "on_hold") status = "onhold";
        else if (s === "dropped") status = "dropped";
        else if (s === "plan_to_watch") status = "planned";

        itemsToImport.push({
          anime_id: node.id,
          title: node.title,
          image: node.main_picture?.large || node.main_picture?.medium || "",
          status,
        });
      });

      const db = await getDB();
      await db.run("BEGIN TRANSACTION");
      try {
        for (const item of itemsToImport) {
          await db.run(
            `INSERT OR REPLACE INTO watchlist (anime_id, title, image, status, updated_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [item.anime_id, item.title, item.image, item.status]
          );
        }
        await db.run("COMMIT");
      } catch (error) {
        await db.run("ROLLBACK");
        throw error;
      }

      res.json({ success: true, count: itemsToImport.length });
    } catch (err) {
      console.error("Failed to sync MAL watchlist:", err.message);
      res.status(500).json({ success: false, error: "Could not read the MAL watchlist" });
    }
  });

  // 5. Per-episode auto-sync: the browser asks us, we hold the token.
  app.post("/auth/mal/sync-episode", async (req, res) => {
    const malId = Number(req.body?.mal_id);
    const episode = Number(req.body?.episode);
    if (!Number.isInteger(malId) || malId <= 0 || !Number.isInteger(episode) || episode < 0) {
      return res.status(400).json({ success: false, error: "mal_id and episode are required" });
    }

    const token = await getMALToken();
    if (!token) {
      // 409 = never linked (or deliberately disconnected). Different from 401,
      // which means MAL rejected a token we do hold.
      return res
        .status(409)
        .json({ success: false, code: "MAL_NOT_CONNECTED", error: "MAL is not connected" });
    }

    const params = new URLSearchParams({
      status: req.body?.completed ? "completed" : "watching",
      num_watched_episodes: String(episode),
    });

    try {
      await axios.put(
        `https://api.myanimelist.net/v2/anime/${malId}/my_list_status`,
        params.toString(),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 15000,
        }
      );
      res.json({ success: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        // Token revoked or expired beyond refresh: drop it so the UI can ask
        // for a single, explicit reconnect instead of retrying per episode.
        await Promise.all([deleteSetting(TOKEN_KEY), deleteSetting(REFRESH_KEY), deleteSetting(EXPIRES_KEY)]);
        console.warn("MAL rejected the stored token; disconnected until the user reconnects.");
        return res
          .status(401)
          .json({ success: false, code: "MAL_UNAUTHORIZED", error: "MAL session expired" });
      }

      console.warn("MAL episode sync failed:", status || err.message);
      return res.status(502).json({ success: false, error: "MAL rejected the update" });
    }
  });

  app.post("/auth/mal/clear", async (req, res) => {
    await clearMALSession();
    res.json({ ok: true });
  });

  app.post("/auth/mal/disconnect", async (req, res) => {
    await clearMALSession();
    res.json({ ok: true });
  });

  // ========================================================
  // SERVE FRONTEND STATIC BUILD
  // ========================================================
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));

  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
  });

  app.use((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) {
        res.json({ status: "running" });
      }
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err.message || err);
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).json({
      success: false,
      error: status === 500 ? "Internal Server Error" : "Invalid request body",
    });
  });

  return app;
}

module.exports = createApp;
