# HK Monitor · 香港監察網

![HK Monitor video wall in CRT mode](public/og.jpg)

**A CCTV monitor for Hong Kong — channel-surf the city like a security control room.** 1,000+ public traffic cameras,
Observatory weather photos, radar and satellite, live news and Hong Kong YouTube — numbered as channels, tiled on a
CCTV video wall, patrolled automatically, and optionally shown on a full-colour CRT monitor.

## Why

Hong Kong publishes a remarkable amount of open data: live snapshots from every Transport Department camera, the
Observatory's weather cameras and radar, roadside journey-time boards, traffic news. Almost every app that uses it does
the same thing — drops pins on a map.

HK Monitor is a demonstration of **displaying open data creatively instead**: not as markers you click one at a time, but
as a *broadcast* you watch. Every feed becomes a channel with a number. You flip through them with a remote, tile them
on a wall, pin one to look closer, let the patrol sequence rotate through a district, and leave it running like the
monitors in a control room. The map is still there — a mini-map for whatever you're watching, and a map view of each
group — but it's supporting cast, not the whole show.

## What you can do

- **Channel-surf ~1,900 channels.** Traffic cameras (1001+), HKO weather (2xx), live data (radar, satellite, speed-map
  boards), HK live video (1xx), world live cams (3xx), news & finance (4xx), space (5xx), news recordings (6xx) and Hong
  Kong YouTube shows (3000+). Type a number on the keyboard or the on-screen remote to tune.
- **Near me.** Pick "Near me" and allow location: the wall fills with the 60 cameras and feeds closest to you, nearest
  first with distances, and the ticker leads with the weather at your nearest Observatory station. Your location stays
  on your device — it isn't saved, sent or put in shared links.
- **A video wall that fills any screen.** Pick a preview size; the wall shows as many as fit. Pin a feed to make it
  big (beside or above the previews, or full screen) — on desktop, tablet or phone.
- **Patrol sequences** like a real CCTV desk: roll one preview at a time, flip whole pages, or queue channels through
  the pinned slot.
- **CRT picture mode** — a WebGL colour CRT (curvature, phosphor masks, bloom, scanlines, static between channels,
  power-on / off) with several looks, from a Trinitron monitor to green / amber phosphor. Curvature can be turned off.
- **Groups for everything:** regions and districts, topics (Victoria Harbour, Airport & HZMB, Islands, Tunnels,
  Horse racing, Taxi cams…), Hong Kong news, YouTube content (entertainment, tech, crime & mystery, movies) and your
  own groups and favourites. Every group has a map view; search is fuzzy, in English and Chinese.
- **Live and replay.** YouTube channels that broadcast in bulletins (Cable News, RTHK, HK01) or stream occasionally
  are *followed*: live when they're on air, recent recordings otherwise — and recent recordings get their own channels.
- **A news ticker** with Observatory warnings, the current weather, forecast and outlook (with weather icons),
  temperatures around Hong Kong and where it's raining, TD special traffic news and RTHK headlines — mixed into a new
  order on every visit, and part of the picture in CRT mode.
- **Autoplay on or off** — with it off, YouTube previews show a still until you pick one; at most eight previews play
  at once, and sound follows the pinned (or selected) video.
- **Share the exact view** — every setting is in the URL (group, wall, pin, CRT look, language…).
- **English / 繁體中文**, with the other language shown as secondary information wherever there's room.
- Keyboard, on-screen remote, touch gestures (swipe, pinch, long-press) and standard gamepads.
- **Works offline and installs as an app.** With no connection the wall still opens and every camera shows the last
  picture it had (marked stale); YouTube needs a connection.

## Data sources

All open, keyless sources:

- **Transport Department** via [DATA.GOV.HK](https://data.gov.hk): traffic snapshot images (1,013 cameras, ~2 min),
  speed-map panels, special traffic news.
- **Hong Kong Observatory**: weather photos, radar (64 / 128 / 256 km), satellite imagery, weather warnings, current
  weather, local forecast and outlook, station temperatures and district rainfall.
- **RTHK** news headlines (RSS).
- **YouTube** live streams and channel uploads — played through YouTube's own embedded player. Streams and videos
  belong to their owners; channels that don't allow playback on other sites aren't included.
- Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

## Keys

| Key | Action |
| --- | --- |
| Arrows | Select a tile |
| Enter / Esc | Pin up / step back (pinned → full screen) |
| PgUp / PgDn | Channel up / down |
| `+` / `-` | Next / previous camera group |
| `[` / `]` | Previous / next page |
| `0`–`9` | Tune to a channel number |
| `L` / Shift+`L` | Bigger / smaller previews |
| `P` | Patrol on / off |
| `C` / `V` | CRT on / off, cycle picture mode |
| `T` | Show / hide the sidebar |
| `M` | Sound |
| `G` | Mini-map |
| `*` | Favourite |
| `F` | Full screen |

## Development

Astro + React, TypeScript, deployed on Vercel.

```sh
npm install
npm run dev        # dev server
npm run check      # type check
npm run build      # production build
npm run data:td    # refresh the Transport Department camera list
```

Architecture notes for contributors are in [AGENTS.md](AGENTS.md).
