import type { APIRoute } from "astro";
import { siteOrigin } from "../lib/site";

// Pages are welcome; the relays under /api are not content.
export const GET: APIRoute = ({ site, url }) =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteOrigin(site, url)}/sitemap.xml\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
