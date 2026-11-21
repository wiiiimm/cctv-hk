// Fuzzy channel search for the channel guide. Every query word must match somewhere (name EN/ZH, district,
// region, camera code, channel number); results are ranked by how well they match.
//
// Per word, best of: exact word > word prefix > substring > in-order subsequence > one typo (words of 4+ letters).
// Chinese is matched as substring / in-order characters. Word order and punctuation don't matter.
import type { Channel } from "./channels";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const hasCJK = (s: string) => /[㐀-鿿]/.test(s);

/** Characters of `q` appear in `s` in order; returns a score that prefers tight, early matches (0 = no match). */
function subsequence(q: string, s: string): number {
  let i = 0;
  let first = -1;
  let last = -1;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) {
      if (first < 0) first = j;
      last = j;
      i++;
    }
  }
  if (i < q.length) return 0;
  const spread = last - first + 1 - q.length; // gaps between matched characters
  if (spread > q.length * 5) return 0; // letters scattered across a long name: not a real match
  return Math.max(0.05, 0.35 - spread * 0.01 - first * 0.002);
}

/** Levenshtein distance ≤ 1 (one insert, delete or substitution). */
function oneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

interface Field {
  text: string;
  words: string[];
  weight: number;
}

const indexCache = new WeakMap<Channel, Field[]>();
function fieldsOf(c: Channel): Field[] {
  let f = indexCache.get(c);
  if (!f) {
    const mk = (raw: string, weight: number): Field => {
      const text = norm(raw);
      return { text, words: text.split(" ").filter(Boolean), weight };
    };
    f = [
      mk(c.name, 1),
      mk(c.nameZh, 1),
      mk(`${c.district} ${c.districtZh}`, 0.7),
      mk(`${c.region} ${c.regionZh}`, 0.5),
      mk(c.code, 0.9),
    ];
    indexCache.set(c, f);
  }
  return f;
}

/** How well one query word matches a channel (0 = not at all). */
function wordScore(q: string, c: Channel): number {
  // Channel number: "1101", "0101", "101".
  if (/^\d+$/.test(q)) {
    const num = String(c.num);
    const padded = num.padStart(4, "0");
    if (num === q.replace(/^0+/, "") || padded === q) return 3;
    if (num.startsWith(q) || padded.startsWith(q)) return 1.5;
  }
  let best = 0;
  const cjk = hasCJK(q);
  for (const f of fieldsOf(c)) {
    let s = 0;
    if (cjk) {
      const flat = f.text.replace(/ /g, "");
      if (flat.startsWith(q)) s = 2;
      else if (f.text.includes(q)) s = 1.6;
      else s = subsequence(q, flat) * 2;
    } else {
      for (const w of f.words) {
        if (w === q) s = Math.max(s, 2);
        else if (w.startsWith(q)) s = Math.max(s, 1.5 - (w.length - q.length) * 0.01);
        else if (q.length >= 4 && oneEdit(q, w)) s = Math.max(s, 0.9);
        else if (q.length >= 4 && w.length > q.length && oneEdit(q, w.slice(0, q.length))) s = Math.max(s, 0.7);
      }
      if (!s && f.text.includes(q)) s = 1;
      if (!s && q.length >= 3) s = subsequence(q, f.text.replace(/ /g, ""));
    }
    best = Math.max(best, s * f.weight);
  }
  return best;
}

/** Channels matching every word of `query`, best first. */
export function fuzzySearch(channels: Channel[], query: string): Channel[] {
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return channels;
  const scored: { c: Channel; score: number }[] = [];
  for (const c of channels) {
    let total = 0;
    let ok = true;
    for (const w of words) {
      const s = wordScore(w, c);
      if (!s) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) scored.push({ c, score: total });
  }
  scored.sort((a, b) => b.score - a.score || a.c.num - b.c.num);
  return scored.map((x) => x.c);
}
