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
- Layout = the user's grid (`gridCols×gridRows`) plus a pin level: grid → pinned → solo (`focused`). Pinning puts the
  video in cell 0 of the grid's pinned variant (`pinnedLayout`: 3×3→1+5, 4×3→1+8, 4×4→1+7, 5×4/6×6→1+11); grids smaller
  than 3×3 (2×2, 3×2) pin straight to solo. The 1×1 button is the solo pin. Enter/double-click step up, Esc steps down;
  clicking a small tile while pinned pins it instead. Unpinning returns the video to its original cell (`pinFrom`).
  `slots()` in `lib/layout.ts` is the single source of slot geometry for the DOM wall, the CRT compositor and click mapping.
- No right sidebar. The selected (or pinned) video's details + map sit at the top of the left sidebar
  (`components/deck/Sidebar.tsx`), above the channel guide. Theatre mode (`T`) hides the whole sidebar.
- CRT power on/off is a timed sequence (`powerOn` / `powerOff` in `lib/crt/renderer.ts`). In dev, set
  `window.__crtFx = { on: true, t: 0.2 }` to freeze a moment for inspection. GLSL: never call smoothstep with descending edges.
- i18n: `lib/i18n.ts` (en / zh-Hant). Primary language leads; the other language shows as secondary info wherever there is room.
  Feed OSD font is VT323 for Latin + Fusion Pixel 12px Monospaced TC (OFL, `@fontsource`) for Chinese.
- `src/pages/api/snap.ts` — same-origin relay for HKO photos (no CORS upstream). Allow-listed station codes only.

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
