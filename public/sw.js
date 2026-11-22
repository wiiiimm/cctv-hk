'use strict';
// HK Monitor service worker (modelled on midi-mixer's): an offline app shell, plus "last picture" caches so that with no
// connection the wall still opens and every camera / weather / data tile shows the last image it had (the tile's age
// stamp turns amber as usual). Live YouTube can't work offline; those tiles go OFF AIR.
const VERSION = 'v3';
const SHELL = 'shell-' + VERSION;
const MEDIA = 'media'; // last snapshot per camera / photo / radar / panel / thumbnail (kept across versions)
const TILES = 'tiles-' + VERSION; // OpenStreetMap tiles already seen (always stored as readable CORS responses)
const DATA = 'data'; // news ticker / followed-channel lookups
const FONTS = 'fonts'; // Google Fonts CSS + files
const CAPS = { [MEDIA]: 2500, [TILES]: 1500, [DATA]: 200, [FONTS]: 60 };

const toUrl = (path) => new URL(path, self.registration.scope).href;
const CORE = ['./', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'og.jpg'].map(toUrl);

// ---- install: the page, then every hashed bundle it uses (found by reading the page and following imports) ----
async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
  return response.text();
}

async function bundleUrls() {
  const urls = new Set();
  const html = await fetchText(toUrl('./'));
  for (const [, src] of html.matchAll(/(?:src|href|component-url|renderer-url|before-hydration-url)="([^"]*\/_astro\/[^"]+)"/g)) urls.add(toUrl(src));
  const queue = [...urls];
  while (queue.length) {
    const url = queue.pop();
    if (url.endsWith('.css')) {
      // Fonts referenced by the stylesheet (woff2 only: every browser we support reads it).
      const css = await fetchText(url);
      for (const [, font] of css.matchAll(/url\((\/_astro\/[^)]+\.woff2)\)/g)) urls.add(toUrl(font));
      continue;
    }
    if (!url.endsWith('.js')) continue;
    const code = await fetchText(url);
    for (const [, dep] of code.matchAll(/(?:from|import)\s*\(?\s*["'`](\.{1,2}\/[^"'`]+\.js)["'`]/g)) {
      const resolved = new URL(dep, url).href;
      if (!urls.has(resolved)) {
        urls.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return [...urls];
}

async function refreshShell() {
  const cache = await caches.open(SHELL);
  const bundles = await bundleUrls();
  const store = async (url) => {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
    await cache.put(url, response);
  };
  // The app can't start offline without every bundle, so those are required; the rest is best effort.
  await Promise.all([Promise.all(bundles.map(store)), Promise.allSettled(CORE.map(store))]);
}

self.addEventListener('install', (event) => event.waitUntil(refreshShell()));

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('shell-') && key !== SHELL) await caches.delete(key);
        // Old tile caches could hold opaque copies (see corsFirst); drop them.
        if ((key === 'tiles' || key.startsWith('tiles-')) && key !== TILES) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

// ---- requests ----
const MEDIA_HOSTS = ['tdcctv.data.one.gov.hk', 'i.ytimg.com', 'gibs.earthdata.nasa.gov'];
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const same = url.origin === location.origin;

  if (same && request.mode === 'navigate') return event.respondWith(networkFirst(request, SHELL, 4000, toUrl('./')));
  if (same && url.pathname.startsWith('/_astro/')) return event.respondWith(cacheFirst(request, SHELL));
  // Live pictures: always try the network (they change every minute or two); offline, the last one we had.
  if ((same && url.pathname === '/api/snap') || MEDIA_HOSTS.includes(url.hostname) || (url.hostname === 'resource.data.one.gov.hk' && url.pathname.startsWith('/td/jss/')))
    return event.respondWith(networkFirst(request, MEDIA, 10000));
  // JMA Himawari: the scan-time list is network-first (offline it points at tiles we already have), tiles cache-first.
  if (url.hostname === 'www.jma.go.jp' && url.pathname.startsWith('/bosai/himawari/'))
    return event.respondWith(url.pathname.endsWith('.json') ? networkFirst(request, DATA, 10000) : cacheFirst(request, MEDIA));
  if (same && (url.pathname === '/api/news' || url.pathname === '/api/ytlive')) return event.respondWith(networkFirst(request, DATA, 10000));
  if (url.hostname === 'tile.openstreetmap.org') return event.respondWith(corsFirst(request, TILES));
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return event.respondWith(staleWhileRevalidate(request, FONTS));
  if (same) return event.respondWith(staleWhileRevalidate(request, SHELL));
});

/** Cache key without the cache-busting `t` parameter, so the newest picture replaces the last one. */
function keyOf(request) {
  const url = new URL(request.url);
  url.searchParams.delete('t');
  url.searchParams.delete('TIME'); // NASA GIBS: the newest picture replaces the last one
  return url.href;
}

async function put(name, key, response) {
  try {
    const cache = await caches.open(name);
    await cache.put(key, response);
    if (CAPS[name] && Math.random() < 0.05) trim(name, CAPS[name]);
  } catch (error) {
    console.warn('cache put failed', error);
  }
}

/** Keep a cache under its cap by dropping the oldest entries (insertion order). */
async function trim(name, cap) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - cap))) await cache.delete(key);
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Opaque (no-cors) responses are fine for tiles / images drawn by <img>.
  if (response.ok || response.type === 'opaque') await put(name, request, response.clone());
  return response;
}

/**
 * Map tiles are used two ways: as <img> (the sidebar / tile maps — a no-cors request) and drawn into the CRT canvas
 * (crossOrigin="anonymous" — a CORS request). An opaque copy cached from the first can't answer the second (the image
 * fails, so the CRT map stayed empty), so tiles are always fetched and stored as CORS responses (OSM allows it), which
 * answer both.
 */
async function corsFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request.url);
  if (hit && hit.type !== 'opaque') return hit;
  const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  if (response.ok) await put(name, request.url, response.clone());
  return response;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request, { ignoreSearch: name === SHELL });
  const update = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === 'opaque') await put(name, request, response.clone());
      return response;
    })
    .catch(() => hit || new Response('Offline', { status: 503 }));
  return hit || update;
}

async function networkFirst(request, name, timeout, fallbackUrl) {
  const key = keyOf(request);
  try {
    const response = await Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))]);
    if (response.ok || response.type === 'opaque') {
      await put(name, key, response.clone()); // finish the write before responding, or the worker can stop mid-write
      return response;
    }
    return (await (await caches.open(name)).match(key)) || response;
  } catch {
    const cache = await caches.open(name);
    const hit = (await cache.match(key)) || (fallbackUrl && (await cache.match(fallbackUrl)));
    return hit || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}
