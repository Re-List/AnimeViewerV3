// backend/test/app.test.js
// Run with: npm test  (node --test)
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");

// Point the database at a throwaway directory before the app is required.
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "relist-test-"));
process.env.APPDATA = tempRoot;
process.env.CORS_ORIGINS = "http://localhost:5173";

const createApp = require("../lib/createApp");
const getDB = require("../database/db");

let server;
let baseUrl;

test.before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await getDB.closeDB();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("GET /favorites/all starts empty", async () => {
  const res = await fetch(`${baseUrl}/favorites/all`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 0);
});

test("same-origin writes are accepted", async () => {
  const res = await fetch(`${baseUrl}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5000" },
    body: JSON.stringify({ anime_id: 21, title: "One Piece", image: "", status: "watching" }),
  });
  assert.equal(res.status, 200);

  const list = await (await fetch(`${baseUrl}/favorites/all`)).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].anime_id, 21);
});

test("writes from a foreign origin are rejected", async () => {
  const res = await fetch(`${baseUrl}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({ anime_id: 404, title: "Nope", status: "watching" }),
  });
  assert.equal(res.status, 403);

  const list = await (await fetch(`${baseUrl}/favorites/all`)).json();
  assert.equal(list.length, 1);
});

test("same-origin requests behind a reverse proxy are accepted", async () => {
  const res = await fetch(`${baseUrl}/favorites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://preview.local",
      "X-Forwarded-Host": "preview.local",
    },
    body: JSON.stringify({ anime_id: 7, title: "Proxy test", status: "watching" }),
  });
  assert.equal(res.status, 200);
});

test("unknown API paths answer JSON 404 instead of the SPA", async () => {
  const res = await fetch(`${baseUrl}/api/does-not-exist`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") || "", /application\/json/);
});

test("MAL status never exposes the access token", async () => {
  const res = await fetch(`${baseUrl}/auth/mal/status`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ["connected", "user"]);
  assert.equal(body.connected, false);
});

test("MAL episode sync validates input", async () => {
  const res = await fetch(`${baseUrl}/auth/mal/sync-episode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5000" },
    body: JSON.stringify({ mal_id: "abc", episode: 1 }),
  });
  assert.equal(res.status, 400);
});

test("MAL episode sync reports 'not connected' separately from a rejected token", async () => {
  const res = await fetch(`${baseUrl}/auth/mal/sync-episode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5000" },
    body: JSON.stringify({ mal_id: 21, episode: 3 }),
  });
  // 409 (never linked) must not be confused with 401 (token rejected),
  // otherwise the UI would nag every user who never used MAL.
  assert.equal(res.status, 409);
  assert.equal((await res.json()).code, "MAL_NOT_CONNECTED");
});
