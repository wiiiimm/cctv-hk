#!/usr/bin/env node
// Builds src/data/td-cameras.json from the Transport Department open-data camera list.
// Source: https://data.gov.hk (Transport Department, Traffic Snapshot Images). Run: npm run data:td
import { writeFile } from "node:fs/promises";

const BASE = "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_";
const OUT = new URL("../src/data/td-cameras.json", import.meta.url);

/** The TD XML escapes characters (e.g. "Central &amp; Western"); turn entities back into text. */
function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function load(lang) {
  const res = await fetch(`${BASE}${lang}.xml`);
  if (!res.ok) throw new Error(`TD ${lang} list: HTTP ${res.status}`);
  const xml = await res.text();
  const rows = new Map();
  for (const [, body] of xml.matchAll(/<image>([\s\S]*?)<\/image>/g)) {
    const tag = (t) => decode(body.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1].trim() ?? "");
    rows.set(tag("key"), {
      key: tag("key"),
      region: tag("region"),
      district: tag("district"),
      description: tag("description").replace(/\s*\[[^\]]+\]\s*$/, ""),
      lat: Number(tag("latitude")),
      lon: Number(tag("longitude")),
    });
  }
  return rows;
}

const [en, tc] = await Promise.all([load("En"), load("Tc")]);
const cameras = [...en.values()]
  .filter((c) => c.key && Number.isFinite(c.lat) && Number.isFinite(c.lon))
  .map((c) => {
    const z = tc.get(c.key);
    return {
      id: c.key,
      name: c.description,
      nameZh: z?.description ?? c.description,
      region: c.region,
      regionZh: z?.region ?? c.region,
      district: c.district,
      districtZh: z?.district ?? c.district,
      lat: c.lat,
      lon: c.lon,
    };
  });

await writeFile(OUT, JSON.stringify(cameras) + "\n");
console.log(`wrote ${cameras.length} TD cameras -> ${OUT.pathname}`);
