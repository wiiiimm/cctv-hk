import type { APIRoute } from "astro";
import { siteOrigin } from "../lib/site";

// A single-page app with an English and a Chinese view of the same page.
export const GET: APIRoute = ({ site, url }) => {
  const home = `${siteOrigin(site, url)}/`;
  const alt = (lang: string, href: string) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${home}</loc>
${alt("en", `${home}?lang=en`)}
${alt("zh-Hant-HK", `${home}?lang=zh`)}
${alt("x-default", home)}
    <changefreq>daily</changefreq>
  </url>
</urlset>
`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
