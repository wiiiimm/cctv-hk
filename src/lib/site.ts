// Site identity for SEO / social previews, shared by the page head, robots.txt and sitemap.xml.

/** Absolute origin: the deployed production domain on Vercel, else wherever this was built / served. */
export function siteOrigin(site: URL | undefined, url: URL): string {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL ?? import.meta.env.VERCEL_PROJECT_PRODUCTION_URL;
  return site?.origin ?? (vercelHost ? `https://${vercelHost}` : url.origin);
}

export const SITE = {
  name: "HK Monitor",
  nameZh: "香港監察網",
  title: "HK Monitor · 香港監察網 — Hong Kong CCTV monitor for live traffic cameras, weather & news",
  description:
    "A CCTV monitor for Hong Kong's open data: 1,000+ live traffic cameras, Observatory weather cameras, radar and satellite, live news and Hong Kong YouTube on one video wall — with channel numbers, patrol sequences, cameras near you, a weather and news ticker and an optional colour CRT mode. Free, bilingual, works offline.",
  descriptionZh:
    "香港開放數據閉路電視監察網：一千多部運輸署交通攝影機、天文台天氣相機、雷達及衛星圖、新聞直播及香港 YouTube 頻道，全部排成監察牆 — 頻道號碼、自動巡邏、我附近的鏡頭、天氣及新聞跑馬燈，還有彩色 CRT 顯示模式。免費、中英雙語、可離線使用。",
  titleZh: "香港監察網 · HK Monitor — 香港交通閉路電視、天氣及新聞監察牆",
  imageAlt:
    "HK Monitor CCTV video wall in CRT mode: Hong Kong traffic cameras, weather radar, a speed-map panel, the satellite image and a news ticker",
  repo: "https://github.com/wiiiimm/hk-monitor",
  keywords:
    "Hong Kong CCTV, HK traffic cameras, 香港交通攝影機, 運輸署閉路電視, Hong Kong Observatory, 天文台, weather radar, live news Hong Kong, open data, DATA.GOV.HK, CCTV monitor, video wall, CRT",
} as const;
