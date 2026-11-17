// backend/routes/downloads.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const getDB = require("../database/db");
const { downloadEpisode, DownloadError, MIN_EPISODE_BYTES } = require("../lib/downloader");

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

// Live progress for in-flight downloads, merged into /list responses.
const activeDownloads = new Map();

router.get("/list", async (req, res) => {
  try {
    const db = await getDB();
    const rows = await db.all("SELECT * FROM downloads ORDER BY created_at DESC");

    // A download row can outlive the job that owned it (app closed, backend
    // restarted). Those used to sit at "Downloading 0%" forever, so close them
    // out. The 2 minute grace period avoids racing a download that just started.
    const orphans = rows.filter(
      (row) => row.status === "downloading" && !activeDownloads.has(row.id)
    );
    for (const row of orphans) {
      const created = Date.parse(`${String(row.created_at).replace(" ", "T")}Z`);
      if (!Number.isFinite(created) || Date.now() - created < 2 * 60 * 1000) continue;
      const message = "Interrupted — the app was closed before it finished. Download it again.";
      await db
        .run("UPDATE downloads SET status = 'error', progress = 0, error = ? WHERE id = ?", [
          message,
          row.id,
        ])
        .catch(() => {});
      row.status = "error";
      row.progress = 0;
      row.error = message;
    }

    const list = rows.map((row) => {
      const live = activeDownloads.get(row.id);
      if (!live) return row;
      return { ...row, ...live };
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
    const episodeNumber = Number(episode) || 1;

    // One record per episode: never queue the same episode twice.
    const existing = await db.get(
      "SELECT * FROM downloads WHERE anime_id = ? AND episode = ?",
      [anime_id, episodeNumber]
    );
    if (existing) {
      if (existing.status === "downloading" && activeDownloads.has(existing.id)) {
        return res.json({ success: true, downloadId: existing.id, existing: true });
      }
      if (
        existing.status === "completed" &&
        fs.existsSync(existing.file_path) &&
        fs.statSync(existing.file_path).size >= MIN_EPISODE_BYTES
      ) {
        return res.json({ success: true, downloadId: existing.id, existing: true });
      }
    }

    // A previous attempt (or an earlier version of the app) may have left a
    // bogus "completed" stub behind; clear it before re-downloading.
    if (existing && existing.file_path && fs.existsSync(existing.file_path)) {
      try {
        fs.unlinkSync(existing.file_path);
      } catch {
        // ignore cleanup failures
      }
    }

    const cleanTitle = (title || "Anime").replace(/[/\\?%*:|"<>]/g, "_");
    const fileName = `${anime_id}_ep${episodeNumber}_${Date.now()}.mp4`;
    const filePath = path.join(getDownloadsDir(), fileName);

    let downloadId;
    if (existing) {
      await db.run(
        `UPDATE downloads
         SET title = ?, image = ?, file_path = ?, status = 'downloading', progress = 0, file_size = 0, error = NULL
         WHERE id = ?`,
        [cleanTitle, image || "", filePath, existing.id]
      );
      downloadId = existing.id;
    } else {
      const result = await db.run(
        `INSERT INTO downloads (anime_id, title, episode, image, file_path, status, progress)
         VALUES (?, ?, ?, ?, ?, 'downloading', 0)`,
        [anime_id, cleanTitle, episodeNumber, image || "", filePath]
      );
      downloadId = result.lastID;
    }

    activeDownloads.set(downloadId, {
      status: "downloading",
      progress: 0,
      progressKnown: false,
      stage: "resolving",
      received: 0,
      total: 0,
    });

    res.json({ success: true, downloadId });

    // Background job: resolve the real stream, then write it to disk.
    (async () => {
      let lastSnapshot = "";
      let lastSavedPercent = -1;
      const onProgress = (update) => {
        const stage = update.stage || "downloading";
        const percent =
          typeof update.percent === "number"
            ? Math.max(0, Math.min(99, Math.round(update.percent)))
            : null;
        const received = update.received || 0;
        const total = update.total || 0;

        // Progress only becomes a real percentage once we know (or can estimate)
        // the size. Until then the UI shows an indeterminate bar plus bytes.
        const snapshot = `${stage}|${percent}|${received}|${total}`;
        if (snapshot === lastSnapshot) return;
        lastSnapshot = snapshot;

        activeDownloads.set(downloadId, {
          status: "downloading",
          progress: percent ?? 0,
          progressKnown: percent !== null,
          stage,
          received,
          total,
        });

        if (percent !== null && percent !== lastSavedPercent) {
          lastSavedPercent = percent;
          db.run("UPDATE downloads SET progress = ? WHERE id = ?", [percent, downloadId]).catch(
            (error) => console.warn("[DOWNLOAD] progress update failed:", error.message)
          );
        }
      };

      try {
        // Pass the ids this request already knows: hosts that key episodes off
        // the AniList id (tryembed, cinextream, aniembed, nontongo) give the
        // downloader no MAL id to fall back with otherwise.
        const result = await downloadEpisode(streamUrl, filePath, onProgress, {
          animeId: anime_id,
          episode: episodeNumber,
        });
        activeDownloads.delete(downloadId);
        await db.run(
          `UPDATE downloads
           SET status = 'completed', progress = 100, file_size = ?, file_path = ?, error = NULL
           WHERE id = ?`,
          [result.bytes, result.filePath, downloadId]
        );
        console.log(
          `[DOWNLOAD] completed #${downloadId} -> ${result.filePath} (${result.bytes} bytes, ${result.container || "?"}) from ${result.url || streamUrl}`
        );
      } catch (error) {
        activeDownloads.delete(downloadId);
        const message =
          error instanceof DownloadError ? error.message : `Download failed: ${error.message}`;
        console.error(`[DOWNLOAD] failed #${downloadId}: ${message}`);
        // Do not leave half-written files behind for a failed download.
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            // ignore cleanup failures
          }
        }
        const partialTs = filePath.replace(/\.mp4$/i, ".ts");
        if (partialTs !== filePath && fs.existsSync(partialTs)) {
          try {
            fs.unlinkSync(partialTs);
          } catch {
            // ignore cleanup failures
          }
        }
        await db
          .run(`UPDATE downloads SET status = 'error', progress = 0, error = ? WHERE id = ?`, [
            message,
            downloadId,
          ])
          .catch((dbError) => console.warn("[DOWNLOAD] error state save failed:", dbError.message));
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
    const contentType = /\.ts$/i.test(filePath) ? "video/mp2t" : "video/mp4";

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
        "Content-Type": contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.status(500).send("Failed to stream local video.");
  }
});

// Opens a downloaded file in the user's default video player. HLS downloads are
// stored as MPEG-TS, which Chromium cannot play inside the app, so those need
// an external player instead of the in-app <video> element.
router.post("/open/:id", async (req, res) => {
  try {
    const db = await getDB();
    const row = await db.get("SELECT * FROM downloads WHERE id = ?", [req.params.id]);
    if (!row || !row.file_path || !fs.existsSync(row.file_path)) {
      return res.status(404).json({ success: false, error: "Local video file not found." });
    }

    const opener =
      process.platform === "win32"
        ? { command: "explorer.exe", args: [row.file_path] }
        : process.platform === "darwin"
          ? { command: "open", args: [row.file_path] }
          : { command: "xdg-open", args: [row.file_path] };

    spawn(opener.command, opener.args, { detached: true, stdio: "ignore" }).unref();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const db = await getDB();
    const row = await db.get("SELECT * FROM downloads WHERE id = ?", [req.params.id]);
    if (row && row.file_path && fs.existsSync(row.file_path)) {
      try {
        fs.unlinkSync(row.file_path);
      } catch {
        // ignore cleanup failures
      }
    }
    await db.run("DELETE FROM downloads WHERE id = ?", [req.params.id]);
    activeDownloads.delete(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
