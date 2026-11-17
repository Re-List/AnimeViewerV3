// backend/server.js
const createApp = require("./lib/createApp");
const getDB = require("./database/db");

const PORT = process.env.PORT || 5000;
const app = createApp();

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
