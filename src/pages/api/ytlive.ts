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
        "user-agent": "Mozilla/5.0 (compatible; hk-monitor/0.1)",
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
      const fullPage = conf.replayDays === 0; // non-news: no age limit, a full page of the channel's videos
      const [feed, page, upcoming] = await Promise.all([
        rssVideos(ch),
        fullPage ? videosPage(ch).catch(() => [] as Video[]) : Promise.resolve([] as Video[]),
        upcomingIds(ch).catch(() => new Set<string>()),
      ]);
      // Union (the feed has exact dates and recent past streams; the page has ~30 videos), newest first.
      const seen = new Set<string>();
      const all = [...feed, ...page]
        .filter((v) => !seen.has(v.id) && (seen.add(v.id), true))
        .sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
      const match = conf.replayMatch ? new RegExp(conf.replayMatch, "i") : null;
      const exclude = conf.replayExclude ? new RegExp(conf.replayExclude, "i") : null;
      recent = all
        // Scheduled streams / premieres that haven't started can't play yet: only once they're live (or done). Marks:
        // the Live tab lists it as upcoming, the Videos page has no "… ago" for it, or the feed shows it with 0 views
        // (a scheduled premiere / stream has none until it starts).
        .filter((v) => !upcoming.has(v.id) && !v.upcoming)
        // News: published within the last 48 hours (older → nothing to replay → OFF AIR). replayDays 0 = no limit.
        .filter((v) => fullPage || Date.now() - Date.parse(v.published) <= (conf.replayDays ? conf.replayDays * 86_400_000 : REPLAY_WINDOW_MS))
        .filter((v) => v.id !== videoId && (!match || match.test(v.title)) && !(exclude && exclude.test(v.title)))
        // Non-news: proper videos only — vertical #shorts come in through the feed (the Videos page leaves them out).
        .filter((v) => !(fullPage && /#shorts/i.test(v.title)))
        .slice(0, fullPage ? 30 : 15);
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

type Video = { id: string; title: string; published: string; upcoming?: boolean };

/** Marks of a scheduled stream / premiere in a list item of a channel page. */
const UPCOMING = /upcomingEventData|"UPCOMING"|Scheduled for|Premieres? |Waiting for|BADGE_STYLE_TYPE_UPCOMING|"style":"UPCOMING"/;

/** IDs of the channel's scheduled (not yet started) streams and premieres, from its Live tab. */
async function upcomingIds(ch: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const data = await channelPageData(ch, "streams");
  if (!data) return ids;
  walkItems(data, (id, item) => {
    if (UPCOMING.test(JSON.stringify(item))) ids.add(id);
  });
  return ids;
}

/** ytInitialData of a channel tab ("videos", "streams"). */
async function channelPageData(ch: string, tab: string): Promise<unknown | null> {
  const html = await (
    await fetch(`https://www.youtube.com/channel/${ch}/${tab}`, {
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en" },
      signal: AbortSignal.timeout(8000),
    })
  ).text();
  const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

/** Every video list item (lockupViewModel / videoRenderer) in ytInitialData. */
function walkItems(o: unknown, visit: (id: string, item: Record<string, any>) => void): void {
  if (Array.isArray(o)) return o.forEach((x) => walkItems(x, visit));
  if (!o || typeof o !== "object") return;
  const r = o as Record<string, any>;
  const item = r.lockupViewModel ?? r.videoRenderer;
  const id: string | undefined = r.lockupViewModel?.contentId ?? r.videoRenderer?.videoId;
  if (item && id) return visit(id, item);
  Object.values(r).forEach((x) => walkItems(x, visit));
}

/** The channel's official feed: its latest 15 uploads (videos and past streams; never members-only), exact dates. */
async function rssVideos(ch: string): Promise<Video[]> {
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch}`, { signal: AbortSignal.timeout(8000) })).text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, e]) => {
    const id = e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = e.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const published = e.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || title === undefined || !published) return [];
    // A scheduled premiere / stream sits in the feed with 0 views until it starts.
    const views = e.match(/<media:statistics views="(\d+)"/)?.[1];
    return [{ id, title: decode(title), published, upcoming: views === "0" }];
  });
}

/**
 * The first page of the channel's Videos tab (~30 videos, any age), skipping members-only ones. Dates there are only
 * relative ("3 weeks ago"), so they are approximate.
 */
async function videosPage(ch: string): Promise<Video[]> {
  const html = await (
    await fetch(`https://www.youtube.com/channel/${ch}/videos`, {
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "accept-language": "en" },
      signal: AbortSignal.timeout(8000),
    })
  ).text();
  const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
  if (!m) return [];
  const out: Video[] = [];
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    const r = o as Record<string, any>;
    const lockup = r.lockupViewModel;
    const vr = r.videoRenderer;
    if (lockup?.contentId || vr?.videoId) {
      const s = JSON.stringify(lockup ?? vr);
      if (!/MEMBERS_ONLY|Members only|members-only/i.test(s)) {
        const id: string = lockup?.contentId ?? vr.videoId;
        const title: string = lockup?.metadata?.lockupMetadataViewModel?.title?.content ?? (vr?.title?.runs ?? []).map((x: { text: string }) => x.text).join("");
        const ago = s.match(/(\d+) (second|minute|hour|day|week|month|year)s? ago/);
        // Premieres / scheduled streams have no "… ago" yet (they'd sort as the newest): flagged, then left out.
        if (id && title) out.push({ id, title, published: new Date(Date.now() - agoMs(ago)).toISOString(), upcoming: UPCOMING.test(s) || !ago });
      }
      return;
    }
    Object.values(r).forEach(walk);
  };
  walk(JSON.parse(m[1]));
  return out;
}

function agoMs(m: RegExpMatchArray | null): number {
  if (!m) return 0;
  const unit = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[m[2]] ?? 0;
  return Number(m[1]) * unit;
}
