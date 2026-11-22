# HK CCTV

Channel-surf Hong Kong's public cameras like a security control room, with an optional colour-CRT monitor mode.
Astro 7 + React 19 (one `client:only` island), TypeScript strict, deployed to Vercel via `@astrojs/vercel`.

## Architecture

- `src/lib/store.ts` — the single viewing engine (layout n×m, cells, selection, focus, patrol, mode). Both UIs drive it.
- `src/lib/channels.ts` — every feed as a numbered `Channel`: 1xx HK YouTube live, 2xx HKO weather, 3xx world YouTube live ("World live" group), 4xx 24/7 news & finance, 5xx space ("Space" group) ("News & finance" picker section: by language, Taiwan, Asia-Pacific, international, finance), 1001+ TD traffic. Stream numbers are fixed in `data/streams.ts`.
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
- Pin levels: previews → pinned → full (`focused`). Pinned has a size, `pinMode`: "side" (block top-left, previews right
  + below — the classic 1+N) or "wide" (block as wide as fits, previews either side + below). Previews and the pinned
  block share one regular grid so every preview is the same size and aligned. Enter/double-click step up, Esc down;
  clicking a small tile while pinned pins it instead; unpinning returns the video to its original cell (`pinFrom`).
  **Requirement:** a preview is never as large as the pinned video — `arrange` checks every pinned layout (each
  preview ≤ half the pinned width and shorter) and shrinks previews until it holds; "side" needs at least a 2×2 block.
  Switching camera group keeps the pin only if the pinned channel is in the new group; otherwise the pin is released
  (same rule when restoring saved state). The wall never shows a channel twice.
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
- News ticker: `src/pages/api/news.ts` relays fixed upstreams only (HKO warnsum JSON, TD special traffic news XML,
  RTHK local RSS — RTHK has no CORS) as one JSON list per language; `lib/news.ts` polls it (3 min) for both views.
  The DOM ticker (`components/deck/NewsTicker.tsx`) sits at the top of the viewer column (never over the sidebar);
  in CRT mode `crtLayout` / the compositor reserve `CRT_NEWS_H` for it. Flat vs curved is decided in one place,
  `lib/crt/flat.ts`: every YouTube tile (live or off air) is flat — players can't be warped — and is drawn, with its
  OSD, on a flat overlay canvas above the players (`drawScreen(..., over)`); the ticker curves (shader) unless a
  YouTube tile is in the top row, then it is a flat DOM strip (`tickerCurves`).
- AUTOPLAY toggle (`autoplay`, URL `autoplay=0`): off = YouTube previews show a still (refreshed each liveness
  check) with ▶; the pinned / full-view video always plays (DOM `allowVideo`, CRT `videoCells`).
- CURVE toggle (`crtCurve`, URL `curve=0`): off = every CRT effect but no barrel distortion; `crtCurvature()` returns 0
  (set via `setCrtCurve`, kept in step by CrtScreen), and the ticker always goes through the shader.
  Toggle: NEWS (`news`, URL `news=0`).
- Maps fly between locations (`flyView` / `tilesForView` in `lib/maptiles.ts`, used by `MiniMap` and the CRT map
  inset): pan for short hops, zoom out–pan–in for long ones; the pin rides with the map.
- `src/pages/api/snap.ts` — same-origin relay for HKO photos (no CORS upstream). Allow-listed station codes only.

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
