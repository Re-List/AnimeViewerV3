const express = require("express");
const router = express.Router();
const getDB = require("../database/db");

// Allowed watchlist statuses
const VALID_STATUSES = [
    "watching",
    "completed",
    "planned",
    "onhold",
    "dropped"
];

// Normalize MAL / internal statuses
function normalizeStatus(status) {
    if (!status) return "planned";

    switch (status.toLowerCase()) {
        case "watching":
            return "watching";

        case "completed":
            return "completed";

        case "on_hold":
        case "onhold":
            return "onhold";

        case "plan_to_watch":
        case "planned":
            return "planned";

        case "dropped":
            return "dropped";

        default:
            return "planned";
    }
}

// Validate watchlist item
function validateWatchlistItem(item) {
    if (!item) {
        return "Missing request body";
    }

    if (!item.anime_id) {
        return "anime_id is required";
    }

    if (!item.title || typeof item.title !== "string") {
        return "title is required";
    }

    if (!item.status) {
        return "status is required";
    }

    const status = normalizeStatus(item.status);

    if (!VALID_STATUSES.includes(status)) {
        return `status must be one of: ${VALID_STATUSES.join(", ")}`;
    }

    return null;
}

// Add / Update watchlist item
router.post("/", async (req, res) => {
    try {
        const db = await getDB();

        const validationError =
            validateWatchlistItem(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }

        const {
            anime_id,
            title,
            image,
            status
        } = req.body;

        const normalizedStatus =
            normalizeStatus(status);

        const existing = await db.get(
            "SELECT anime_id FROM watchlist WHERE anime_id = ?",
            [anime_id]
        );

        if (existing) {
            await db.run(
                `
                UPDATE watchlist
                SET
                    status = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE anime_id = ?
                `,
                [normalizedStatus, anime_id]
            );
        } else {
            await db.run(
                `
                INSERT INTO watchlist
                (
                    anime_id,
                    title,
                    image,
                    status
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    anime_id,
                    title,
                    image || "",
                    normalizedStatus
                ]
            );
        }

        res.json({
            success: true
        });

    } catch (error) {
        console.error(
            "[WATCHLIST POST ERROR]",
            error
        );

        res.status(500).json({
            success: false,
            error: "Failed to save watchlist item"
        });
    }
});

// Bulk import
router.post("/bulk", async (req, res) => {
    try {
        const db = await getDB();

        const { items } = req.body;

        if (
            !items ||
            !Array.isArray(items)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid items array"
            });
        }

        await db.run("BEGIN TRANSACTION");

        for (const item of items) {
            const validationError =
                validateWatchlistItem(item);

            if (validationError) {
                throw new Error(
                    `Invalid item: ${validationError}`
                );
            }

            await db.run(
                `
                INSERT OR REPLACE INTO watchlist
                (
                    anime_id,
                    title,
                    image,
                    status,
                    updated_at
                )
                VALUES
                (
                    ?, ?, ?, ?,
                    CURRENT_TIMESTAMP
                )
                `,
                [
                    item.anime_id,
                    item.title,
                    item.image || "",
                    normalizeStatus(item.status)
                ]
            );
        }

        await db.run("COMMIT");

        res.json({
            success: true,
            imported: items.length
        });

    } catch (error) {
        try {
            const db = await getDB();
            await db.run("ROLLBACK");
        } catch {}

        console.error(
            "[WATCHLIST BULK ERROR]",
            error
        );

        res.status(500).json({
            success: false,
            error:
                error.message ||
                "Failed to process bulk import"
        });
    }
});

// Get all watchlist items
router.get("/all", async (req, res) => {
    try {
        const db = await getDB();

        const items = await db.all(`
            SELECT *
            FROM watchlist
            ORDER BY updated_at DESC
        `);

        res.json(items);

    } catch (error) {
        console.error(
            "[WATCHLIST GET ALL ERROR]",
            error
        );

        res.status(500).json({
            success: false,
            error: "Failed to load watchlist"
        });
    }
});

// Get by status
router.get("/:status", async (req, res) => {
    try {
        const db = await getDB();

        const status =
            normalizeStatus(req.params.status);

        const items = await db.all(
            `
            SELECT *
            FROM watchlist
            WHERE LOWER(status) = ?
            ORDER BY updated_at DESC
            `,
            [status]
        );

        res.json(items);

    } catch (error) {
        console.error(
            "[WATCHLIST STATUS ERROR]",
            error
        );

        res.status(500).json({
            success: false,
            error: "Failed to load watchlist"
        });
    }
});

// Delete watchlist item
router.delete("/:anime_id", async (req, res) => {
    try {
        const db = await getDB();

        await db.run(
            `
            DELETE FROM watchlist
            WHERE anime_id = ?
            `,
            [req.params.anime_id]
        );

        res.json({
            success: true
        });

    } catch (error) {
        console.error(
            "[WATCHLIST DELETE ERROR]",
            error
        );

        res.status(500).json({
            success: false,
            error: "Failed to delete item"
        });
    }
});

module.exports = router;