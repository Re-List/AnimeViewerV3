// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

const getDB = require("./database/db");
const favoritesRoute = require("./routes/Favorites");
const historyRoute = require("./routes/history");

const PORT = process.env.PORT || 5000;
const app = express();

// ========================================================
// MASTER MAL CLIENT ID (Paste your ID here)
// ========================================================
const MASTER_MAL_CLIENT_ID = "956acf7dab4c48da35604da2c88e151a";

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// API routes
app.use("/favorites", favoritesRoute);
app.use("/history", historyRoute);

// ========================================================
// MYANIMELIST (MAL) OAUTH & WATCHLIST SYNC
// ========================================================
let malSession = {
  clientId: null,
  codeVerifier: null,
  latestToken: null,
  latestUser: null,
};

// 1. Initiate MAL Login
app.get("/auth/mal/login", (req, res) => {
  const clientId = req.query.client_id || MASTER_MAL_CLIENT_ID;
  if (!clientId || clientId === "YOUR_MAL_CLIENT_ID_HERE") {
    return res.status(400).send("Master MAL Client ID is not configured in backend/server.js");
  }

  const codeVerifier = crypto.randomBytes(64).toString("hex");
  malSession = { clientId, codeVerifier, latestToken: null, latestUser: null };

  const redirectUri = "http://localhost:5000";
  const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${clientId}&code_challenge=${codeVerifier}&code_challenge_method=plain&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(authUrl);
});

// Helper: Token Exchange + Profile Fetch (in Node, avoiding CORS)
async function handleMALTokenExchange(code, res) {
  if (!malSession.clientId || !malSession.codeVerifier) {
    return res.status(400).send("Expired or invalid login session. Please return to Re:List and click Authorize again.");
  }

  try {
    const params = new URLSearchParams({
      client_id: malSession.clientId,
      code,
      code_verifier: malSession.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: "http://localhost:5000",
    });

    const tokenRes = await axios.post("https://myanimelist.net/v1/oauth2/token", params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });

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
    } catch (e) {
      console.warn("Failed to fetch MAL profile in backend:", e.message);
    }

    malSession.latestToken = token;
    malSession.latestUser = profile;

    res.send(`
      <!DOCTYPE html>
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
            <script>
              setTimeout(() => { window.close(); }, 2000);
            </script>
          </div>
        </body>
      </html>
    `);
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

// 3. Status check endpoint for frontend polling
app.get("/auth/mal/status", (req, res) => {
  res.json({
    token: malSession.latestToken || null,
    user: malSession.latestUser || null,
  });
});

// 4. One-Click Watchlist Sync: Pulls all anime from MAL into Re:List's SQLite database
app.post("/auth/mal/sync-watchlist", async (req, res) => {
  const token = req.body?.token || malSession.latestToken;
  if (!token) {
    return res.status(400).json({ success: false, error: "Not logged into MAL" });
  }

  try {
    const malRes = await axios.get("https://api.myanimelist.net/v2/users/@me/animelist?limit=1000&fields=list_status", {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 20000,
    });

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

    // Bulk save to local SQLite
    const db = await getDB();
    await db.run("BEGIN TRANSACTION");
    for (const item of itemsToImport) {
      await db.run(
        `INSERT OR REPLACE INTO watchlist (anime_id, title, image, status, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [item.anime_id, item.title, item.image, item.status]
      );
    }
    await db.run("COMMIT");

    res.json({ success: true, count: itemsToImport.length });
  } catch (err) {
    console.error("Failed to sync MAL watchlist:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/auth/mal/clear", (req, res) => {
  malSession = { clientId: null, codeVerifier: null, latestToken: null, latestUser: null };
  res.json({ ok: true });
});

// ========================================================
// SERVE FRONTEND STATIC BUILD
// ========================================================
const frontendDist = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendDist));

app.use((req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) {
      res.json({ status: "running" });
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? "Internal Server Error" : "Invalid request body",
  });
});

getDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });

    let shuttingDown = false;
    async function shutdown(signal) {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`\n${signal} received - saving database and exiting...`);
      server.close();
      await getDB.closeDB();
      process.exit(0);
    }

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGHUP", () => shutdown("SIGHUP"));
  })
  .catch((err) => {
    console.error("Failed to open database:", err);
    process.exit(1);
  });