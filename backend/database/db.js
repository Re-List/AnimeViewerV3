const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");

let dbPromise = null;

async function initSchema(db) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS watchlist (
            anime_id INTEGER PRIMARY KEY,
            title TEXT,
            image TEXT,
            status TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS history (
            anime_id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            image TEXT,
            episode INTEGER DEFAULT 1,
            watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            hidden INTEGER NOT NULL DEFAULT 0
        );
    `);

    // Migration: databases created by older versions have no "hidden" column.
    const cols = await db.all("PRAGMA table_info(history)");
    if (!cols.some((c) => c.name === "hidden")) {
        await db.exec(
            "ALTER TABLE history ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0"
        );
    }
}

// The promise (not the instance) is cached, so two requests arriving at the
// same time can never open the database twice.
function getDB() {
    if (!dbPromise) {
        dbPromise = (async () => {
            const db = await open({
                filename: path.resolve(__dirname, "../database.sqlite"),
                driver: sqlite3.Database
            });

            await db.exec(`
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;
                PRAGMA busy_timeout=5000;
            `);

            await initSchema(db);

            // Fold any leftover -wal data back into database.sqlite.
            await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

            return db;
        })().catch((err) => {
            dbPromise = null; // allow a retry on the next request
            throw err;
        });
    }
    return dbPromise;
}

// Called on shutdown: merges the WAL into the main file so that
// database.sqlite on its own always holds all of your data.
async function closeDB() {
    if (!dbPromise) return;
    try {
        const db = await dbPromise;
        await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        await db.close();
    } catch (err) {
        console.error("Error while closing database:", err);
    } finally {
        dbPromise = null;
    }
}

module.exports = getDB;
module.exports.closeDB = closeDB;
