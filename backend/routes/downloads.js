// backend/routes/downloads.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const getDB = require("../database/db");

const router = express.Router();

function getDownloadsDir() {
  const isWin = process.platform === "win32";
  const base = isWin
    ? process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming")
    : process.env.HOME || "";
  const dir = path.join(base, "AnimeViewer", "downloads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const activeDownloads = new Map();

router.get("/list", async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT * FROM downloads ORDER BY created_at DESC");
    
    const list = rows.map((r) => {
      if (activeDownloads.has(r.id)) {
        return { ...r, ...activeDownloads.get(r.id) };
      }
      return r;
    });

    res.json({ success: true, downloads: list });
  } catch (err) {
    console.error("Failed to list downloads:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/start", async (req, res) => {
  const { anime_id, title, episode, image, streamUrl } = req.body;
  if (!anime_id || !streamUrl) {
    return res.status(400).json({ success: false, error: "Missing anime_id or streamUrl" });
  }

  try {
    const db = await getDB();
    const cleanTitle = (title || "Anime").replace(/[/\\?%*:|"<>]/g, "_");
    const fileName = `${anime_id}_ep${episode}_${Date.now()}.mp4`;
    const filePath = path.join(getDownloadsDir(), fileName);

    const result = await db.run(
      `INSERT INTO downloads (anime_id, title, episode, image, file_path, status, progress)
       VALUES (?, ?, ?, ?, ?, 'downloading', 1)`,
      [anime_id, cleanTitle, episode || 1, image || "", filePath]
    );

    const downloadId = result.lastID;
    activeDownloads.set(downloadId, { status: "downloading", progress: 1 });

    res.json({ success: true, downloadId });

    // Background real stream downloading with progressive chunk tracking
    (async () => {
      try {
        const writer = fs.createWriteStream(filePath);
        
        // Resolve domain base for headers
        const parsedUrl = new URL(streamUrl);
        const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;

        const response = await axios({
          method: "GET",
          url: streamUrl,
          responseType: "stream",
          timeout: 120000,
          maxRedirects: 5,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Referer: `${origin}/`,
            Origin: origin,
            Accept: "*/*",
          },
        });

        // Determine expected file size (fallback to 150MB if content-length is missing)
        const totalLength = parseInt(response.headers["content-length"], 10) || 1024 * 1024 * 150;
        let downloadedBytes = 0;

        response.data.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          const pct = Math.min(99, Math.max(1, Math.round((downloadedBytes / totalLength) * 100)));
          if (activeDownloads.has(downloadId)) {
            activeDownloads.set(downloadId, { status: "downloading", progress: pct });
          }
        });

        response.data.pipe(writer);

        writer.on("finish", async () => {
          activeDownloads.delete(downloadId);
          const fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : downloadedBytes;
          await db.run(
            `UPDATE downloads SET status = 'completed', progress = 100, file_size = ? WHERE id = ?`,
            [fileSize, downloadId]
          );
        });

        writer.on("error", async (err) => {
          activeDownloads.delete(downloadId);
          console.error("Download writer error:", err);
          await db.run(`UPDATE downloads SET status = 'error' WHERE id = ?`, [downloadId]);
        });
      } catch (streamErr) {
        activeDownloads.delete(downloadId);
        console.error("Download stream connection error:", streamErr.message);
        await db.run(`UPDATE downloads SET status = 'error' WHERE id = ?`, [downloadId]);
      }
    })();
  } catch (err) {
    console.error("Failed to start download:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/stream/:id", async (req, res) => {
  try {
    const db = await getDB();
    const row = await db.get("SELECT * FROM downloads WHERE id = ?", [req.params.id]);
    if (!row || !fs.existsSync(row.file_path)) {
      return res.status(404).send("Local video file not found.");
    }

    const filePath = row.file_path;
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "video/mp4",
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.status(500).send("Failed to stream local video.");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const db = await getDB();
    const row = await db.get("SELECT * FROM downloads WHERE id = ?", [req.params.id]);
    if (row && fs.existsSync(row.file_path)) {
      try { fs.unlinkSync(row.file_path); } catch (e) {}
    }
    await db.run("DELETE FROM downloads WHERE id = ?", [req.params.id]);
    activeDownloads.delete(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;