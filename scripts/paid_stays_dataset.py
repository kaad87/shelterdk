#!/usr/bin/env python3
"""Build a candidate dataset of paid overnight places in Denmark from OpenStreetMap.

The dataset is a list of CANDIDATES. OSM does not say which places are listed on
Booking.com, so the booking links are filled in by hand afterwards. Nothing here
touches the existing shelter records: duplicates against them are only flagged,
never merged.

Data source: OpenStreetMap, ODbL. Any surface that displays this data must carry
the attribution "(c) OpenStreetMap contributors".

Overpass fair use: exactly one request per run. A raw snapshot is written to
data/raw/ and reused on re-runs of the same day unless --refresh is given, so
iterating on the cleaning logic costs the API nothing.

Usage:
    python3 scripts/paid_stays_dataset.py              # steps 1-2 (harvest + clean)
    python3 scripts/paid_stays_dataset.py --refresh    # force a new Overpass call
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import unicodedata
from collections import Counter
from difflib import SequenceMatcher

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
RAW = os.path.join(DATA, "raw")

# The main instance is free and shared, and returns 504 when busy. Mirrors run
# the same software and the same data; the operator picks one with --mirror
# rather than the script retrying, so a busy API is never hammered in a loop.
OVERPASS_MIRRORS = {
    "main": "https://overpass-api.de/api/interpreter",
    "kumi": "https://overpass.kumi.systems/api/interpreter",
    "ch": "https://overpass.osm.ch/api/interpreter",
}
# area 3600050046 is the OSM relation for Denmark.
OVERPASS_QUERY = """[out:json][timeout:180];
area(3600050046)->.dk;
(
  nwr["tourism"~"^(camp_site|chalet|wilderness_hut|caravan_site)$"](area.dk);
  nwr["name"~"[Gg]lamping"](area.dk);
  nwr["camp_site"="glamping"](area.dk);
);
out center tags;
"""

# Types left out of the dataset. naturlejrplads is defined by fee=no, which is
# the opposite of the premise: these are free sites, more than half of them are
# the operator's own shelters seen from the OSM side, and none of them will ever
# carry a Booking link. They are still classified, then filtered, so the rule
# stays readable and the decision is one line to undo.
EXCLUDED_TYPES = {"naturlejrplads"}

# Two places are treated as the same when they sit this close AND share a name.
DUPLICATE_RADIUS_M = 150
# Name similarity above this counts as "almost the same name".
NAME_SIMILARITY = 0.85


# --------------------------------------------------------------------------
# Step 1: harvest
# --------------------------------------------------------------------------

def raw_path(day: dt.date) -> str:
    return os.path.join(RAW, f"osm_overnatning_{day:%Y%m%d}.json")


class OverpassBusy(RuntimeError):
    """The API answered, but said it is overloaded. Not a bug in this script."""


def harvest(refresh: bool = False, mirror: str = "main") -> dict:
    """Fetch from Overpass once, or reuse today's snapshot.

    Re-running the cleaning logic is the common case; re-downloading for it
    would hammer a free, shared API for no new data.
    """
    os.makedirs(RAW, exist_ok=True)
    path = raw_path(dt.date.today())
    if os.path.isfile(path) and not refresh:
        print(f"Reusing today's snapshot: {os.path.relpath(path, ROOT)}")
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)

    url = OVERPASS_MIRRORS[mirror]
    print(f"Querying Overpass ({mirror}, one request)...")
    resp = requests.post(
        url,
        data={"data": OVERPASS_QUERY},
        headers={"User-Agent": "shelterdk-paid-stays/1.0 (+https://shelterdk.dk)"},
        timeout=300,
    )
    # 429 and 504 mean "busy", not "wrong". Retrying in a loop is exactly what
    # fair use forbids, so the script stops and says which mirror to try.
    if resp.status_code in (429, 502, 503, 504):
        others = [m for m in OVERPASS_MIRRORS if m != mirror]
        raise OverpassBusy(
            f"{url} svarede {resp.status_code} (optaget). "
            f"Proev igen om lidt, eller koer med --mirror {others[0]}."
        )
    resp.raise_for_status()
    payload = resp.json()
    if "elements" not in payload:
        raise RuntimeError(f"Uventet svar uden 'elements': {str(payload)[:200]}")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    print(f"Saved raw response: {os.path.relpath(path, ROOT)}")
    return payload


# --------------------------------------------------------------------------
# Step 2: clean and classify
# --------------------------------------------------------------------------

def coords(el: dict) -> tuple[float, float] | None:
    """Node coordinates, or the centre for ways and relations."""
    if el.get("type") == "node" and "lat" in el:
        return float(el["lat"]), float(el["lon"])
    centre = el.get("center")
    if centre:
        return float(centre["lat"]), float(centre["lon"])
    return None


def haversine_m(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def normalise_name(name: str) -> str:
    """Fold case, accents and punctuation so near-identical names compare equal.

    Danish letters are folded too (ae/oe/aa), because OSM mixes spellings:
    "Soenderskov" and "Sønderskov" are the same campsite.
    """
    s = name.lower().strip()
    s = s.replace("ø", "oe").replace("æ", "ae").replace("å", "aa")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\b(camping|campingplads|camping site|v/|a/s|aps|i/s)\b", " ", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def similar(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def classify(tags: dict) -> str:
    """First matching rule wins. Order is the spec's, and it matters:
    a glamping site tagged tourism=camp_site must not land in campingplads."""
    tourism = tags.get("tourism", "")
    name_blob = " ".join(
        str(tags.get(k, "")) for k in ("name", "description", "camp_site")
    ).lower()

    if (
        tags.get("camp_site") == "glamping"
        or tags.get("glamping") == "yes"
        or "glamping" in name_blob
    ):
        return "glamping"
    if tourism == "camp_site" and (
        tags.get("backcountry") == "yes"
        or tags.get("camp_site") == "basic"
        or tags.get("fee") == "no"
    ):
        return "naturlejrplads"
    if tourism == "wilderness_hut":
        return "vildmarkshytte"
    if tourism == "chalet":
        return "hytte"
    if tourism == "caravan_site":
        return "autocamperplads"
    if tourism == "camp_site":
        return "campingplads"
    return "andet"


def address(tags: dict) -> str:
    """Street, number, postcode and town joined into one readable field."""
    street = tags.get("addr:street", "").strip()
    number = tags.get("addr:housenumber", "").strip()
    postcode = tags.get("addr:postcode", "").strip()
    city = tags.get("addr:city", "").strip()
    line1 = " ".join(x for x in (street, number) if x)
    line2 = " ".join(x for x in (postcode, city) if x)
    return ", ".join(x for x in (line1, line2) if x)


def website(tags: dict) -> str:
    for key in ("website", "contact:website", "url"):
        value = (tags.get(key) or "").strip()
        if value:
            return value
    return ""


def clean(payload: dict) -> tuple[list[dict], dict]:
    """Turn the Overpass elements into rows, and report what was dropped."""
    elements = payload.get("elements", [])
    stats = {
        "raw": len(elements),
        "no_coords": 0,
        "no_name": 0,
        "dupe_osm_id": 0,
        "dupe_near_name": 0,
        "excluded_type": 0,
    }

    rows: list[dict] = []
    seen_ids: set[str] = set()

    for el in elements:
        tags = el.get("tags") or {}
        osm_id = f"{el.get('type', '?')}/{el.get('id', '?')}"

        if osm_id in seen_ids:
            stats["dupe_osm_id"] += 1
            continue
        seen_ids.add(osm_id)

        point = coords(el)
        if point is None:
            stats["no_coords"] += 1
            continue

        name = (tags.get("name") or "").strip()
        if not name:
            # Counted, not kept: an unnamed row cannot be matched to Booking
            # and cannot be shown as a pin with a label.
            stats["no_name"] += 1
            continue

        kind = classify(tags)
        if kind in EXCLUDED_TYPES:
            stats["excluded_type"] += 1
            continue

        lat, lon = point
        rows.append(
            {
                "osm_id": osm_id,
                "navn": name,
                "type": kind,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "website": website(tags),
                "operator": (tags.get("operator") or "").strip(),
                "adresse": address(tags),
                "telefon": (tags.get("phone") or tags.get("contact:phone") or "").strip(),
                "email": (tags.get("email") or tags.get("contact:email") or "").strip(),
                "fee": (tags.get("fee") or "").strip(),
                "reservation": (tags.get("reservation") or "").strip(),
                "cabins": (tags.get("cabins") or "").strip(),
                "tents": (tags.get("tents") or "").strip(),
                "capacity": (tags.get("capacity") or "").strip(),
                "dog": (tags.get("dog") or "").strip(),
                "stars": (tags.get("stars") or "").strip(),
                "_norm": normalise_name(name),
            }
        )

    # Near-duplicates inside OSM itself: the same site mapped as both a node
    # and an area is common, and they carry different ids.
    rows.sort(key=lambda r: (r["_norm"], r["osm_id"]))
    kept: list[dict] = []
    for row in rows:
        duplicate_of = None
        for other in kept:
            if similar(row["_norm"], other["_norm"]) < NAME_SIMILARITY:
                continue
            if haversine_m(row["lat"], row["lon"], other["lat"], other["lon"]) <= DUPLICATE_RADIUS_M:
                duplicate_of = other
                break
        if duplicate_of is None:
            kept.append(row)
        else:
            stats["dupe_near_name"] += 1
            # Keep the richer record: a row with a website is worth more than
            # one without, whichever came first in the sort.
            if website(row) and not duplicate_of["website"]:
                duplicate_of.update({k: v for k, v in row.items() if v})

    for row in kept:
        row.pop("_norm", None)
    stats["clean"] = len(kept)
    return kept, stats


def report(rows: list[dict], stats: dict) -> None:
    print()
    print("=" * 66)
    print("TRIN 1-2: HENTNING OG RENS")
    print("=" * 66)
    print(f"  Raa elementer fra Overpass      {stats['raw']:6d}")
    print(f"  Uden koordinater (fjernet)      {stats['no_coords']:6d}")
    print(f"  Uden navn (fjernet, talt)       {stats['no_name']:6d}")
    print(f"  Dubletter paa OSM-id            {stats['dupe_osm_id']:6d}")
    print(f"  Fravalgt type ({', '.join(sorted(EXCLUDED_TYPES))})"
          f"{stats['excluded_type']:>8d}")
    print(f"  Naesten samme navn < {DUPLICATE_RADIUS_M} m      {stats['dupe_near_name']:6d}")
    print(f"  Tilbage efter rens              {stats['clean']:6d}")

    print("\n  Fordeling pr. type:")
    for name, count in Counter(r["type"] for r in rows).most_common():
        with_site = sum(1 for r in rows if r["type"] == name and r["website"])
        print(f"    {name:18s} {count:5d}   heraf med website {with_site:4d}")

    with_site = sum(1 for r in rows if r["website"])
    print(f"\n  Med website i alt               {with_site:6d}  "
          f"({with_site / max(1, len(rows)) * 100:.0f} %)")
    for field in ("telefon", "email", "operator", "adresse", "stars", "cabins"):
        n = sum(1 for r in rows if r[field])
        print(f"  Med {field:24s} {n:6d}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true",
                        help="force a new Overpass request even if today's snapshot exists")
    parser.add_argument("--mirror", choices=sorted(OVERPASS_MIRRORS), default="main",
                        help="which Overpass instance to query")
    args = parser.parse_args()

    try:
        payload = harvest(refresh=args.refresh, mirror=args.mirror)
    except OverpassBusy as exc:
        print(f"\nOverpass er optaget lige nu.\n  {exc}", file=sys.stderr)
        return 2
    rows, stats = clean(payload)
    report(rows, stats)

    os.makedirs(DATA, exist_ok=True)
    interim = os.path.join(DATA, "_paid_stays_clean.json")
    with open(interim, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1)
    print(f"\n  Mellemresultat: {os.path.relpath(interim, ROOT)}")
    print("  (c) OpenStreetMap contributors - ODbL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
