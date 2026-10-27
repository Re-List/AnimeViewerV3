const express = require("express");
const router = express.Router();
const getDB = require("../database/db");

function isValidId(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
}

function validateHistoryPayload(body) {
    if (!body?.anime) return "Anime is required";
    if (!isValidId(body.anime.mal_id)) return "Anime ID is required";
    if (!body.anime.title) return "Anime title is required";
    if (
        body.episode === undefined ||
        !Number.isInteger(Number(body.episode)) ||
        Number(body.episode) < 1
    ) {
        return "Episode must be a valid number";
    }
    return null;
}

function fail(res, label, message, error) {
    console.error(`[${label}]`, error);
    res.status(500).json({ success: false, error: message });
}

// POST /history - save / update progress (also un-hides the entry)
router.post("/", async (req, res) => {
    try {
        const validationError = validateHistoryPayload(req.body);
        if (validationError) {
            return res
                .status(400)
                .json({ success: false, error: validationError });
        }

        const db = await getDB();
        const { anime, episode } = req.body;

        await db.run(
            `
            INSERT INTO history (anime_id, title, image, episode, watched_at, hidden)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 0)
            ON CONFLICT(anime_id) DO UPDATE SET
                episode    = excluded.episode,
                watched_at = CURRENT_TIMESTAMP,
                title      = excluded.title,
                image      = excluded.image,
                hidden     = 0
            `,
            [
                Number(anime.mal_id),
                anime.title,
                anime.images?.jpg?.image_url || "",
                Number(episode)
            ]
        );

        res.json({ success: true });
    } catch (error) {
        fail(res, "HISTORY POST", "Failed to save history", error);
    }
});

// GET /history - everything ever watched (hidden entries included)
router.get("/", async (req, res) => {
    try {
        const db = await getDB();
        const items = await db.all(
            "SELECT * FROM history ORDER BY watched_at DESC"
        );
        res.json(items);
    } catch (error) {
        fail(res, "HISTORY GET", "Failed to load history", error);
    }
});

// GET /history/continue - recent, not hidden, not already marked Completed
router.get("/continue", async (req, res) => {
    try {
        const db = await getDB();
        const items = await db.all(`
            SELECT h.*
            FROM history h
            LEFT JOIN watchlist w ON w.anime_id = h.anime_id
            WHERE h.hidden = 0
              AND COALESCE(w.status, '') != 'completed'
            ORDER BY h.watched_at DESC
            LIMIT 30
        `);
        res.json(items);
    } catch (error) {
        fail(res, "HISTORY CONTINUE", "Failed to load continue watching", error);
    }
});

// GET /history/latest/:anime_id - last episode opened for one anime
router.get("/latest/:anime_id", async (req, res) => {
    try {
        if (!isValidId(req.params.anime_id)) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid anime id" });
        }
        const db = await getDB();
        const row = await db.get(
            "SELECT episode FROM history WHERE anime_id = ?",
            [Number(req.params.anime_id)]
        );
        res.json({ episode: row ? row.episode : null });
    } catch (error) {
        fail(res, "HISTORY LATEST", "Failed to get latest episode", error);
    }
});

// POST /history/hide-all - hide every entry from Continue Watching
router.post("/hide-all", async (req, res) => {
    try {
        const db = await getDB();
        await db.run("UPDATE history SET hidden = 1");
        res.json({ success: true });
    } catch (error) {
        fail(res, "HISTORY HIDE ALL", "Failed to hide entries", error);
    }
});

// POST /history/hide/:anime_id - hide from Continue Watching, keep in history
router.post("/hide/:anime_id", async (req, res) => {
    try {
        if (!isValidId(req.params.anime_id)) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid anime id" });
        }
        const db = await getDB();
        await db.run("UPDATE history SET hidden = 1 WHERE anime_id = ?", [
            Number(req.params.anime_id)
        ]);
        res.json({ success: true });
    } catch (error) {
        fail(res, "HISTORY HIDE", "Failed to hide entry", error);
    }
});

// DELETE /history/:anime_id - remove completely
router.delete("/:anime_id", async (req, res) => {
    try {
        if (!isValidId(req.params.anime_id)) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid anime id" });
        }
        const db = await getDB();
        await db.run("DELETE FROM history WHERE anime_id = ?", [
            Number(req.params.anime_id)
        ]);
        res.json({ success: true });
    } catch (error) {
        fail(res, "HISTORY DELETE", "Failed to delete history", error);
    }
});

module.exports = router;
