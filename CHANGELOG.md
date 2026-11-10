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