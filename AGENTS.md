# HK CCTV

Channel-surf Hong Kong's public cameras like a security control room, with an optional colour-CRT monitor mode.
Astro 7 + React 19 (one `client:only` island), TypeScript strict, deployed to Vercel via `@astrojs/vercel`.

## Architecture

- `src/lib/store.ts` — the single viewing engine (layout n×m, cells, selection, focus, patrol, mode). Both UIs drive it.
- `src/lib/channels.ts` — every feed as a numbered `Channel`: 1xx YouTube live, 2xx HKO weather, 1001+ TD traffic.
- `src/lib/snapshots.ts` — one poller per visible feed; fetches blobs so the DOM gets object URLs and the CRT gets ImageBitmaps (no tainted canvas).
- Console mode: `components/monitor/*` (DOM wall) + `components/deck/*` (guide, focus panel with mini-map).
- CRT is a picture mode of the same viewer (no device shell): `components/crt/CrtScreen.tsx` replaces the DOM wall in the stage.
  `lib/crt/compositor.ts` draws the wall + OSD into a 2D canvas, `lib/crt/renderer.ts` runs it through a WebGL colour-CRT
  shader (`lib/crt/presets.ts` holds the looks). Keep curvature gentle; the compositor insets the wall so nothing clips.
  YouTube can't be drawn into WebGL, so a focused live stream is an iframe over the canvas with CSS-only CRT effects.
- Cells are 4:3 (`lib/layout.ts`), matching TD's 320×240 snapshots; 16:9 feeds letterbox, never crop.
- Layout is responsive and always fills the screen (`lib/arrange.ts`, one engine for the DOM wall, the CRT compositor,
  CRT click mapping and arrow-key navigation via `publishGeometry`/`neighbour`). The user sets a **preview size**
  (`previewSize`, px of tile width; slider / L, Shift+L); the wall shows as many 4:3 previews as fit and reports that
  capacity back (`actions.setCapacity`), so paging / patrol move by one screenful.
- Pin levels: previews → pinned → full (`focused`). Pinned has a size, `pinMode`: "side" (block top-left, previews right
  + below — the classic 1+N) or "wide" (block as wide as fits, previews either side + below). Previews and the pinned
  block share one regular grid so every preview is the same size and aligned. Enter/double-click step up, Esc down;
  clicking a small tile while pinned pins it instead; unpinning returns the video to its original cell (`pinFrom`).
  Switching camera group keeps the pin only if the pinned channel is in the new group; otherwise the pin is released
  (same rule when restoring saved state). The wall never shows a channel twice.
- No right sidebar. The selected (or pinned) video's details + map sit at the top of the left sidebar
  (`components/deck/Sidebar.tsx`), above the channel guide. Theatre mode (`T`) hides the whole sidebar.
- Camera groups (`buildGroups` in `lib/channels.ts`): feed types, topic groups (`TOPICS`: curated keys + TD-name regex /
  predicate, e.g. Islands Watch, Lantau), and location groups. Weather cameras and located YouTube streams take the
  district/region of the nearest TD camera (`locate`), so location groups mix all feed types. Users can also make
  their own groups (`customGroups`, groupId "custom:<id>"); a feed may be in any number of groups.
- Pin / single-view controls are one component and one style everywhere (`components/PinButtons.tsx`, `.icon-btn`):
  neutral = available action, yellow "on" = active for that video.
- The sidebar remote (`components/deck/Remote.tsx`) shares direct channel entry with the keyboard: the store owns
  `entry` and the auto-tune timer (`typeDigit` / `commitEntry` / `clearEntry`); keyboard presses light the matching key.
- CRT power on/off is a timed sequence (`powerOn` / `powerOff` in `lib/crt/renderer.ts`). In dev, set
  `window.__crtFx = { on: true, t: 0.2 }` to freeze a moment for inspection. GLSL: never call smoothstep with descending edges.
- i18n: `lib/i18n.ts` (en / zh-Hant). Primary language leads; the other language shows as secondary info wherever there is room.
  Feed OSD font is VT323 for Latin + Fusion Pixel 12px Monospaced TC (OFL, `@fontsource`) for Chinese.
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
