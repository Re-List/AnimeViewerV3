# Re:List v1.3.2 Release Notes

**Re:List v1.3.2** improves playback controls and server compatibility, and refreshes the in-app "What's New" notes for this update.

> **What's New popup:** the in-app release notes are shown once per app version (keyed to the installed version) and won't appear again after you dismiss them, until a newer update is installed.

---

### ▶️ Player & Servers

* **Next episode with `>` after playback ends**: when the embedded player finishes an episode, pressing the `>` (ArrowRight) key now advances to the next episode instead of replaying the end of the current one. Normal mid-episode `>` seeking is unchanged (the app only takes over once the video has actually ended).
* **All servers in Settings**: the *Default Video Source* picker now shows every available host — MegaPlay, Megavid, Anixo, VidHawk, Flixera, TryEmbed, CineXtream, AniEmbed, NontonGo, Ani.pm — instead of only the first four. The Settings picker and the player now share a single source list so they can't drift.
* **Embeds that refused to frame now load**: hosts that returned `X-Frame-Options` / CSP `frame-ancestors` (causing `ERR_BLOCKED_BY_RESPONSE` inside the player, e.g. Flixera and NontonGo) are unblocked for the known embed hosts in the app's player window.

### ⭐ Sync & Downloads

* **MyAnimeList sync through the backend**: tokens are no longer stored in the browser. Accounts migrated from the old browser-stored token must reconnect once (MAL banner or Settings → MyAnimeList Sync). A rejected session pauses auto-sync with a single notification instead of failing on every episode; users who never connected MAL are unaffected.
* **Downloads**: real progress/stage reporting where available, and host fallback when a source only serves an embedded player page. (Many embed-only hosts still cannot provide a downloadable stream; those cases are reported explicitly.)

### 🐛 Fixes & Polish

* Toggling the 18+ filter no longer blanks the app, and adult genres show a hidden-content notice with a one-click reveal instead of an empty page.
* Genre pages report provider errors with a *Try again* button instead of showing "No titles found"; the in-memory page cache is bounded.
* Switching player servers no longer reloads the episode or restarts the download poll, and watchlist buttons stay in sync across every card on screen.
* History can be cleared in one go, the genre browser starts collapsed, light-theme contrast is improved, and the initial bundle is smaller thanks to per-route loading.

---

# Re:List v1.3.1 Release Notes

**Re:List v1.3.1** is a stability release for the genre browser and MyAnimeList sync.

> **Upgrade note:** MyAnimeList sync now runs through the backend instead of storing your access token in the app. **You need to reconnect MAL once after updating** — use the *Reconnect MAL* button on the banner shown at the top of the app (or Settings → MyAnimeList Sync → *Reconnect now*). Your watchlist, history and downloads are not affected.

---

### 🐛 Bug Fixes

* **Fixed a crash that blanked the app when the 18+ filter changed**: `AnimeCard` returned early before all of its hooks ran, unmounting the whole React tree whenever the setting was toggled while adult titles were on screen.
* **Adult genres no longer render an empty page**: with the 18+ filter off, `#/genre/Hentai` (and other adult genres) now explains that the titles are hidden and offers a one-click *Show 18+ content* button, and the "titles loaded" counter counts what is actually visible.
* **Genre pages report failures instead of showing "No titles found"**: provider errors now display a message with a *Try again* button, and the in-memory page cache is bounded (60 entries, 10 minute expiry) instead of growing for the whole session.
* **Switching player servers no longer reloads the episode**: the details fetch, download poll and history write are keyed on the anime only, the loading spinner is derived from the iframe URL, and hotkeys are registered after their handlers exist.
* **Watchlist buttons stay in sync**: one shared watchlist index replaces the per-card 5 second cache, so adding or removing a title updates every card on screen immediately (and a failed request rolls back).

### ♿ Theme & Accessibility

* Genre links and filter pills now use theme-aware tokens with verified contrast on the light themes (previously 1.6–2.7:1 on Sakura Day, now 4.6–6.6:1).
* The genre browser starts collapsed, hides adult genres when the 18+ filter is off, and has a visible keyboard focus ring.
* `prefers-reduced-motion` is respected for spinners and transitions.

### 🔐 MyAnimeList & Security

* **MAL tokens live on the backend**: the OAuth exchange, refresh and every MAL API call happen server-side, in a new SQLite `settings` table. The browser no longer stores or uses an access token, and `/auth/mal/status` only returns `{ connected, user }`.
* **Reconnect is visible everywhere, not just in Settings**: a dismissed-able banner appears at the top of every screen for accounts migrated from the old browser-stored token, and for any rejected session (HTTP 401). It offers *Reconnect MAL* directly, and the older token is detected and cleared at startup. A rejected session pauses auto-sync with a single notification instead of failing on every episode; users who never connected MAL (HTTP 409) see nothing.
* Writes from foreign origins are rejected, CORS is allow-listed (with same-origin/reverse-proxy support via `CORS_ORIGINS`), and unknown API paths return JSON 404 instead of the app shell.
* `backend/database.sqlite` and `_legacy_unused/anime.db` are no longer tracked in git — they contained real watchlist history.

### 🧰 Maintenance

* ESLint is clean (was 35 errors) and the build code-splits per route (initial bundle 437 kB → 278 kB).
* The app version is read from `package.json`, pages load lazily, and the backend app is a testable factory with `node --test` coverage and a GitHub Actions CI workflow.
* The frontend resolves the API origin automatically when it is served by the backend instead of hard-coding `http://localhost:5000`.

---

# Re:List v1.2.2 Release Notes

We are thrilled to release **Re:List v1.2.2**, introducing major UI refinements, robust watchlist management tools, accurate airing episode calculations, and streamlined offline storage workflows.

---

### 🚀 Major Improvements & New Features

* **Manual Item Removal ('X' Delete Buttons)**: 
  * Added direct delete `'X'` buttons to all watchlist category grids (*Watching*, *Completed*, *On-Hold*, *Dropped*, *Plan to Watch*), as well as the *History* and *All Anime* tabs.
* **Precise Airing Episode Counts**: 
  * Updated metadata synchronization logic to dynamically calculate currently released episodes for airing shows (e.g., correctly showing current released counts instead of total planned season counts).
* **Grouped Downloads & Multi-Select Bulk Deletion**: 
  * Downloaded episodes are now automatically organized into collapsible accordion series groups. 
  * Added checkboxes supporting multi-select and bulk deletion for offline storage management.
* **Offline Download Disclaimer**: 
  * Added an informative notice banner inside the Downloads tab regarding ongoing HLS stream capture enhancements.
* **In-App Toast Notifications**: 
  * Replaced intrusive native OS/browser alert prompts with custom, theme-matching in-app notification toasts across player and details views.
* **Search Poster Rendering Fix**: 
  * Resolved image path fallbacks in `AnimeCard` and `Search` views so artwork loads reliably across all results.

---

### 🐛 Minor Bug Fixes

* Fixed route matching for watchlist collections and categories.
* Fixed missing prop callbacks (`onDelete`) in `AnimeCard` when rendered inside history and all-anime grids.
* Optimized database transaction handling for MyAnimeList (MAL) watchlist sync.