/**
 * dsh-glass-skin — Host half.
 *
 * Routes for the browser half:
 *   GET  /api/dsh-glass-skin/assets?f=...   the packaged wallpaper / user wallpaper
 *   GET  /api/dsh-glass-skin/wallpapers     the switchable wallpapers
 *   POST /api/dsh-glass-skin/wallpapers     raw image body → user wallpaper folder
 *   POST /api/dsh-glass-skin/state          { op: 'get' | 'set', patch }
 *
 * The state route exists because the Desktop shell assigns a fresh port on every
 * launch, so the browser origin — and with it localStorage — changes each time.
 * A visual preference that only lives in localStorage is therefore forgotten on
 * every restart (observed: 127.0.0.1:64500 → 127.0.0.1:49270). The small JSON
 * file below is origin-independent and survives it. Same reasoning as
 * dsh-dream-skin's host-backed layer (MIT), implemented independently.
 *
 * 5.2 hardens the seams that only show up in daily use:
 *   · wallpapers dropped by the user live in ~/.dsh/dsh-glass-skin/wallpapers,
 *     not inside the installed package (an update must not erase them, and a
 *     pnpm/npm install may be read-only);
 *   · the preference file is written to a temp file, fsynced and renamed, and
 *     writes are serialised, so two quick clicks cannot interleave or leave a
 *     half-written JSON document;
 *   · a corrupt preference file is moved aside instead of failing the route;
 *   · file responses attach an error handler to the read stream, so deleting a
 *     wallpaper mid-request closes that response instead of crashing the host;
 *   · wallpaper names are no longer ASCII-only (中文、空格、括号都可以), while
 *     separators and control characters stay rejected.
 *
 * 5.3 adds the import route: a raw image body is checked by magic bytes, capped
 * at 32MB, given a sanitised single-segment name and written atomically into the
 * user folder. The settings panel uses it for drag/drop and 「导入图片」.
 */
import {
  copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { mkdir, open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Cordis plugin name (loader diagnostics). */
export const name = 'dsh-glass-skin';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(HERE, 'assets');
/** Images shipped with the package; still the fallback set. */
const PACKAGED_WALLPAPERS_DIR = path.join(ASSETS_DIR, 'wallpapers');
/** Durable visual preferences; independent of the browser origin. */
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
/** User-drop wallpaper folder: one image here is one switchable "theme". */
const USER_WALLPAPERS_DIR = path.join(DSH_HOME, 'dsh-glass-skin', 'wallpapers');
const STATE_FILE = path.join(DSH_HOME, 'dsh-glass-skin.json');

/* 6.0.0 renamed the package from dsh-skin-icebox. The old identifiers appear
   here and nowhere else, so an upgrade can adopt what the user already had
   instead of starting from an empty wallpaper picker. */
const LEGACY_ID = 'dsh-skin-icebox';
const LEGACY_WALLPAPERS_DIR = path.join(DSH_HOME, LEGACY_ID, 'wallpapers');
const LEGACY_STATE_FILE = path.join(DSH_HOME, `${LEGACY_ID}.json`);
const MIGRATION_MARKER = path.join(DSH_HOME, 'dsh-glass-skin', '.migrated-from-icebox');

const WALLPAPER_EXT = /\.(?:jpe?g|png|webp)$/i;
/* One path segment, no separators / Windows-reserved characters / controls.
   Unicode is allowed so a file named 冰柜.jpg can be picked in settings. */
const WALLPAPER_NAME = /^[^\\/:*?"<>|\u0000-\u001f]{1,128}$/u;
const MAX_STATE_BYTES = 64 * 1024;
const MAX_BODY_BYTES = 64 * 1024;

/** Only these keys may be written — this route is not a general file writer. */
const STATE_KEYS = new Set(['mode', 'scene', 'transparency', 'wallpaper']);
const MODES = new Set(['ambient', 'focus']);
const SCENES = new Set(['clear', 'balanced', 'quiet']);

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Images are imported by the settings panel; keep the ceiling generous but real. */
const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Trust the bytes, not the extension the browser supplied. */
function detectImageExt(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return '.png';
  if (buffer.length >= 12
    && buffer.subarray(0, 4).toString('latin1') === 'RIFF'
    && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  return null;
}

/** Keep one readable base name; the extension always comes from the bytes. */
function safeUploadName(value, ext) {
  let raw = '';
  try {
    raw = decodeURIComponent(String(value ?? ''));
  } catch {
    raw = String(value ?? '');
  }
  let base = path.basename(raw)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    // A leading dot would be hidden from the picker (wallpaperName rejects it).
    .replace(/^\.+/, '')
    .replace(/\.(?:jpe?g|png|webp)$/i, '')
    .replace(/[. ]+$/g, '')
    .trim();
  if (base === '' || base === '.' || base === '..' || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) {
    base = `wallpaper-${Date.now()}`;
  }
  base = base.slice(0, 100);
  let candidate = `${base}${ext}`;
  for (let index = 2; existsSync(path.join(USER_WALLPAPERS_DIR, candidate)); index += 1) {
    candidate = `${base}-${index}${ext}`;
    if (index > 999) {
      candidate = `${base}-${Date.now()}${ext}`;
      break;
    }
  }
  return candidate;
}

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/** Validate a wallpaper file name without accepting a path. */
function wallpaperName(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('.') || value.endsWith('.') || value.endsWith(' ')) return null;
  if (!WALLPAPER_NAME.test(value) || !WALLPAPER_EXT.test(value)) return null;
  return value;
}

/** User folder wins, so a dropped file can replace a packaged one by name. */
function resolveWallpaper(name) {
  const user = path.join(USER_WALLPAPERS_DIR, name);
  if (isFile(user)) return user;
  const packaged = path.join(PACKAGED_WALLPAPERS_DIR, name);
  if (isFile(packaged)) return packaged;
  return null;
}

/** Resolve a non-wallpaper asset inside the package (the built-in jpg). */
function safeAsset(rel) {
  if (typeof rel !== 'string' || rel === '') return null;
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return null;
  if (normalized.split('/').includes('..')) return null;
  const target = path.normalize(path.join(ASSETS_DIR, normalized));
  if (target !== ASSETS_DIR && !target.startsWith(ASSETS_DIR + path.sep)) return null;
  return target;
}

/** Map `?f=` to a real file, letting a user wallpaper override a packaged one. */
function assetRequest(rel) {
  if (typeof rel !== 'string' || rel === '') return null;
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.startsWith('wallpapers/')) {
    const rest = normalized.slice('wallpapers/'.length);
    if (rest.includes('/')) return null;
    const name = wallpaperName(rest);
    return name === null ? null : resolveWallpaper(name);
  }
  return safeAsset(normalized);
}

async function readState() {
  let raw;
  try {
    const info = await stat(STATE_FILE);
    if (info.size > MAX_STATE_BYTES) return {};
    raw = await readFile(STATE_FILE, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      // Unreadable is not fatal: the page can still paint with local defaults.
      return {};
    }
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Keep the evidence instead of silently truncating the user's choice.
    try {
      await rename(STATE_FILE, `${STATE_FILE}.corrupt-${Date.now()}`);
    } catch {
      /* best effort */
    }
    return {};
  }
}

/** Serialise read-modify-write so two clicks cannot lose one another. */
let stateQueue = Promise.resolve();
let tempCounter = 0;
function enqueueState(task) {
  const run = stateQueue.then(task, task);
  stateQueue = run.then(() => undefined, () => undefined);
  return run;
}

/** Write a file beside its target, fsync it, then rename over the target. */
async function writeFileAtomic(file, body, options = {}) {
  const temp = `${file}.${process.pid}.${Date.now()}.${++tempCounter}.tmp`;
  await mkdir(path.dirname(file), { recursive: true });
  const handle = await open(temp, 'w', options.mode ?? 0o600);
  try {
    try {
      await handle.writeFile(body);
      // A preference file or a wallpaper is written once; fsync makes the
      // rename meaningful after a crash rather than only within the page cache.
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    // Do not leave a half-written temp file beside the real file.
    await unlink(temp).catch(() => {});
    throw error;
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(temp, file);
      return;
    } catch (error) {
      const retriable = error?.code === 'EPERM'
        || error?.code === 'EBUSY'
        || error?.code === 'EACCES';
      if (!retriable || attempt >= 3) {
        await unlink(temp).catch(() => {});
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
}

async function writeStateAtomic(value) {
  await writeFileAtomic(STATE_FILE, `${JSON.stringify(value, null, 2)}\n`);
}

async function mergeState(patch) {
  return enqueueState(async () => {
    const current = await readState();
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return current;
    for (const [key, value] of Object.entries(patch)) {
      if (!STATE_KEYS.has(key)) continue;
      if (key === 'mode' && MODES.has(value)) current.mode = value;
      if (key === 'scene' && SCENES.has(value)) current.scene = value;
      // The window-glass option is glass-only since 4.9.4; an old "system" patch is
      // ignored so a stale client cannot write the removed choice back into state.
      if (key === 'transparency' && value === 'glass') current.transparency = value;
      // 5.0: the wallpaper is the one switchable input. Empty means "the packaged
      // default"; anything else must be a real image, so a stale or hand-edited
      // state file cannot point the skin at an arbitrary path.
      if (key === 'wallpaper') {
        if (value === '') {
          delete current.wallpaper;
        } else {
          const name = wallpaperName(value);
          if (name !== null && resolveWallpaper(name) !== null) current.wallpaper = name;
        }
      }
    }
    await writeStateAtomic(current);
    return current;
  });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // A preference document is tiny; refuse anything that looks like an upload.
    if (size > MAX_BODY_BYTES) throw new Error('payload too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text === '') return {};
  const parsed = JSON.parse(text);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

async function listWallpapers() {
  const seen = new Map();
  const add = async (dir, source) => {
    let names = [];
    try {
      names = await readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (wallpaperName(name) !== name) continue;
      const file = path.join(dir, name);
      try {
        const info = await stat(file);
        if (!info.isFile()) continue;
        if (source !== 'user' && seen.has(name)) continue;
        seen.set(name, {
          file: name,
          source,
          bytes: info.size,
          mtime: Math.round(info.mtimeMs),
        });
      } catch {
        /* a file that vanished between readdir and stat is not a wallpaper */
      }
    }
  };
  await add(PACKAGED_WALLPAPERS_DIR, 'packaged');
  // Read the user folder last so a same-named dropped file overrides the set.
  await add(USER_WALLPAPERS_DIR, 'user');
  return [...seen.values()].sort((a, b) => a.file.localeCompare(b.file, 'zh-Hans-CN'));
}

/** Read a raw image body with a hard ceiling; never buffer an unbounded request. */
async function readUpload(req) {
  const declared = Number(req.headers?.['content-length'] ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
    const error = new Error('image too large');
    error.status = 413;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) {
      const error = new Error('image too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Import one image into the user wallpaper folder. */
async function uploadWallpaper(req, res) {
  try {
    const contentType = String(req.headers?.['content-type'] ?? '').toLowerCase();
    if (contentType !== '' && contentType !== 'application/octet-stream' && !contentType.startsWith('image/')) {
      sendJson(res, 415, { ok: false, error: 'only jpeg/png/webp images are accepted' });
      return;
    }
    const body = await readUpload(req);
    if (body.length === 0) {
      sendJson(res, 400, { ok: false, error: 'empty image body' });
      return;
    }
    const ext = detectImageExt(body);
    if (ext === null) {
      sendJson(res, 415, { ok: false, error: 'only jpeg/png/webp images are accepted' });
      return;
    }
    const file = safeUploadName(req.headers?.['x-dsh-glass-name'], ext);
    await writeFileAtomic(path.join(USER_WALLPAPERS_DIR, file), body, { mode: 0o644 });
    sendJson(res, 200, { ok: true, file, bytes: body.length });
  } catch (error) {
    sendJson(res, error?.status ?? 400, { ok: false, error: String(error?.message ?? error) });
  }
}

/**
 * Send one image, revalidating every time. The body is still a 304 when nothing
 * changed, so replacing wallpaper.jpg in place shows up on the next reload
 * instead of tomorrow, at the cost of one local header.
 */
function sendFile(req, res, file) {
  let info;
  try {
    info = statSync(file);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  if (!info.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  const etag = `W/"${info.size}-${Math.round(info.mtimeMs)}"`;
  if (req.headers?.['if-none-match'] === etag) {
    res.writeHead(304, { 'Cache-Control': 'no-cache', 'ETag': etag });
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'ETag': etag,
    'Last-Modified': info.mtime.toUTCString(),
    'Content-Length': info.size,
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(file);
  // A delete/rename between stat and open would otherwise emit an unhandled
  // 'error' on the stream and take the host process down with it.
  stream.on('error', (error) => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('read error');
    } else {
      res.destroy(error);
    }
  });
  res.on?.('close', () => stream.destroy());
  stream.pipe(res);
}

/**
 * Adopt the preferences and wallpapers left behind by the pre-6.0 name, once.
 *
 * Copy, never move: the old install may still be running while this starts, and
 * a failed upgrade must leave the source intact. The marker makes the copy a
 * one-time event, so a migrated wallpaper the user deletes later does not come
 * back on the next launch.
 *
 * @returns {number} how many files were adopted
 */
function migrateLegacyData() {
  if (existsSync(MIGRATION_MARKER)) return 0;
  let adopted = 0;
  try {
    if (!existsSync(STATE_FILE) && existsSync(LEGACY_STATE_FILE)) {
      copyFileSync(LEGACY_STATE_FILE, STATE_FILE);
      adopted += 1;
    }
  } catch {
    /* preferences are a convenience; a failed copy must not stop the theme */
  }
  try {
    if (existsSync(LEGACY_WALLPAPERS_DIR)) {
      mkdirSync(USER_WALLPAPERS_DIR, { recursive: true });
      for (const name of readdirSync(LEGACY_WALLPAPERS_DIR)) {
        if (wallpaperName(name) !== name) continue;
        const target = path.join(USER_WALLPAPERS_DIR, name);
        if (existsSync(target)) continue;
        try {
          copyFileSync(path.join(LEGACY_WALLPAPERS_DIR, name), target);
          adopted += 1;
        } catch {
          /* one unreadable image must not block the rest */
        }
      }
    }
  } catch {
    /* no legacy folder, or it is unreadable: nothing to adopt */
  }
  try {
    mkdirSync(path.dirname(MIGRATION_MARKER), { recursive: true });
    writeFileSync(
      MIGRATION_MARKER,
      `${new Date().toISOString()} adopted ${adopted} item(s) from ${LEGACY_ID}\n`,
    );
  } catch {
    /* copying is idempotent when the marker cannot be written */
  }
  return adopted;
}

export function apply(ctx) {
  // Create the drop folder before the first request so the settings text can
  // point at a directory that already exists.
  try {
    mkdirSync(USER_WALLPAPERS_DIR, { recursive: true });
  } catch (error) {
    ctx.logger?.warn?.(`dsh-glass-skin: cannot create ${USER_WALLPAPERS_DIR}: ${error?.message ?? error}`);
  }

  const adopted = migrateLegacyData();
  if (adopted > 0) {
    ctx.logger?.info?.(`dsh-glass-skin: adopted ${adopted} item(s) from ${LEGACY_ID}`);
  }

  ctx.inject(['webServer'], (scope) => {
    const webServer = scope.get('webServer');
    if (webServer === undefined) return;

    const disposers = [];
    const route = (routePath, handler) => {
      try {
        disposers.push(webServer.register({ kind: 'exact', path: routePath, handler }));
      } catch (error) {
        // One conflicting route must not stop the other two from mounting.
        ctx.logger?.warn?.(`dsh-glass-skin: route ${routePath} failed: ${error?.message ?? error}`);
      }
    };

    route('/api/dsh-glass-skin/assets', async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const rel = url.searchParams.get('f') ?? '';
        const file = assetRequest(rel);
        if (file === null || !existsSync(file)) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('not found');
          return;
        }
        sendFile(req, res, file);
      } catch (error) {
        if (!res.headersSent) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(String(error?.message ?? error));
        } else {
          res.destroy(error);
        }
      }
    });

    // One image in either wallpaper folder = one switchable theme. The directory
    // is read per request so a file dropped in while the app runs shows up after
    // the settings panel refreshes.
    route('/api/dsh-glass-skin/wallpapers', async (req, res) => {
      if (req.method === 'POST') {
        await uploadWallpaper(req, res);
        return;
      }
      try {
        try {
          mkdirSync(USER_WALLPAPERS_DIR, { recursive: true });
        } catch {
          /* listing will simply omit the user folder */
        }
        sendJson(res, 200, { walls: await listWallpapers() });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
      }
    });

    route('/api/dsh-glass-skin/state', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
      }
      try {
        const body = await readBody(req);
        if (body.op === 'get') {
          sendJson(res, 200, await readState());
          return;
        }
        if (body.op === 'set') {
          sendJson(res, 200, await mergeState(body.patch));
          return;
        }
        sendJson(res, 400, { ok: false, error: 'unknown op' });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String(error?.message ?? error) });
      }
    });

    scope.effect(() => () => {
      for (const dispose of disposers.splice(0)) {
        try {
          dispose();
        } catch {
          /* already gone */
        }
      }
    }, 'dsh-glass-skin: routes');
  });

  ctx.logger?.info?.(`dsh-glass-skin: routes mounted (state → ${STATE_FILE})`);
}
