#!/usr/bin/env python3
"""Import the paid stay candidates into nature_stays as drafts.

Insert-only, on purpose. An upsert would overwrite the booking_url, the text and
the images that get filled in by hand afterwards, and a re-run is the most
likely moment for that to happen. Rows that already exist are left untouched and
reported.

Everything lands with status='draft': nothing appears on the map, in the shelter
module or on a subpage until someone publishes it in admin.

Only rows with a link are imported. A place without a booking_url, cj_deeplink
or alternativ_link stays in the spreadsheet: it cannot become a pin and cannot
be sold, and in the table it is only a draft nobody asked for. The whole
catalogue of 893 was imported once and taken out again for exactly that reason.

Rows flagged mulig_dublet are NOT imported. They are already in the duplicates
sheet of the spreadsheet, and a draft that may be a copy of an existing shelter
is worth reviewing on paper before it is in the table at all.

Usage:
    python3 scripts/paid_stays_import.py            # dry run, shows what it would do
    python3 scripts/paid_stays_import.py --apply    # write
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "betalt_overnatning_dk.csv")

# OSM gives us no prices, no images and no descriptions we may reuse, so those
# columns stay empty and are filled in by hand before anything is published.
LINK_SOURCE_DEFAULT = "direkte"


def ryd_booking_url(raw: str) -> str:
    """Strip a Booking address down to the canonical form.

    Mirrors tilGemtVaerdi in web/lib/booking-url.ts, which is the authority:
    that one runs when a link is pasted in admin, this one when a link arrives
    through the spreadsheet. Two implementations is a cost, but the two live in
    different languages and runtimes, and leaving the spreadsheet route
    unchecked would be worse: a pasted address carries a session id and the
    partner's own aid, and aid=356980 in the examples is not ours.
    """
    from urllib.parse import urlparse, parse_qs

    raw = (raw or "").strip()
    if not raw:
        return ""
    try:
        u = urlparse(raw)
    except ValueError:
        return raw

    # A finished CJ deeplink: keep the destination, we build the tracking
    # ourselves so each placement gets its own SID.
    if re.match(r"^/click-\d+-\d+$", u.path or ""):
        indre = parse_qs(u.query).get("url", [""])[0]
        return ryd_booking_url(indre) if indre else raw

    if u.hostname not in ("booking.com", "www.booking.com", "secure.booking.com"):
        return raw
    m = re.match(r"^/hotel/([a-z]{2})/([^/]+?)\.(?:[a-z]{2}(?:-[a-z]{2})?\.)?html$",
                 u.path or "", re.I)
    if not m:
        return raw
    land, slug = m.group(1).lower(), m.group(2)
    return f"https://www.booking.com/hotel/{land}/{slug}.da.html"


def link_for(c: dict) -> tuple[str, str] | None:
    """The link a row should carry, and which network it belongs to.

    Returns None when the row has no usable link. Those rows stay in the
    spreadsheet: a place without a link cannot become a pin, cannot be sold,
    and in the table it is only a draft nobody asked for. The whole catalogue
    was imported once and taken out again for exactly that reason.
    """
    booking = (c.get("booking_url") or "").strip() or (c.get("cj_deeplink") or "").strip()
    if booking:
        return ryd_booking_url(booking), "booking_com"
    alt = (c.get("alternativ_link") or "").strip()
    if alt:
        return alt, "andet_netvaerk"
    return None


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = s.replace("ø", "oe").replace("æ", "ae").replace("å", "aa")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-{2,}", "-", s) or "sted"


def client():
    for path in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
        if os.path.isfile(path):
            for line in open(path, encoding="utf-8"):
                if "=" in line and not line.lstrip().startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ.setdefault(key, value)
    from supabase import create_client
    return create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"],
                         os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def as_int(value: str) -> int | None:
    """OSM capacity is free text: "120", "ca. 80", "80 pladser". Take the digits."""
    match = re.search(r"\d+", value or "")
    return int(match.group(0)) if match else None


def build_rows(sb) -> tuple[list[dict], dict]:
    with open(CSV_PATH, encoding="utf-8-sig") as fh:
        candidates = list(csv.DictReader(fh))

    stats = Counter()
    stats["csv"] = len(candidates)

    # Region comes from the nearest shelter. Danish regions are large and the
    # nearest shelter is a median 1,5 km away, so this is safe. Kommune is not
    # derived: municipal borders are close enough together that it would be
    # wrong often, and backfill_kommune_from_geo.py already does it properly.
    shelters: dict[str, str] = {}
    start = 0
    while True:
        batch = sb.table("shelters").select("id, region").range(start, start + 999).execute().data
        if not batch:
            break
        shelters.update({r["id"]: r.get("region") for r in batch})
        start += 1000
        if len(batch) < 1000:
            break

    existing = set()
    start = 0
    while True:
        batch = sb.table("nature_stays").select("slug").range(start, start + 999).execute().data
        if not batch:
            break
        existing.update(r["slug"] for r in batch)
        start += 1000
        if len(batch) < 1000:
            break
    stats["already_in_table"] = len(existing)

    rows: list[dict] = []
    taken = set(existing)
    for c in candidates:
        if c["mulig_dublet"] == "ja":
            stats["skipped_duplicate"] += 1
            continue

        link = link_for(c)
        if link is None:
            stats["skipped_no_link"] += 1
            continue
        url, link_source = link

        slug = slugify(c["navn"])
        if slug in taken:
            # Two campsites can share a name. The OSM id keeps the slug unique
            # and stable, so a re-run produces the same slug and skips the row.
            slug = f"{slug}-{c['osm_id'].split('/')[-1]}"
        if slug in existing:
            stats["already_exists"] += 1
            continue
        taken.add(slug)

        region = shelters.get(c["naermeste_shelter_id"]) or None
        if region == "Danmark":
            # A known bad value in the shelter data; better null than wrong.
            region = None

        rows.append({
            "slug": slug,
            "name": c["navn"],
            "operator_name": c["operator"] or None,
            "type": c["type"],
            "region": region,
            "location": f"POINT({c['lon']} {c['lat']})",
            "capacity": as_int(c["capacity"]),
            "booking_url": url,
            "link_source": link_source,
            "status": "draft",
            # Everything OSM told us, kept together so the origin of a row is
            # never a guess, and so the hand-work has the facts next to it.
            "amenities": {
                "kilde": "openstreetmap",
                "licens": "ODbL",
                "osm_id": c["osm_id"],
                "website": c["website"] or None,
                "telefon": c["telefon"] or None,
                "email": c["email"] or None,
                "fee": c["fee"] or None,
                "reservation": c["reservation"] or None,
                "tents": c["tents"] or None,
                "cabins": c["cabins"] or None,
                "dog": c["dog"] or None,
                "stars": c["stars"] or None,
                "booking_sandsynlighed": c["booking_sandsynlighed"],
                "naermeste_shelter_id": c["naermeste_shelter_id"] or None,
                "naermeste_shelter_navn": c["naermeste_shelter_navn"] or None,
                "afstand_km": float(c["afstand_km"]) if c["afstand_km"] else None,
                "shelters_inden_for_15km": int(c["shelters_inden_for_15km"] or 0),
            },
        })
    return rows, stats


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="actually write to nature_stays")
    args = parser.parse_args()

    if not os.path.isfile(CSV_PATH):
        print("Koer scripts/paid_stays_enrich.py foerst.", file=sys.stderr)
        return 2

    sb = client()
    rows, stats = build_rows(sb)

    print("=" * 66)
    print("IMPORT TIL nature_stays" + ("" if args.apply else "  (TOERKOERSEL)"))
    print("=" * 66)
    print(f"  Kandidater i CSV                {stats['csv']:6d}")
    print(f"  Springes over: mulig dublet     {stats['skipped_duplicate']:6d}")
    print(f"  Springes over: intet link        {stats['skipped_no_link']:6d}")
    print(f"  Findes allerede i tabellen      {stats['already_exists']:6d}")
    print(f"  Klar til indsaettelse           {len(rows):6d}")
    print(f"\n  Pr. type:")
    for kind, count in Counter(r["type"] for r in rows).most_common():
        print(f"    {kind:18s} {count:5d}")
    print(f"\n  Pr. booking-sandsynlighed:")
    for level, count in Counter(
            r["amenities"]["booking_sandsynlighed"] for r in rows).most_common():
        print(f"    {level:8s} {count:5d}")
    med_region = sum(1 for r in rows if r["region"])
    print(f"\n  Med region udfyldt              {med_region:6d}")
    print(f"  Alle indsaettes med status      draft")
    print("\n  Kun raekker med et udfyldt link kommer med. Et sted uden link kan")
    print("  ikke blive til en pin og kan ikke saelges; i tabellen er det kun en")
    print("  kladde ingen har bedt om.")

    if not args.apply:
        print("\n  Intet skrevet. Koer med --apply for at gennemfoere.")
        return 0

    written = 0
    for i in range(0, len(rows), 200):
        chunk = rows[i:i + 200]
        res = sb.table("nature_stays").insert(chunk).execute()
        written += len(res.data or [])
        print(f"    indsat {written}/{len(rows)}")
    print(f"\n  {written} rækker indsat som draft.")
    print("  Intet er publiceret: de vises hverken paa kortet, i shelter-modulet")
    print("  eller som undersider, foer status saettes til published i admin.")
    print("\n  (c) OpenStreetMap contributors - ODbL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
