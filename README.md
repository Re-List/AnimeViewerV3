# Re:List (Anime Viewer) - fixed build

## Run it
Double-click **start.bat** (starts the backend on :5000 and the site on :5173, then opens the browser).
Needs Node.js 20.19+ or 22+. `node_modules` is included; if you move this to another
computer/OS, delete both `node_modules` folders and run `npm install` in `backend` and `frontend`.

## What was fixed
**History / Continue Watching**
- Added the missing backend routes (`/history/continue`, `/history/latest/:id`, `/history/hide/:id`, `/history/hide-all`).
- The Player now actually saves your episode, and the payload matches what the server expects. Resume + Continue Watching work.
- "Hide" now hides from Continue Watching only (History is kept). Shows marked *Completed* no longer appear in Continue Watching.
- Database migrates itself (adds a `hidden` column); your existing data is untouched.

**Player**
- Source button works (it was being overwritten by a stale timer). Your source/theater choice is remembered.
- Resume URL fixed (`?t=`), and no resume if you had basically finished the episode.
- The video no longer reloads itself during the last seconds of an episode.
- Auto-next now shows a "Next episode in Ns - Cancel" banner.
- Unreachable error screen replaced by a "Video not loading? Try next source" hint.
- Episode count for airing shows is taken from AniList (no more 1200-episode grid).

**App**
- Search is back: box in the top bar with live suggestions, Enter opens a full results page. Debounced, no stale results.
- "Trending Now" is a real trending list; Top Rated is its own row.
- Watch List: tab highlight fixed, counts from a single request, error message when the backend is down.
- Synopsis text decodes `&quot;` / `&amp;` properly; type badges (TV / Movie / OVA) now show.
- `HistoryService.js` renamed to `historyService.js` so imports work on Linux/macOS too.
- Backend address is in one place (`frontend/src/config.js`, override with `VITE_API_URL`).
- Clean shutdown merges the database WAL file into `database.sqlite`, so that single file always holds everything.
- Removed junk: stray `{` file, dead Favorites/History pages. The unused `anime.db` moved to `_legacy_unused/`.
- ESLint: 0 errors (was 9).

## Good to know
- Only the **MegaPlay** URL pattern is known to fit the `/mal/{id}/{episode}/{sub|dub}` scheme. The other three
  sources in `frontend/src/pages/Player.jsx` (`EMBED_SOURCES`) are untested - edit or remove them there.
- If you kept using the old version after sending me the zip, copy your newest `backend/database.sqlite`
  (and any `-wal` / `-shm` files next to it) over the one here *before* first start.
