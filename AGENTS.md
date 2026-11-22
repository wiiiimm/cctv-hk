# HK Monitor · 香港監察網

Channel-surf Hong Kong's public cameras like a security control room, with an optional colour-CRT monitor mode.
Astro 7 + React 19 (one `client:only` island), TypeScript strict, deployed to Vercel via `@astrojs/vercel`.

## Architecture

- `src/lib/store.ts` — the single viewing engine (layout n×m, cells, selection, focus, patrol, mode). Both UIs drive it.
- `src/lib/channels.ts` — every feed as a numbered `Channel`: 1xx HK YouTube live, 2xx HKO weather, 6xx recorded-news slots, 3xx world YouTube live ("World live" group), 4xx 24/7 news & finance, 5xx space ("Space" group) ("News & finance" picker section: by language, Taiwan, Asia-Pacific, international, finance), 1001+ TD traffic. Stream numbers are fixed in `data/streams.ts`.
- `src/lib/snapshots.ts` — one poller per visible feed; fetches blobs so the DOM gets object URLs and the CRT gets ImageBitmaps (no tainted canvas).
- Console mode: `components/monitor/*` (DOM wall) + `components/deck/*` (guide, focus panel with mini-map).
- CRT is a picture mode of the same viewer (no device shell): `components/crt/CrtScreen.tsx` replaces the DOM wall in the stage.
  `lib/crt/compositor.ts` draws the wall + OSD into a 2D canvas, `lib/crt/renderer.ts` runs it through a WebGL colour-CRT
  shader (`lib/crt/presets.ts` holds the looks). Keep curvature gentle; the compositor insets the wall so nothing clips.
  YouTube can't be drawn into WebGL, so a focused live stream is an iframe over the canvas with CSS-only CRT effects.
- Cells are about 4:3 (`lib/layout.ts`), matching TD's 320×240 snapshots; `arrange` lets them flex ±15% (`FLEX`) so the
  grid fills the stage exactly. 16:9 feeds letterbox, never crop. A group smaller than the grid is re-fitted to its
  count (bigger tiles); `capacity` still reports the full grid so paging / patrol move by one screenful.
- Layout is responsive and always fills the screen (`lib/arrange.ts`, one engine for the DOM wall, the CRT compositor,
  CRT click mapping and arrow-key navigation via `publishGeometry`/`neighbour`). The user sets a **preview size**
  (`previewSize`, px of tile width; slider / L, Shift+L); the wall shows as many 4:3 previews as fit and reports that
  capacity back (`actions.setCapacity`), so paging / patrol move by one screenful.
- **Hard cap: 16 previews per screen** (`MAX_PREVIEWS` in `lib/arrange.ts`, plus the pinned video). Over it, the
  unpinned wall takes the ≤16-cell grid covering the most of the stage (`cappedGrid`); pinned layouts enlarge the
  previews in small steps ("side" falls back to "wide" on tall phones). Every preview on screen may then autoplay
  (`MAX_PLAYING_PREVIEWS` = 16): preview players start one by one (`hooks/usePlayerSlot.ts`, ~450 ms apart, to avoid
  YouTube refusing a burst) and play at reduced quality — YouTube picks quality from player size, so `.lowq` lays the
  preview player out at half size and scales it ×2. Pinned / full-view / selected players are full size.
- Pin levels: previews → pinned → full (`focused`). Pinned has a size, `pinMode`: "side" (block top-left, previews right
  + below — the classic 1+N) or "wide" (block as wide as fits, previews either side + below). Previews and the pinned
  block share one regular grid so every preview is the same size and aligned. Enter/double-click step up, Esc down;
  clicking a small tile while pinned pins it instead; unpinning returns the video to its original cell (`pinFrom`).
  **Requirement:** a preview is never as large as the pinned video — `arrange` checks every pinned layout (each
  preview ≤ half the pinned width and shorter) and shrinks previews until it holds; "side" needs at least a 2×2 block.
  Switching camera group never changes the layout: with something pinned (or in full view), the pinned slot switches to
  the new group's first channel and the previews fill with the rest. (Restoring saved state still releases a saved pin
  that isn't in the saved group.) The wall never shows a channel twice.
- Phones / small tablets: below 1100px the top bar is one row (☰, brand, PATROL, CRT, ⋯ sheet with the rest);
  below 760px `MobileBar` replaces the status bar (camera actions or group + pager); no bottom bar under 500px
  high. Preview badges become dots below 760px (not on the pinned / full tile). CRT curvature is 60% of the preset on desktop, 30% on phones
  (`crtCurvature`). Breakpoints re-render live via `useMedia`.
- Shapes: `feedAspect` (TD 4:3; HKO 720×405 and YouTube 16:9). Groups that are all 16:9 get 16:9 cells (`wallAspect`);
  the pinned / full picture uses its own shape (`bigAspect`). "Wide" pin on short stages puts the picture left and
  previews right. Portrait full view shows the camera panel under the picture (DOM wall only).
- Touch (`hooks/useWallGestures.ts`, on the stage, DOM + CRT): swipe ←/→ pages (channel in full view), swipe ↓ steps
  down a pin level, long-press selects + opens the details, pinch sets preview size. `actions.tap`: on touch, tapping
  the selected preview pins it and tapping the pinned video goes full; finger double-taps are ignored. Landscape phone
  full view hides the top bar after 3s.
- The view is in the URL (`lib/urlState.ts`): every control round-trips through the query string (`encodeView` /
  `applyView`), kept in step with `replaceState`; a link overrides saved state on load. Cameras are channel numbers;
  a custom group / favourites travel as `gc` + `gn` and are added to the receiver's groups. SHARE copies / shares it.
- No right sidebar. The selected (or pinned) video's details + map sit at the top of the left sidebar
  (`components/deck/Sidebar.tsx`), above the channel guide. Theatre mode (`T`) hides the whole sidebar.
- Camera groups (`buildGroups` in `lib/channels.ts`): feed types, topic groups (`TOPICS`: curated keys + TD-name regex /
  predicate, e.g. Islands Watch, Lantau), and location groups. Weather cameras and located YouTube streams take the
  district/region of the nearest TD camera (`locate`), so location groups mix all feed types. Users can also make
  their own groups (`customGroups`, groupId "custom:<id>"); a feed may be in any number of groups.
- Keys: PgUp / PgDn change channel; + / = and - / _ (number pad + / − too, and , / .) step camera groups in the
  picker's order (`actions.groupStep`).
- Pin + the three pinned sizes (wide / side / full) act on the camera, so their home is the sidebar camera panel
  (not the top bar, which holds wall-wide controls). The tile corner keeps a small pin shortcut.
- Pin / single-view controls are one component and one style everywhere (`components/PinButtons.tsx`, `.icon-btn`):
  neutral = available action, yellow "on" = active for that video.
- The sidebar remote (`components/deck/Remote.tsx`) shares direct channel entry with the keyboard: the store owns
  `entry` and the auto-tune timer (`typeDigit` / `commitEntry` / `clearEntry`); keyboard presses light the matching key.
- CRT power on/off is a timed sequence (`powerOn` / `powerOff` in `lib/crt/renderer.ts`). In dev, set
  `window.__crtFx = { on: true, t: 0.2 }` to freeze a moment for inspection. GLSL: never call smoothstep with descending edges.
- i18n: `lib/i18n.ts` (en / zh-Hant). Primary language leads; the other language shows as secondary info wherever there is room.
  Feed OSD font is VT323 for Latin + Fusion Pixel 12px Monospaced TC (OFL, `@fontsource`) for Chinese.
- News ticker: `src/pages/api/news.ts` relays fixed upstreams only (HKO warnsum JSON, HKO current weather `rhrread` + local forecast `flw` → kind "weather" with an HKO icon code drawn
  by `lib/wxIcons.ts` in both the DOM and CRT tickers, TD special traffic news XML,
  RTHK local RSS — RTHK has no CORS) as one JSON list per language; `lib/news.ts` polls it (3 min) for both views.
  The DOM ticker (`components/deck/NewsTicker.tsx`) sits at the top of the viewer column (never over the sidebar);
  in CRT mode `crtLayout` / the compositor reserve `CRT_NEWS_H` for it. Flat vs curved is decided in one place,
  `lib/crt/flat.ts`: every YouTube tile (live or off air) is flat — players can't be warped — and is drawn, with its
  OSD, on a flat overlay canvas above the players (`drawScreen(..., over)`); the ticker curves (shader) unless a
  YouTube tile is in the top row, then it is a flat DOM strip (`tickerCurves`).
- YouTube feeds carry estimated positions (`lat`/`lon` in `data/streams.ts`, always approx): the named place, else the
  broadcaster's base / the country's main city; feeds with no single place (ISS, world rotations) have none. Only HK
  feeds take the nearest HK district (`locate`); world / news / space keep their country / place. In CRT the map inset
  sits bottom-right on a YouTube video (top-left otherwise).
- Followed channels (`follow: <channel id>` on a stream, e.g. 452 Cable News / HOY 78): for channels that stream
  bulletins as new videos. `/api/ytlive?ch=` (allow-listed, cached 60s in-process and at the CDN) reads the channel's
  /live page and returns the current live video id; snapshots store it as `Snap.videoId`, which embeds / stills use.
  When nothing (playable) is live it replays the channel's uploads from the last 48 hours (official RSS) filtered by
  `replayMatch`,
  as a looping playlist with a REPLAY badge — also when a live stream is blocked here. `liveOnly` (webcams) never
  replays: OFF AIR instead. Used for RTHK / Cable News, HOY programmes, taxi dashcams, a harbour cam, racing. Racing (4xx, `racing: true`)
  is never in the news groups: region "Racing", its own "Horse racing" topic group.
- Recorded news (bank 6xx, `RECORDING_SOURCES`): numbered slots (Cable 611–620, RTHK 621–630; 601–610 retired with TVB) that hold
  a followed channel's Nth most recent recording from the same news / last-48h list (`Channel.recIndex`). Tiles show
  the recording's title (`Snap.title`) and air time; empty slots are OFF AIR. Non-news sources (`replayDays: 0`) live in
  3000+, 40 numbers each ([live channel] + up to 30 slots, 10 for studio trailers) and use a full page of the channel's
  Videos tab (~30, any age, members-only skipped) merged with its feed. Group flags: `group` (own Topics group),
  `entertainment` → "Hong Kong entertainment" (+ HOY 116), `tech` → "Hong Kong tech", `crime` → "Crime & mystery",
  `film` → "Movies" (studios filtered to trailers via `replayMatch`). JFFLive is a single live-only channel. All these
  groups sit in the picker's "YouTube content / YouTube 內容" section. Group "Hong Kong news recordings / 香港新聞重溫", right under "Hong Kong news".
- Channel list rows for video channels show the state (LIVE / REPLAY / OFF AIR / N/A) via `useListStatus`, which
  never starts polling: on-wall snapshot, else the followed channel's cached lookup, else a 24/7 stream is assumed live.
- `noEmbed` (unused now; TVB 454 / 601–610 were removed for it): for an owner that refuses playback on other sites
  (player error 150) although YouTube's data says embeddable — tiles show the still + "YouTube ↗" link, never a player. Any other player
  error also marks a video unavailable and is logged to the console as `[yt] error <code> <channel>`.
- YouTube off-air reasons (`Snap.reason`): "offair" = not broadcasting (OFF AIR); "blocked" = the owner won't let it
  play here (UNAVAILABLE + "May be region-restricted").
- Paging under a pin sets `switchedCell` -2: the compositor flashes static on each preview only (canvas noise, YouTube
  previews via their CSS burst), no veil, the pinned video untouched. Dev aid: `window.__crtPageSw = true` holds it.
- CRT veil: the live layers (players, flat overlay, flat ticker) hide during power-on (mount / refresh / entering CRT)
  and whole-wall changes (page, group) so the warm-up / static shows, then fade in; picture-mode changes don't veil.
- AUTOPLAY toggle (`autoplay`, URL `autoplay=0`): off = YouTube previews show a still (refreshed each liveness
  check) with ▶; the pinned / full-view and the selected video always play; sound goes to the pinned / full-view video, or with nothing pinned to the selected one (MUTED still wins) (DOM `allowVideo`, CRT `videoCells`).
- CURVE toggle (`crtCurve`, URL `curve=0`): off = every CRT effect but no barrel distortion; `crtCurvature()` returns 0
  (set via `setCrtCurve`, kept in step by CrtScreen), and the ticker always goes through the shader.
  Toggle: NEWS (`news`, URL `news=0`).
- Maps fly between locations (`flyView` / `tilesForView` in `lib/maptiles.ts`, used by `MiniMap` and the CRT map
  inset): pan for short hops, zoom out–pan–in for long ones; the pin rides with the map.
- Map inset on the pinned / full-view feed: CRT always (top-left, or bottom-right just above the pin buttons on a
  YouTube video); the DOM wall shows it (`TileMap` in `components/MiniMap.tsx`) when the sidebar is hidden (theatre,
  or ≤1180px). A click folds it to an 80px box and back (`mapMini`, persisted, shared by both; CRT hit-test via
  `mapInsetRect`).
- Himawari satellite channels 255–258 (in Live data and "Hong Kong weather / 香港天氣", the renamed `kind:hko` group):
  255 JMA true colour, tiles stitched client-side (`lib/satellite.ts`, CORS open); 256–258 NASA GIBS WMS (IR / air
  mass + coastlines, `{gibsTime}` ≈ now − 40 min; a missing or not-yet-published slot — XML error or mostly black —
  steps back 10 min).
- Live data (`data/live-data.ts`, group "Live data / 實時數據"): HKO radar 64/128/256 km (251–253) and the global
  satellite image (254) via `/api/snap?hko=RAD064|RAD128|RAD256|SATASIA` (the relay finds the newest time-named image,
  stepping back); TD speed-map panels (261–265) loaded directly via `Channel.src` (`{lang}` → tc / en). Radar / satellite are also in
  "HKO weather"; the panels in "Traffic" and their HK district / region groups.
- Near me (`groupId "nearby"`, `lib/geo.ts`): asks for location only when chosen (or silently if already granted);
  the position stays in memory (never persisted, never in the URL — `g=nearby` gives the receiver their own). Group =
  the 60 nearest channels with a position (approximate positions ranked +3 km). Geolocation needs https or localhost
  (not the Tailscale http address). Ticker: `/api/news` also returns per-station temperatures and district rainfall
  (`places`); `lib/news.ts` composes on the device — warnings first, "Near you · <nearest station>" first and every 6
  items, 4 random other stations per refresh, raining districts, everything else shuffled by a per-page-load seed.
- `src/pages/api/snap.ts` — same-origin relay for HKO photos, radar and satellite (no CORS upstream). Allow-listed codes only.

## Road speeds and burned-in readings

- `/api/news` also reads TD's road-network segment speeds (`irnAvgSpeed-all.xml`, CORS open) and joins them with
  `src/data/road-segments.json` (segment id → [English, Chinese, length m, lat, lon]; built by `npm run data:roads` =
  `scripts/build-road-segments.py` from "Road Network (2nd Generation)" CENTERLINE: ROUTE_ID = segment id; "-99" names
  fall back to alias / route number). Output: `jams` (congested stretches < 20 km/h, same road within ~2 km merged,
  worst first) and `camRoads` (each TD camera's segment: the road it's named after within 400 m, else the nearest within
  180 m → [en, zh, km/h]).
- Ticker (`lib/news.ts`): the worst 5 jams citywide (kind "jam"); with the Near me group, jams within 3 km lead and
  repeat every 3 items with the local weather.
- `lib/burnin.ts` decides what is burned into a feed under its channel label (DOM `.osd-burn`, CRT `burnLine`, sidebar
  `.panel-burn`): road speed (TD cameras) + temperature / rain of the nearest station / district (any HK feed); the
  pinned view adds the station name and congestion within 1.5 km. Readings come from the same poll as the ticker
  (`roadWeather()`), kept alive by Tiles / CrtScreen even with NEWS off.

## Offline / PWA

- `public/sw.js` (production builds only — `<meta name="service-worker">` is "on" when PROD; modelled on midi-mixer):
  installs the app shell by reading `/` and following its `_astro` bundles (JS imports, CSS fonts); pages are
  network-first (4s) with the cached shell offline; `_astro` cache-first. "Last picture" caches: TD / HKO / radar /
  speed-map / YouTube thumbnails are network-first and keyed without the `t` cache-buster, so offline every tile shows
  its last image (age stamp goes amber); OSM tiles cache-first; `/api/news` and `/api/ytlive` network-first; caches are
  size-capped. Bump `VERSION` in sw.js when the caching logic changes.
- `src/lib/pwa.ts` registers it, offers "A new version is ready → Reload", and shows offline / online notices via
  `lib/toast.ts` (`notify`, rendered by `components/ToastView.tsx`). Installable: `manifest.webmanifest` + icons.

## Design tokens

- Chrome (top bar, sidebar, status bar) is styled from the tokens at the top of `src/styles/global.css`: surfaces
  (`--well` < `--panel` < `--panel-2` < `--panel-3`), hairlines (`--line*`), text (`--text` / `--muted` / `--dim`),
  accents (`--sel` yellow = active, `--rec` red = recording / on air, `--entry` green = channel entry), `--r` radii,
  `--ctl-h` (every control is 28px tall), `--sans` for UI text and `--mono` for numbers.
- Buttons share one base rule (`.icon-btn, .pill, .btn, .rm-key, ...`); `.pill.toggle` adds a status lamp.
- The player (`.stage`, wall / OSD / CRT rules) pins its own font and greys and does not follow the chrome tokens.

## Data sources

- TD traffic cameras: list built by `npm run data:td` into `src/data/td-cameras.json`; images `https://tdcctv.data.one.gov.hk/{KEY}.JPG` (CORS open, ~2 min).
- HKO weather photos: codes in `src/data/hko-stations.ts`; served through `/api/snap?hko=CODE`.
- YouTube live: curated `src/data/streams.ts`; liveness probed via `i.ytimg.com/vi/{id}/hqdefault_live.jpg`. IDs die — replace them.
- Map tiles: OpenStreetMap standard tiles (attribution required, light use only), darkened client-side.

## Constraints

- No code from Cyruschu430/hk-city-monitor (AGPL) or stealth-factory/portable-gaming-device (PolyForm-NC). Reference only.
- Keep the CRT optional and full-colour; the console view must work without WebGL.

## Development

`npm run dev` (listens on all interfaces, any Host — reachable over Tailscale). `npm run check` for types, `npm run build` for Vercel output.
Astro 7 docs: https://docs.astro.build
