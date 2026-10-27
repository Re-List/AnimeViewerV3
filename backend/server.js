const express = require("express");
const cors = require("cors");

const getDB = require("./database/db");
const favoritesRoute = require("./routes/Favorites");
const historyRoute = require("./routes/history");

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" })); // MAL imports can be large

app.use("/favorites", favoritesRoute);
app.use("/history", historyRoute);

app.get("/", (req, res) => {
    res.json({ status: "running" });
});

app.use((req, res) => {
    res.status(404).json({ success: false, error: "Not found" });
});

app.use((err, req, res, next) => {
    console.error(err);

    // body-parser errors (bad JSON, payload too large) carry a 4xx status
    const status =
        err.status >= 400 && err.status < 500 ? err.status : 500;

    res.status(status).json({
        success: false,
        error:
            status === 500
                ? "Internal Server Error"
                : "Invalid request body"
    });
});

// Open the database up-front so schema problems show immediately.
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
        process.on("SIGHUP", () => shutdown("SIGHUP")); // console window closed (Windows)
    })
    .catch((err) => {
        console.error("Failed to open the database:", err);
        process.exit(1);
    });
