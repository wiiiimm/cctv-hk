#!/usr/bin/env python3
"""Builds src/data/road-segments.json: the road behind each segment of TD's live speed feed.

The speed feed (irnAvgSpeed-all.xml, "Traffic Data of Strategic / Major Roads" on DATA.GOV.HK) gives a speed per
segment id only. Its ids are ROUTE_IDs of TD's Road Network (2nd Generation) centrelines, which carry the street's
English / Chinese name, length and shape. Output: { "<id>": [english, chinese, length_m, lat, lon] } (midpoint, WGS84).

Needs: pip install pyogrio pyproj shapely. Run: npm run data:roads
"""
import csv, io, json, os, re, sys, tempfile, urllib.request, zipfile

from pyogrio.raw import read
from pyproj import Transformer
from shapely import wkb

SEGMENTS = "https://static.data.gov.hk/td/traffic-data-strategic-major-roads/info/speed_segments_info.csv"
NETWORK = "https://static.data.gov.hk/td/road-network-v2/RdNet_IRNP.gdb.zip"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "road-segments.json")


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"user-agent": "hk-monitor data build"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read()


def title(name: str) -> str:
    # "WATERLOO ROAD" → "Waterloo Road"; keep short all-caps tokens like "HZMB", "TKO", "MTR".
    words = []
    for w in name.split():
        words.append(w if (len(w) <= 4 and w.isalpha() and w in {"HZMB", "TKO", "MTR", "KCR", "IEC", "HK"}) else w.capitalize())
    return " ".join(words)


def main() -> None:
    wanted = {int(r[0]) for r in list(csv.reader(io.StringIO(get(SEGMENTS).decode("utf-8-sig"))))[1:] if r and r[0].isdigit()}
    with tempfile.TemporaryDirectory() as tmp:
        zipfile.ZipFile(io.BytesIO(get(NETWORK))).extractall(tmp)
        gdb = next(os.path.join(tmp, d) for d in os.listdir(tmp) if d.endswith(".gdb"))
        meta, _, geoms, fields = read(gdb, layer="CENTERLINE", columns=["ROUTE_ID", "STREET_ENAME", "STREET_CNAME", "ALIAS_ENAME", "ALIAS_CNAME", "ROUTE_NUM", "SHAPE_Length"])
    col = {n: fields[i] for i, n in enumerate(meta["fields"])}
    to_wgs = Transformer.from_crs(meta["crs"], "EPSG:4326", always_xy=True)
    out = {}
    # Unnamed segments (slip roads, ramps) carry a placeholder such as "-99" / "–９９".
    placeholder = re.compile(r"^\s*[-–－]?\s*[9９]{2}\s*$")
    named = lambda s: (s or "").strip() if s and not placeholder.match(s) else ""
    for rid, en, zh, aen, azh, rnum, length, g in zip(col["ROUTE_ID"], col["STREET_ENAME"], col["STREET_CNAME"], col["ALIAS_ENAME"], col["ALIAS_CNAME"], col["ROUTE_NUM"], col["SHAPE_Length"], geoms):
        rid = int(rid)
        en, zh = named(en) or named(aen), named(zh) or named(azh)
        if not (en or zh) and rnum and str(rnum).strip().isdigit() and int(rnum) > 0:
            en, zh = f"Route {int(rnum)}", f"{int(rnum)}號幹線"
        if rid not in wanted or g is None or not (en or zh):
            continue
        line = wkb.loads(bytes(g))
        mid = line.interpolate(0.5, normalized=True)
        lon, lat = to_wgs.transform(mid.x, mid.y)
        out[str(rid)] = [title(en or zh), zh or title(en), round(float(length)), round(lat, 5), round(lon, 5)]
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} of {len(wanted)} speed segments named → {os.path.relpath(OUT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
