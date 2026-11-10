// backend/database/db.js
const path = require("path");
const fs = require("fs");
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

        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anime_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            episode INTEGER NOT NULL,
            image TEXT,
            file_path TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            status TEXT DEFAULT 'downloading',
            progress INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const cols = await db.all("PRAGMA table_info(history)");
    if (!cols.some((c) => c.name === "hidden")) {
        await db.exec("ALTER TABLE history ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0");
    }
}

function getDB() {
    if (!dbPromise) {
        dbPromise = (async () => {
            const dataDir = process.env.APPDATA 
                ? path.join(process.env.APPDATA, "AnimeViewer")
                : path.resolve(__dirname, "..");

            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            const dbFilePath = path.join(dataDir, "database.sqlite");
            const db = await open({
                filename: dbFilePath,
                driver: sqlite3.Database
            });

            await db.exec(`
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;
                PRAGMA busy_timeout=5000;
            `);

            await initSchema(db);
            await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

            return db;
        })().catch((err) => {
            dbPromise = null;
            throw err;
        });
    }
    return dbPromise;
}

async function closeDB() {
    if (!dbPromise) return;
    try {
        const db = await dbPromise;
        await db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
        await db.close();
    } catch (error) {
        console.error("Error while closing database:", error);
    } finally {
        dbPromise = null;
    }
}

module.exports = getDB;
module.exports.closeDB = closeDB;