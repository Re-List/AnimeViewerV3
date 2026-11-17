// frontend/src/services/playerSources.js
// One list of streaming sources, shared by the Player and the Settings picker.
// Two id schemes: the first hosts key off the MAL id (what the app routes by),
// the newer ones key off the AniList media id. Details already come from
// AniList, so both ids are available when the list is built.
// Order matters: existing positions are kept so a saved playerSource index
// keeps pointing at the same host.

export const PLAYER_SOURCES = [
  {
    name: "MegaPlay",
    build: ({ mal }, ep, lang) => `https://megaplay.buzz/stream/mal/${mal}/${ep}/${lang}`,
  },
  {
    name: "Megavid",
    build: ({ mal }, ep, lang) => `https://megavid.buzz/mal/${mal}/${ep}/${lang}`,
  },
  {
    name: "Anixo",
    build: ({ mal }, ep, lang) => `https://anixo.buzz/embed/mal/${mal}/${ep}?track=${lang}`,
  },
  {
    name: "VidHawk",
    build: ({ mal }, ep, lang) => `https://vidhawk.buzz/embed/mal/${mal}/${ep}/${lang}`,
  },
  {
    name: "Flixera",
    build: ({ mal }, ep, lang) =>
      `https://flixera.co/embed/mal/${mal}/${ep}/${lang}?autoplay=1&skipintro=1&skipoutro=1`,
  },
  {
    name: "TryEmbed",
    build: ({ anilist }, ep, lang) =>
      anilist ? `https://tryembed.us.cc/embed/anime/${anilist}/${ep}/${lang}?autoplay=true&autoNext=false` : null,
  },
  {
    name: "CineXtream",
    build: ({ anilist }, ep, lang) =>
      anilist ? `https://cinextream.cc/api/embed/anime/${lang}/${anilist}/${ep}?color=7c6ee0` : null,
  },
  {
    name: "AniEmbed",
    build: ({ anilist }, ep, lang) =>
      anilist ? `https://aniembed.se/e/${anilist}/${ep}?lang=${lang}&autoplay=1` : null,
  },
  {
    name: "NontonGo",
    build: ({ anilist }, ep) =>
      anilist ? `https://nontongo.win/anime/${anilist}/${ep}/play` : null,
  },
  {
    name: "Ani.pm",
    // Documented open embed (ani.pm/developers). This is the settlar.io player
    // ani.pm runs; its /embed/v1?t=<token> form is a signed per-session URL
    // and cannot be built from an id, so it is never used here.
    build: ({ anilist }, ep, lang) =>
      anilist ? `https://ani.pm/embed/ani/${anilist}/${ep}/${lang}` : null,
  },
];

// Plain host names, in the same order: what the Settings picker shows.
export const PLAYER_SOURCE_NAMES = PLAYER_SOURCES.map((source) => source.name);
