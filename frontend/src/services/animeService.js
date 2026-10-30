// frontend/src/services/animeService.js
import axios from "axios";

const CACHE_TTL = 1000 * 60 * 60;
const ANILIST = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  idMal
  title { romaji english native }
  coverImage { extraLarge large }
  bannerImage
  episodes
  nextAiringEpisode { episode }
  description
  averageScore
  status
  startDate { year month day }
  endDate { year month day }
  genres
  format
  season
  seasonYear
`;

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + CACHE_TTL }));
  } catch {
    // storage full or unavailable - caching is optional
  }
}

function toDateString(d) {
  if (!d?.year) return null;
  const month = String(d.month || 1).padStart(2, "0");
  const day = String(d.day || 1).padStart(2, "0");
  return `${d.year}-${month}-${day}`;
}

const HTML_ENTITIES = {
  "&quot;": '"',
  "&#039;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

function stripHtml(text) {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(quot|#0?39|apos|lt|gt|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&amp;/g, "&");
}

const STATUS_LABEL = {
  RELEASING: "Currently Airing",
  FINISHED: "Finished Airing",
  NOT_YET_RELEASED: "Not yet aired",
  CANCELLED: "Cancelled",
  HIATUS: "On Hiatus",
};

const FORMAT_LABEL = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
};

export function toJikanShape(media) {
  if (!media?.idMal) return null;
  const cover = media.coverImage?.extraLarge || media.coverImage?.large || "";
  return {
    mal_id: media.idMal,
    title: media.title?.romaji || media.title?.english || "Untitled",
    title_english: media.title?.english || null,
    title_japanese: media.title?.native || null,
    images: {
      jpg: {
        image_url: media.coverImage?.large || cover,
        large_image_url: cover,
      },
    },
    type: FORMAT_LABEL[media.format] || media.format || null,
    episodes: media.episodes || null,
    next_episode: media.nextAiringEpisode?.episode || null,
    synopsis: stripHtml(media.description),
    score: media.averageScore ? media.averageScore / 10 : null,
    status: STATUS_LABEL[media.status] || media.status || "Unknown",
    aired: {
      from: toDateString(media.startDate),
      to: toDateString(media.endDate),
    },
    genres: (media.genres || []).map((name) => ({ name })),
  };
}

export function getEpisodeCount(anime) {
  if (!anime) return null;
  if (anime.episodes >= 1) return anime.episodes;
  if (anime.next_episode > 1) return anime.next_episode - 1;
  return null;
}

export function uniqueById(list) {
  const seen = new Set();
  return list.filter((a) => {
    if (!a || seen.has(a.mal_id)) return false;
    seen.add(a.mal_id);
    return true;
  });
}

function currentSeason() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const season = month <= 2 ? "WINTER" : month <= 5 ? "SPRING" : month <= 8 ? "SUMMER" : "FALL";
  return { season, year };
}

async function anilist(query, variables) {
  const response = await axios.post(ANILIST, { query, variables }, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    timeout: 20000,
  });
  if (response.data?.errors?.length) {
    throw new Error(response.data.errors[0].message || "AniList error");
  }
  return response.data?.data;
}

async function fetchList(cacheKey, query, variables) {
  const cached = getCache(cacheKey);
  if (cached) return cached;
  try {
    const data = await anilist(query, variables);
    const list = uniqueById((data?.Page?.media || []).map(toJikanShape));
    if (list.length) setCache(cacheKey, list);
    return list;
  } catch (error) {
    console.error(`Anime list failed (${cacheKey})`, error);
    return [];
  }
}

export function searchAnime(queryText) {
  const text = queryText?.trim();
  if (!text) return Promise.resolve([]);
  return fetchList(
    `search_v3_${text.toLowerCase()}`,
    `query ($search: String) {
      Page(perPage: 24) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
      }
    }`,
    { search: text }
  );
}

export function getTopAiring(page = 1) {
  return fetchList(
    `top_airing_v3_${page}`,
    `query ($page: Int) {
      Page(page: $page, perPage: 15) {
        media(type: ANIME, status: RELEASING, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { page }
  );
}

export function getTrending(page = 1) {
  return fetchList(
    `trending_v3_${page}`,
    `query ($page: Int) {
      Page(page: $page, perPage: 15) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { page }
  );
}

export function getThisSeason(page = 1) {
  const { season, year } = currentSeason();
  return fetchList(
    `season_v3_${season}_${year}_${page}`,
    `query ($page: Int, $season: MediaSeason, $year: Int) {
      Page(page: $page, perPage: 15) {
        media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { page, season, year }
  );
}

export function getTopRated(page = 1) {
  return fetchList(
    `top_rated_v3_${page}`,
    `query ($page: Int) {
      Page(page: $page, perPage: 15) {
        media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { page }
  );
}

export function peekAnimeDetails(id) {
  return id ? getCache(`anime_v3_${id}`) : null;
}

export async function getAnimeDetails(id) {
  if (!id) return null;
  const cacheKey = `anime_v3_${id}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const data = await anilist(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) { ${MEDIA_FIELDS} }
      }`,
      { idMal: parseInt(id, 10) }
    );
    const shaped = toJikanShape(data?.Media);
    if (shaped) setCache(cacheKey, shaped);
    return shaped;
  } catch (error) {
    console.warn(`Anime lookup failed for ${id}`, error);
    return null;
  }
}

export async function getAnimeRelations(id) {
  if (!id) return [];
  const cacheKey = `rel_v3_${id}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  try {
    const data = await anilist(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          relations {
            edges {
              relationType
              node { idMal type title { romaji english } }
            }
          }
        }
      }`,
      { idMal: parseInt(id, 10) }
    );
    const list = (data?.Media?.relations?.edges || [])
      .filter((edge) => edge.node?.type === "ANIME" && edge.node?.idMal)
      .map((edge) => ({
        relation: String(edge.relationType || "RELATED").replace(/_/g, " "),
        mal_id: edge.node.idMal,
        name: edge.node.title?.english || edge.node.title?.romaji || "Untitled",
      }));
    setCache(cacheKey, list);
    return list;
  } catch {
    return [];
  }
}

// Queries live weekly broadcast calendar from AniList
export async function getAiringSchedule(dayOffset = 0) {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const startOfDay = Math.floor(new Date(targetDate.setHours(0, 0, 0, 0)).getTime() / 1000);
  const endOfDay = Math.floor(new Date(targetDate.setHours(23, 59, 59, 999)).getTime() / 1000);

  const query = `
    query ($start: Int, $end: Int) {
      Page(page: 1, perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            idMal
            title { english romaji }
            coverImage { large extraLarge }
            format
            genres
            status
          }
        }
      }
    }
  `;

  try {
    const res = await axios.post(ANILIST, {
      query,
      variables: { start: startOfDay, end: endOfDay },
    });
    const schedules = res.data?.data?.Page?.airingSchedules || [];
    return schedules
      .filter((s) => s.media?.idMal && s.media?.format === "TV")
      .map((s) => ({
        id: s.id,
        mal_id: s.media.idMal,
        episode: s.episode,
        airingAt: s.airingAt,
        timeUntilAiring: s.timeUntilAiring,
        title: s.media.title.english || s.media.title.romaji,
        image: s.media.coverImage?.extraLarge || s.media.coverImage?.large,
        genres: s.media.genres || [],
      }));
  } catch (err) {
    console.error("Failed to fetch airing schedule:", err);
    return [];
  }
}