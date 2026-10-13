#!/usr/bin/env python3
"""Steps 3-5: flag duplicates against existing shelters, prioritise, write outputs.

Reads the cleaned candidates from scripts/paid_stays_dataset.py and the existing
shelters from Supabase. It never writes to the shelter records and never merges
anything: duplicates are only flagged for a human to review.

The distance fields and the lookup file are references for the "overnatning i
naerheden" module, not a foreign key. A paid stay is a place in its own right.

Outputs (all under data/):
    betalt_overnatning_dk.csv
    betalt_overnatning_dk.xlsx
    betalt_overnatning_dk.geojson
    shelter_naerliggende_overnatning.json

Data source: OpenStreetMap, ODbL. Display requires "(c) OpenStreetMap contributors".
"""
from __future__ import annotations

import csv
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paid_stays_dataset import haversine_m, normalise_name, similar  # noqa: E402

# A stay this close to an existing shelter is worth a human look.
DUPLICATE_RADIUS_M = 200
# ... and so is one that shares a name, however far apart they sit.
NAME_SIMILARITY = 0.88
# Radius for the "nearby" lookup used by the shelter page module.
NEARBY_KM = 15
NEARBY_LIMIT = 5

COLUMNS = [
    "osm_id", "navn", "type", "lat", "lon", "website", "operator", "adresse",
    "telefon", "email", "fee", "reservation", "cabins", "tents", "capacity",
    "dog", "stars",
    "booking_sandsynlighed", "shelters_inden_for_15km",
    "naermeste_shelter_id", "naermeste_shelter_navn", "afstand_km",
    "mulig_dublet", "dublet_af_id", "dublet_af_navn", "dublet_grund",
    # Filled in by hand afterwards. OSM cannot tell us any of this.
    "booking_url", "cj_deeplink", "alternativ_link", "status",
]


def load_shelters() -> list[dict]:
    """Existing shelters, read only. Never written back to."""
    for path in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
        if os.path.isfile(path):
            for line in open(path, encoding="utf-8"):
                if "=" in line and not line.lstrip().startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ.setdefault(key, value)
    from supabase import create_client

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"],
                       os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows: list[dict] = []
    start = 0
    while True:
        batch = (sb.table("shelters").select("id, slug, title, location")
                 .range(start, start + 999).execute().data)
        if not batch:
            break
        rows.extend(batch)
        start += 1000
        if len(batch) < 1000:
            break

    out = []
    for row in rows:
        match = re.match(r"POINT\(([-\d.]+) ([-\d.]+)\)", row.get("location") or "")
        if not match:
            continue
        out.append({
            "id": row["id"],
            "slug": row.get("slug") or "",
            "navn": (row.get("title") or "").strip(),
            "lon": float(match.group(1)),
            "lat": float(match.group(2)),
            "_norm": normalise_name(row.get("title") or ""),
        })
    return out


class Grid:
    """Coarse lat/lon buckets so we do not compare every stay to every shelter.

    1.830 shelters times ~1.500 stays is 2,7 million distance calculations.
    A 0,05 degree bucket (about 5 km) cuts that to the handful of shelters that
    could possibly be within range.
    """

    STEP = 0.05

    def __init__(self, points: list[dict]):
        self.buckets: dict[tuple[int, int], list[dict]] = defaultdict(list)
        for p in points:
            self.buckets[self._key(p["lat"], p["lon"])].append(p)

    def _key(self, lat: float, lon: float) -> tuple[int, int]:
        return int(lat / self.STEP), int(lon / self.STEP)

    def near(self, lat: float, lon: float, radius_km: float) -> list[dict]:
        span = int(radius_km / 111.0 / self.STEP) + 1
        base_y, base_x = self._key(lat, lon)
        found: list[dict] = []
        for dy in range(-span, span + 1):
            for dx in range(-span, span + 1):
                found.extend(self.buckets.get((base_y + dy, base_x + dx), ()))
        return found


def booking_probability(row: dict) -> str:
    """How likely a place is to be listed on Booking.com, as a sorting aid only.

    OSM carries no Booking identifier, so this is a heuristic for what to check
    first, never an assertion. The spec's rule, in its order.
    """
    has_site = bool(row["website"])
    strong_type = row["type"] in ("campingplads", "glamping", "hytte")
    extra = bool(row["stars"] or row["cabins"] or row["reservation"] == "yes")
    if strong_type and has_site and extra:
        return "høj"
    if has_site:
        return "middel"
    return "lav"


def enrich(stays: list[dict], shelters: list[dict]) -> list[dict]:
    grid = Grid(shelters)
    for stay in stays:
        stay["_norm"] = normalise_name(stay["navn"])
        candidates = grid.near(stay["lat"], stay["lon"], NEARBY_KM)

        nearest = None
        nearest_m = float("inf")
        within = 0
        duplicate = None
        reason = ""

        for shelter in candidates:
            metres = haversine_m(stay["lat"], stay["lon"], shelter["lat"], shelter["lon"])
            if metres < nearest_m:
                nearest, nearest_m = shelter, metres
            if metres <= NEARBY_KM * 1000:
                within += 1
            if duplicate is None:
                name_match = similar(stay["_norm"], shelter["_norm"]) >= NAME_SIMILARITY
                if metres <= DUPLICATE_RADIUS_M:
                    duplicate, reason = shelter, f"under {DUPLICATE_RADIUS_M} m ({metres:.0f} m)"
                elif name_match:
                    duplicate, reason = shelter, f"meget lignende navn ({metres / 1000:.1f} km væk)"

        stay["naermeste_shelter_id"] = nearest["id"] if nearest else ""
        stay["naermeste_shelter_navn"] = nearest["navn"] if nearest else ""
        stay["afstand_km"] = round(nearest_m / 1000, 2) if nearest else ""
        stay["shelters_inden_for_15km"] = within
        stay["mulig_dublet"] = "ja" if duplicate else "nej"
        stay["dublet_af_id"] = duplicate["id"] if duplicate else ""
        stay["dublet_af_navn"] = duplicate["navn"] if duplicate else ""
        stay["dublet_grund"] = reason
        stay["booking_sandsynlighed"] = booking_probability(stay)
        for field in ("booking_url", "cj_deeplink", "alternativ_link"):
            stay.setdefault(field, "")
        stay.setdefault("status", "ikke tjekket")
        stay.pop("_norm", None)

    rank = {"høj": 0, "middel": 1, "lav": 2}
    stays.sort(key=lambda s: (rank[s["booking_sandsynlighed"]],
                              -s["shelters_inden_for_15km"], s["navn"]))
    return stays


def nearby_lookup(stays: list[dict], shelters: list[dict]) -> dict:
    """shelter_id -> the closest paid stays, for the module on the shelter page.

    Only id, name, type and distance: the module needs no more, and a lookup
    file that duplicates the whole record goes stale the moment a price changes.
    """
    grid = Grid([s for s in stays])
    out: dict[str, list[dict]] = {}
    for shelter in shelters:
        found = []
        for stay in grid.near(shelter["lat"], shelter["lon"], NEARBY_KM):
            metres = haversine_m(shelter["lat"], shelter["lon"], stay["lat"], stay["lon"])
            if metres <= NEARBY_KM * 1000:
                found.append({
                    "osm_id": stay["osm_id"], "navn": stay["navn"],
                    "type": stay["type"], "afstand_km": round(metres / 1000, 2),
                })
        if found:
            found.sort(key=lambda x: x["afstand_km"])
            out[shelter["id"]] = found[:NEARBY_LIMIT]
    return out


def write_csv(stays: list[dict], path: str) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(stays)


def write_xlsx(stays: list[dict], path: str) -> None:
    from openpyxl import Workbook
    from openpyxl.styles import Font
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    wb.remove(wb.active)

    def sheet(title: str, rows: list[dict]) -> None:
        ws = wb.create_sheet(title[:31])
        ws.append(COLUMNS)
        for cell in ws[1]:
            cell.font = Font(bold=True)
        for row in rows:
            ws.append([row.get(c, "") for c in COLUMNS])
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}{max(1, len(rows)) + 1}"
        for i, name in enumerate(COLUMNS, start=1):
            width = max(len(name) + 2, min(42, max((len(str(r.get(name, ""))) for r in rows),
                                                   default=10) + 2))
            ws.column_dimensions[get_column_letter(i)].width = width

    sheet("Alle", stays)
    for kind in sorted({s["type"] for s in stays}):
        sheet(kind, [s for s in stays if s["type"] == kind])
    sheet("Mulige dubletter", [s for s in stays if s["mulig_dublet"] == "ja"])
    wb.save(path)


def write_geojson(stays: list[dict], path: str) -> None:
    features = [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]},
        "properties": {k: s.get(k, "") for k in COLUMNS if k not in ("lat", "lon")},
    } for s in stays]
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({
            "type": "FeatureCollection",
            "attribution": "(c) OpenStreetMap contributors",
            "license": "ODbL",
            "features": features,
        }, fh, ensure_ascii=False, indent=1)


def main() -> int:
    interim = os.path.join(DATA, "_paid_stays_clean.json")
    if not os.path.isfile(interim):
        print("Koer scripts/paid_stays_dataset.py foerst.", file=sys.stderr)
        return 2
    with open(interim, encoding="utf-8") as fh:
        stays = json.load(fh)

    print(f"Indlaeser {len(stays)} kandidater og eksisterende shelters...")
    shelters = load_shelters()
    print(f"  {len(shelters)} shelters med koordinater (laeses, aendres aldrig)")

    stays = enrich(stays, shelters)
    lookup = nearby_lookup(stays, shelters)

    write_csv(stays, os.path.join(DATA, "betalt_overnatning_dk.csv"))
    write_xlsx(stays, os.path.join(DATA, "betalt_overnatning_dk.xlsx"))
    write_geojson(stays, os.path.join(DATA, "betalt_overnatning_dk.geojson"))
    with open(os.path.join(DATA, "shelter_naerliggende_overnatning.json"),
              "w", encoding="utf-8") as fh:
        json.dump({"attribution": "(c) OpenStreetMap contributors",
                   "radius_km": NEARBY_KM, "shelters": lookup}, fh,
                  ensure_ascii=False, indent=1)

    print("\n" + "=" * 66)
    print("TRIN 3-5: DUBLETTJEK, PRIORITERING OG OUTPUT")
    print("=" * 66)
    dupes = [s for s in stays if s["mulig_dublet"] == "ja"]
    print(f"  Kandidater i alt                {len(stays):6d}")
    print(f"  Mulige dubletter (markeret)     {len(dupes):6d}")
    for reason, count in Counter(
            ("afstand" if "under" in s["dublet_grund"] else "navn") for s in dupes).most_common():
        print(f"    heraf paa {reason:22s}{count:6d}")
    print(f"\n  Booking-sandsynlighed:")
    for level in ("høj", "middel", "lav"):
        n = sum(1 for s in stays if s["booking_sandsynlighed"] == level)
        print(f"    {level:8s} {n:6d}")
    print(f"\n  Shelters med mindst ét betalt sted inden for {NEARBY_KM} km: "
          f"{len(lookup)} af {len(shelters)}")
    sizes = [len(v) for v in lookup.values()]
    if sizes:
        print(f"  Gennemsnit i opslagsfilen: {sum(sizes)/len(sizes):.1f} steder pr. shelter")
    print("\n  Skrevet:")
    for name in ("betalt_overnatning_dk.csv", "betalt_overnatning_dk.xlsx",
                 "betalt_overnatning_dk.geojson", "shelter_naerliggende_overnatning.json"):
        p = os.path.join(DATA, name)
        print(f"    data/{name:42s} {os.path.getsize(p)/1024:8.0f} kB")
    print("\n  (c) OpenStreetMap contributors - ODbL")
    return 0


if __name__ == "__main__":
    sys.exit(main())
