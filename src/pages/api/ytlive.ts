import type { APIRoute } from "astro";
import { followedChannels } from "../../data/streams";

export const prerender = false;

// Current live video of a YouTube channel that streams bulletins (a new video id each time) rather than one 24/7
// stream. Browsers can't read youtube.com pages (no CORS), so this resolves it server-side from the channel's
// /live page. Only channels listed in data/streams.ts (`follow`) are accepted, so it can't be used as an open proxy.
// Also returns `recent`: the channel's latest uploads (videos and past streams, from the official RSS feed) filtered by
// its `replayMatch`, which the client replays as a playlist when nothing is live.
const CHANNELS = new Map(followedChannels().map((c) => [c.id, c]));
const cache = new Map<string, { at: number; body: string }>();
// The CDN keeps an answer for 60s (one upstream lookup per minute per channel, however many viewers); the in-process
// cache is shorter so the two don't stack into a long delay when a stream starts or ends.
const TTL = 30_000;
/** Only uploads from the last 48 hours are replayed. */
const REPLAY_WINDOW_MS = 48 * 3600_000;

export const GET: APIRoute = async ({ url }) => {
  const ch = url.searchParams.get("ch") ?? "";
  const conf = CHANNELS.get(ch);
  if (!conf) return new Response("unknown channel", { status: 400 });
  const hit = cache.get(ch);
  if (hit && Date.now() - hit.at < TTL) return json(hit.body);
  let videoId: string | null = null;
  let liveTitle: string | null = null;
  let live = false;
  try {
    const res = await fetch(`https://www.youtube.com/channel/${ch}/live`, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; cctv-hk/0.1)",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    // Live now: the page is the stream's watch page (canonical watch?v=…) and says isLive. Otherwise it's the channel.
    const canonical = html.match(
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/,
    );
    // A scheduled stream that hasn't started also lands here (isLive, but isUpcoming / LIVE_STREAM_OFFLINE): not live.
    // Likewise a stream that has just ended can still be what /live points at for a while: its broadcast details say
    // isLiveNow false / carry an endTimestamp.
    const upcoming =
      /"isUpcoming":true|"status":"LIVE_STREAM_OFFLINE"/.test(html) ||
      /"liveBroadcastDetails":\{[^}]*("isLiveNow":false|"endTimestamp")/.test(html);
    if (canonical && !upcoming && /"isLive":true|"isLiveNow":true/.test(html)) {
      videoId = canonical[1];
      live = true;
      const tm = html.match(/<meta name="title" content="([^"]*)"/);
      liveTitle = tm ? decode(tm[1]) : null;
    }
  } catch {
    /* fall through to the replay list */
  }
  let recent: { id: string; title: string; published: string }[] = [];
  if (!conf.liveOnly)
    try {
      const xml = await (
        await fetch(
          `https://www.youtube.com/feeds/videos.xml?channel_id=${ch}`,
          { signal: AbortSignal.timeout(8000) },
        )
      ).text();
      const match = conf.replayMatch ? new RegExp(conf.replayMatch, "i") : null;
      const exclude = conf.replayExclude ? new RegExp(conf.replayExclude, "i") : null;
      recent = [
        ...xml.matchAll(
          /<entry>[\s\S]*?<yt:videoId>([\w-]{11})<\/yt:videoId>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<published>([^<]+)<\/published>/g,
        ),
      ]
        .map(([, id, title, published]) => ({
          id,
          title: decode(title),
          published,
        }))
        // Replays are recent content only: published within the last 48 hours (older → nothing to replay → OFF AIR).
        .filter((v) => Date.now() - Date.parse(v.published) <= REPLAY_WINDOW_MS)
        .filter((v) => v.id !== videoId && (!match || match.test(v.title)) && !(exclude && exclude.test(v.title)))
        .slice(0, 10);
    } catch {
      /* no replay list this time */
    }
  const body = JSON.stringify({ videoId, live, title: liveTitle, recent });
  cache.set(ch, { at: Date.now(), body });
  return json(body);
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const json = (body: string, maxAge = 60) =>
  new Response(body, {
    headers: {
      "content-type": "application/json",
      "cache-control": `public, max-age=${maxAge}, s-maxage=60`,
    },
  });
