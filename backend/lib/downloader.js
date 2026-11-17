// backend/lib/downloader.js
// Real episode downloader. The frontend only ever has an embed/player URL such
// as "https://host/stream/mal/123/4/sub", which is an HTML page. This module
// resolves that page down to an actual media URL, then writes either a direct
// file or an HLS playlist (optionally AES-128 encrypted) to disk.

const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

class DownloadError extends Error {}

// A real episode is megabytes. Anything this small is an error page, a JSON
// stub, a "link expired" notice or a partial init segment that the host served
// with a 200 and a video content-type.
const MIN_EPISODE_BYTES = 256 * 1024;

function looksLikeText(head) {
  const sample = head.subarray(0, 512);
  if (!sample.length) return false;
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte < 127)) printable += 1;
  }
  if (printable / sample.length > 0.85) return true;
  const start = sample
    .toString("latin1")
    .replace(/^\uFEFF/, "")
    .trimStart()
    .slice(0, 32)
    .toLowerCase();
  return start.startsWith("<") || start.startsWith("{") || start.startsWith("[");
}

/**
 * Identifies the container from the file signature. Returns null when the bytes
 * are not video at all (HTML, JSON, plain text, encrypted blob, ...).
 */
function sniffContainer(head) {
  if (head.length >= 12) {
    const box = head.toString("latin1", 4, 8);
    if (["ftyp", "styp", "moov", "mdat", "free", "skip", "wide"].includes(box)) return "mp4";
    if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "AVI ") {
      return "avi";
    }
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
    return "webm";
  }
  if (head.length >= 1 && head[0] === 0x47 && (head.length < 189 || head[188] === 0x47)) return "ts";
  if (head.length >= 3 && head.toString("latin1", 0, 3) === "FLV") return "flv";
  if (head.length >= 4 && head[0] === 0 && head[1] === 0 && head[2] === 1) return "mpeg";
  return null;
}

/**
 * Rejects response bodies that are not a real episode. Without this a host that
 * answers with a 5 KB HTML/JSON error (but 200 OK and a video content-type)
 * looks like a completed download and saves an unplayable stub.
 * @returns {{size:number, container:string}}
 */
function verifySavedVideo(filePath) {
  const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  if (size === 0) throw new DownloadError("The host returned an empty file.");

  const fd = fs.openSync(filePath, "r");
  let head;
  try {
    head = Buffer.alloc(Math.min(size, 4096));
    fs.readSync(fd, head, 0, head.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const container = sniffContainer(head);
  if (!container) {
    throw new DownloadError(
      looksLikeText(head)
        ? "The host sent a web page or error message instead of a video file. Pick another server and try again."
        : "The host's response was not a playable video file. Pick another server and try again."
    );
  }

  if (size < MIN_EPISODE_BYTES) {
    throw new DownloadError(
      `The host returned only ${Math.max(1, Math.round(size / 1024))} KB of ${container.toUpperCase()} data — not a full episode (usually a broken or expiring link). Pick another server and try again.`
    );
  }

  return { size, container };
}

function requestHeaders(url, referer) {
  let origin = "";
  try {
    const parsed = new URL(url);
    origin = `${parsed.protocol}//${parsed.host}`;
  } catch {
    // leave headers minimal for odd URLs
  }
  return {
    "User-Agent": UA,
    Accept: "*/*",
    ...(origin ? { Origin: origin } : {}),
    Referer: referer || (origin ? `${origin}/` : undefined),
  };
}

function readText(stream, limit = 2 * 1024 * 1024, idleMs = 45000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    // axios' timeout only covers the response headers. A body that stalls after
    // them would otherwise leave the download "resolving" forever.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      stream.destroy();
      reject(new DownloadError("The host's player page stopped responding."));
    }, idleMs);

    const settle = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };

    stream.on("data", (chunk) => {
      timer.refresh();
      if (size < limit) {
        chunks.push(chunk);
        size += chunk.length;
      }
    });
    stream.on("end", () => settle(null, Buffer.concat(chunks).toString("utf8")));
    stream.on("error", (error) => settle(error));
  });
}

/**
 * Progress updates have the shape
 *   { stage: "resolving"|"downloading"|"saving", percent: number|null,
 *     received: number, total: number }
 * `percent` is null when the host never told us the file size, so the UI can
 * show an indeterminate bar and live byte counts instead of a frozen 0%.
 */
function emit(onProgress, update) {
  try {
    onProgress(update);
  } catch {
    // A throwing progress listener must never abort the download.
  }
}

const MEDIA_URL_RE = /https?:\/\/[^\s"'<>\\)]+\.(?:m3u8|mp4|m4v|webm)(?:\?[^\s"'<>]*)?/gi;

function pickMediaUrl(html, baseUrl) {
  // Player pages usually carry JSON/JS strings with escaped slashes.
  const unescaped = html.replace(/\\\//g, "/");
  const matches = unescaped.match(MEDIA_URL_RE) || [];
  if (!matches.length) return null;
  const playlist = matches.find((url) => /\.m3u8/i.test(url));
  const chosen = playlist || matches[0];
  try {
    return new URL(chosen, baseUrl).toString();
  } catch {
    return chosen;
  }
}

/**
 * Opens a URL and works out what it actually is.
 * @returns {Promise<{kind:"file",stream:object,total:number}|{kind:"hls",text:string,baseUrl:string}>}
 */
async function openSource(url, referer, depth = 0) {
  if (depth > 3) throw new DownloadError("Too many redirects while resolving the video source");

  let response;
  try {
    response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      timeout: 45000,
      maxRedirects: 5,
      headers: requestHeaders(url, referer),
    });
  } catch (error) {
    const status = error?.response?.status;
    if (status === 403 || status === 401) {
      throw new DownloadError(
        "The host rejected the request (needs a signed/expiring link). Try another server."
      );
    }
    if (status === 404) {
      throw new DownloadError("That episode source does not exist (HTTP 404).");
    }
    throw new DownloadError(`Could not reach the video source: ${error.message}`);
  }

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  const finalUrl = response.request?.res?.responseUrl || url;

  if (/mpegurl|vnd\.apple/.test(contentType) || /\.m3u8(\?|$)/i.test(finalUrl)) {
    const text = await readText(response.data);
    if (!/^#EXTM3U/m.test(text.trim())) {
      throw new DownloadError("This source returned an unreadable HLS playlist.");
    }
    return { kind: "hls", text, baseUrl: finalUrl, contentType, url: finalUrl };
  }

  if (contentType.includes("text/html") || contentType.includes("json")) {
    const body = await readText(response.data);
    const mediaUrl = pickMediaUrl(body, finalUrl);
    if (mediaUrl) return openSource(mediaUrl, finalUrl, depth + 1);
    throw new DownloadError(
      "This server only returns an embedded player page (no video file). Pick another server, or stream it instead."
    );
  }

  const total = parseInt(response.headers["content-length"], 10) || 0;
  return { kind: "file", stream: response.data, total, contentType, url: finalUrl };
}

function pipeToFile(stream, filePath, total, onProgress) {
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    let written = 0;
    let lastPercent = -1;
    let lastEmit = 0;
    let settled = false;
    let idle = null;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(idle);
      writer.destroy();
      stream.destroy();
      reject(error);
    };

    // A body that stops sending data used to sit at "downloading" forever, so
    // treat a long silence as a dead connection instead of hanging.
    const bumpIdle = () => {
      clearTimeout(idle);
      idle = setTimeout(
        () => fail(new DownloadError("The host stopped sending video data (connection stalled).")),
        60000
      );
    };
    bumpIdle();

    emit(onProgress, {
      stage: "downloading",
      percent: total > 0 ? 0 : null,
      received: 0,
      total,
    });
    lastEmit = Date.now();

    stream.on("data", (chunk) => {
      bumpIdle();
      written += chunk.length;
      const percent = total > 0 ? Math.min(99, Math.round((written / total) * 100)) : null;
      const now = Date.now();
      // Report every percentage point, and (when the size is unknown) at least
      // twice a second so the UI still moves.
      if (percent !== lastPercent || now - lastEmit >= 500) {
        lastPercent = percent;
        lastEmit = now;
        emit(onProgress, { stage: "downloading", percent, received: written, total });
      }
    });
    stream.on("error", fail);
    writer.on("error", fail);
    writer.on("finish", () => {
      if (settled) return;
      settled = true;
      clearTimeout(idle);
      resolve({ bytes: written, expected: total });
    });
    stream.pipe(writer);
  });
}

function parseIv(value, sequence) {
  if (value) {
    const hex = value.replace(/^0x/i, "");
    const buf = Buffer.from(hex, "hex");
    if (buf.length === 16) return buf;
  }
  const iv = Buffer.alloc(16);
  iv.writeUInt32BE(sequence >>> 0, 12);
  return iv;
}

function decryptSegment(buffer, key, iv) {
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

async function fetchBuffer(url, referer) {
  const response = await axios({
    method: "GET",
    url,
    responseType: "arraybuffer",
    timeout: 60000,
    maxRedirects: 5,
    headers: requestHeaders(url, referer),
  });
  return Buffer.from(response.data);
}

/**
 * Downloads an HLS playlist by fetching (and decrypting) every segment in order.
 * Returns the container ("mp4" for fMP4/init segments, "ts" otherwise).
 */
async function downloadHls(playlistText, playlistUrl, filePath, onProgress) {
  const lines = playlistText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Master playlists point at a variant playlist: pick the highest bandwidth.
  if (lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"))) {
    let best = null;
    let bestBandwidth = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;
      const bandwidth = Number(/#BANDWIDTH=(\d+)/i.exec(lines[i])?.[1] || 0);
      const next = lines[i + 1];
      if (next && !next.startsWith("#") && bandwidth >= bestBandwidth) {
        bestBandwidth = bandwidth;
        best = next;
      }
    }
    if (!best) throw new DownloadError("The HLS playlist did not list a playable variant.");
    const variantUrl = new URL(best, playlistUrl).toString();
    emit(onProgress, { stage: "resolving", percent: null, received: 0, total: 0 });
    const variantText = (await fetchBuffer(variantUrl, playlistUrl)).toString("utf8");
    return downloadHls(variantText, variantUrl, filePath, onProgress);
  }

  const segments = [];
  let mapUri = null;
  let key = null;
  let sequence = 0;
  let explicitIv = null;
  let usesFmp4 = false;

  for (const line of lines) {
    if (line.startsWith("#EXT-X-KEY")) {
      const method = /METHOD=([^,]+)/i.exec(line)?.[1]?.toUpperCase();
      const uri = /URI="([^"]+)"/i.exec(line)?.[1];
      explicitIv = /IV=([^,]+)/i.exec(line)?.[1] || null;
      if (method === "AES-128" && uri) {
        const keyUrl = new URL(uri, playlistUrl).toString();
        key = await fetchBuffer(keyUrl, playlistUrl);
        if (key.length !== 16) throw new DownloadError("The HLS decryption key had an unexpected length.");
      } else if (method && method !== "NONE") {
        throw new DownloadError(`This stream uses unsupported HLS encryption (${method}).`);
      } else {
        key = null;
      }
      continue;
    }
    if (line.startsWith("#EXT-X-MAP")) {
      const uri = /URI="([^"]+)"/i.exec(line)?.[1];
      if (uri) {
        mapUri = new URL(uri, playlistUrl).toString();
        usesFmp4 = true;
      }
      continue;
    }
    if (line.startsWith("#EXT-X-MEDIA-SEQUENCE")) {
      sequence = Number(line.split(":")[1]) || 0;
      continue;
    }
    if (line.startsWith("#")) continue;
    segments.push({ url: new URL(line, playlistUrl).toString(), sequence });
    sequence += 1;
  }

  if (!segments.length) throw new DownloadError("The HLS playlist contained no video segments.");

  const writer = fs.createWriteStream(filePath);
  let received = 0;
  let writeError = null;
  writer.on("error", (error) => {
    writeError = error;
  });
  const writeChunk = (buffer) =>
    new Promise((resolve, reject) => {
      if (writeError) {
        reject(writeError);
        return;
      }
      writer.write(buffer, (error) => (error ? reject(error) : resolve()));
    });

  try {
    emit(onProgress, {
      stage: "downloading",
      percent: 0,
      received: 0,
      total: 0,
    });

    if (mapUri) {
      const init = await fetchBuffer(mapUri, playlistUrl);
      received += init.length;
      await writeChunk(init);
    }

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      emit(onProgress, {
        stage: "downloading",
        percent: Math.min(99, Math.round((i / segments.length) * 100)),
        received,
        total: 0,
      });
      let data = await fetchBuffer(segment.url, playlistUrl);
      if (key) data = decryptSegment(data, key, parseIv(explicitIv, segment.sequence));
      received += data.length;
      await writeChunk(data);
      emit(onProgress, {
        stage: "downloading",
        percent: Math.min(99, Math.round(((i + 1) / segments.length) * 100)),
        received,
        total: 0,
      });
    }
  } finally {
    await new Promise((resolve) => writer.end(resolve));
  }

  return { container: usesFmp4 ? "mp4" : "ts", segments: segments.length };
}

// The standard MAL hosts. One host is often broken for a single episode
// (embed-only page, expired signed link, 5 KB stub) while another host serves
// the very same episode fine. Downloads therefore fall back across hosts.
//
// This lives in the downloader only: playback keeps running on whatever server
// the viewer picked, and the download simply moves on to another host behind
// the scenes without touching the player or the iframe.
const MAL_SOURCE_TEMPLATES = [
  (id, ep, lang) => `https://megaplay.buzz/stream/mal/${id}/${ep}/${lang}`,
  (id, ep, lang) => `https://megavid.buzz/mal/${id}/${ep}/${lang}`,
  (id, ep, lang) => `https://anixo.buzz/embed/mal/${id}/${ep}?track=${lang}`,
  (id, ep, lang) => `https://vidhawk.buzz/embed/mal/${id}/${ep}/${lang}`,
  (id, ep, lang) =>
    `https://flixera.co/embed/mal/${id}/${ep}/${lang}?autoplay=1&skipintro=1&skipoutro=1`,
];

/**
 * Reads the sub/dub track out of a source URL. Hosts disagree where they put
 * it: a `?track=`/`?lang=` parameter, a trailing `/sub`, or a segment before
 * the episode number (`/api/embed/anime/sub/<id>/<ep>`).
 * @param {URL} parsed
 * @returns {"sub"|"dub"}
 */
function detectLanguage(parsed) {
  const fromQuery = (
    parsed.searchParams.get("track") ||
    parsed.searchParams.get("lang") ||
    parsed.searchParams.get("lang-type") ||
    ""
  ).toLowerCase();
  if (/^(sub|dub)$/.test(fromQuery)) return fromQuery;

  for (const segment of parsed.pathname.split("/")) {
    const value = segment.toLowerCase();
    if (value === "sub" || value === "dub") return value;
  }
  return "sub";
}

/**
 * Works out which other hosts carry the same episode. The requested URL always
 * comes first, so a working source is never replaced.
 *
 * Some hosts (tryembed, cinextream, aniembed, nontongo, ani.pm) key episodes off the
 * AniList id instead of the MAL id, so their URLs carry no `/mal/<id>/<ep>` to
 * read. The caller therefore passes the anime id and episode it already knows,
 * which keeps the MAL hosts as a working fallback for those servers too.
 * @param {string} streamUrl
 * @param {{animeId?: number|string, episode?: number|string}} [hint]
 * @returns {string[]}
 */
function sourceCandidates(streamUrl, hint = {}) {
  const candidates = [streamUrl];
  let parsed;
  try {
    parsed = new URL(streamUrl);
  } catch {
    return candidates;
  }

  const match = /\/mal\/(\d+)\/(\d+)/i.exec(parsed.pathname);
  const id = match?.[1] || (hint.animeId != null ? String(hint.animeId) : "");
  const ep = match?.[2] || (hint.episode != null ? String(hint.episode) : "");
  if (!/^\d+$/.test(id) || !/^\d+$/.test(ep)) return candidates;

  const lang = detectLanguage(parsed);

  for (const build of MAL_SOURCE_TEMPLATES) {
    const url = build(id, ep, lang);
    if (!candidates.includes(url)) candidates.push(url);
  }
  return candidates;
}

/**
 * Removes a partial episode (whatever container an attempt used) so the next
 * host starts from a clean file instead of appending to broken bytes.
 */
function cleanupDownloadFiles(filePath) {
  const variants = new Set([
    filePath,
    filePath.replace(/\.mp4$/i, ".ts"),
    filePath.replace(/\.ts$/i, ".mp4"),
  ]);
  for (const variant of variants) {
    try {
      if (fs.existsSync(variant)) fs.unlinkSync(variant);
    } catch {
      // ignore cleanup failures
    }
  }
}

/**
 * Downloads an episode from one specific host. `filePath` should end in the
 * expected container; when the source turns out to be TS the extension is
 * swapped for the caller.
 * @returns {Promise<{filePath:string,bytes:number,container:string,url:string}>}
 */
async function downloadFromSource(streamUrl, filePath, onProgress = () => {}) {
  // The embed page has to be followed to the real media URL first. That phase
  // can take a while on slow hosts, so tell the UI what is happening instead of
  // leaving a progress bar at 0% with no explanation.
  emit(onProgress, { stage: "resolving", percent: null, received: 0, total: 0 });
  const source = await openSource(streamUrl);

  if (source.kind === "file") {
    const result = await pipeToFile(source.stream, filePath, source.total, onProgress);
    const onDisk = fs.existsSync(filePath) ? fs.statSync(filePath).size : result.bytes;
    if (result.expected > 0 && onDisk < result.expected) {
      throw new DownloadError(
        `The connection closed before the episode finished (${onDisk} of ${result.expected} bytes).`
      );
    }

    emit(onProgress, {
      stage: "saving",
      percent: 99,
      received: onDisk,
      total: result.expected || onDisk,
    });
    const checked = verifySavedVideo(filePath);

    // A "direct file" is sometimes really an MPEG-TS stream; keep the extension
    // honest so the local stream endpoint serves the right content type.
    if (checked.container === "ts" && /\.mp4$/i.test(filePath)) {
      const tsPath = filePath.replace(/\.mp4$/i, ".ts");
      fs.renameSync(filePath, tsPath);
      return { filePath: tsPath, bytes: checked.size, container: "ts", url: source.url };
    }

    return { filePath, bytes: checked.size, container: checked.container, url: source.url };
  }

  const hlsPath = filePath.replace(/\.mp4$/i, ".ts");
  const hlsTarget = hlsPath === filePath && !/\.(ts|mp4)$/i.test(filePath) ? `${filePath}.ts` : hlsPath;
  const result = await downloadHls(source.text, source.baseUrl, hlsTarget, onProgress);
  const finalPath =
    result.container === "mp4"
      ? hlsTarget.replace(/\.ts$/i, ".mp4")
      : hlsTarget;

  if (finalPath !== hlsTarget && fs.existsSync(hlsTarget)) {
    fs.renameSync(hlsTarget, finalPath);
  }

  emit(onProgress, { stage: "saving", percent: 99, received: 0, total: 0 });
  const checked = verifySavedVideo(finalPath);
  return { filePath: finalPath, bytes: checked.size, container: checked.container, url: source.url };
}

/**
 * Tries each candidate host in order until one yields a real episode file.
 * @param {string[]} candidates - URLs to try, best first
 * @returns {Promise<{filePath:string,bytes:number,container:string,url:string}>}
 */
async function downloadWithFallback(candidates, filePath, onProgress = () => {}) {
  let lastError = null;

  for (let i = 0; i < candidates.length; i += 1) {
    try {
      return await downloadFromSource(candidates[i], filePath, onProgress);
    } catch (error) {
      lastError = error;
      cleanupDownloadFiles(filePath);

      // Disk/permission problems would fail identically on every host.
      if (!(error instanceof DownloadError)) throw error;

      const more = i < candidates.length - 1;
      if (more) {
        console.warn(
          `[DOWNLOAD] ${candidates[i]} could not provide the episode (${error.message}); switching to ${candidates[i + 1]}`
        );
        emit(onProgress, { stage: "resolving", percent: null, received: 0, total: 0 });
      }
    }
  }

  const reason = lastError?.message || "No server returned a video file.";
  const tried = candidates.length > 1 ? ` (tried ${candidates.length} servers)` : "";
  throw new DownloadError(`${reason}${tried}`);
}

/**
 * Downloads an episode, automatically moving on to the next host when one
 * cannot provide a real video file. The viewer's playback is never touched:
 * this only changes where the file comes from.
 * @param {{animeId?: number|string, episode?: number|string}} [hint] MAL id and
 *   episode to fall back with when the URL itself carries no `/mal/<id>/<ep>`.
 * @returns {Promise<{filePath:string,bytes:number,container:string,url:string}>}
 */
async function downloadEpisode(streamUrl, filePath, onProgress = () => {}, hint = {}) {
  return downloadWithFallback(sourceCandidates(streamUrl, hint), filePath, onProgress);
}

module.exports = {
  downloadEpisode,
  DownloadError,
  MIN_EPISODE_BYTES,
  sourceCandidates,
  downloadWithFallback,
};
