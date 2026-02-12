#!/usr/bin/env python3
"""
Udfyld shelters.kommune ud fra koordinater (reverse geocoding).

Bruger OpenStreetMap Nominatim (gratis). Kør én gang for at berige shelters
der mangler by/kommune. Respekterer 1 req/s rate limit.

Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.
Kør: python3 backfill_kommune_from_geo.py [--dry-run]
      python3 backfill_kommune_from_geo.py --convert-to-by [--dry-run]  # konverter kommune-navne til by i DB
"""
import argparse
import os
import re
import time
from typing import Optional

import requests
from supabase import create_client, Client

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")
for p in (_env_path, os.path.join(_script_dir, ".env.local"), ".env.local", ".env"):
    if os.path.isfile(p):
        try:
            from dotenv import load_dotenv
            load_dotenv(p)
        except ImportError:
            pass
        if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL") and os.path.isfile(p):
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        os.environ.setdefault(k.strip(), v.strip())

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "ShelterDK/1.0 (backfill kommune; contact via shelterdk)"
RATE_LIMIT_S = 1.1


def parse_point(location_str):
    """Udtræk lon, lat fra POINT(lon lat) eller None."""
    if not location_str or not isinstance(location_str, str):
        return None, None
    m = re.match(r"POINT\s*\(\s*([\d.e+-]+)\s+([\d.e+-]+)\s*\)", location_str, re.I)
    if not m:
        return None, None
    try:
        return float(m.group(1)), float(m.group(2))
    except (TypeError, ValueError):
        return None, None


def kommune_to_by(val: str) -> str:
    """Konverter kommune-navn til by-navn (så vi gemmer/viser byer)."""
    t = (val or "").strip()
    if not t:
        return t
    s = t.lower()
    if s.endswith(" regionskommune"):
        region_by = {
            "bornholms regionskommune": "Rønne",
            "københavns by": "København",
        }
        return region_by.get(s, re.sub(r"\s+Regionskommune$", "", t, flags=re.I).strip() or t)
    if s.endswith(" kommune"):
        return re.sub(r"\s+Kommune$", "", t, flags=re.I).strip() or t
    return t


def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """Hent by/kommune for (lat, lon) via Nominatim. Returner by-navn (konverterer kommune til by)."""
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"lat": lat, "lon": lon, "format": "json", "addressdetails": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        addr = data.get("address") or {}
        for key in ("city", "town", "village", "municipality", "county", "state_district"):
            val = (addr.get(key) or "").strip()
            if not val:
                continue
            if val.lower() in ("danmark", "denmark"):
                continue
            if re.match(r"^\d+$", val):
                continue
            return kommune_to_by(val)
        return None
    except Exception as e:
        print(f"  Nominatim fejl: {e}")
        return None


# Matcher kommune-navn der bør konverteres til by (fx "X Kommune", "X Regionskommune").
_NEEDS_BY_CONVERT = re.compile(r".*\s+(Kommune|Regionskommune|by)$", re.I)


def main():
    ap = argparse.ArgumentParser(description="Udfyld kommune fra koordinater (Nominatim)")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun hvad der ville blive opdateret")
    ap.add_argument(
        "--convert-to-by",
        action="store_true",
        help="Konverter eksisterende kommune-navne til by-navne i DB (fx 'Bornholms Regionskommune' → 'Rønne')",
    )
    args = ap.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return 1

    supabase: Client = create_client(url, key)

    # Hent ALLE shelters (Supabase returnerer max 1000 per request – paginer)
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("shelters")
            .select("id, title, location, kommune")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        chunk = r.data or []
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size

    if args.convert_to_by:
        # Konverter kommune → by for rækker der stadig har "X Kommune" / "X Regionskommune"
        to_convert = []
        for row in all_rows:
            kommune = (row.get("kommune") or "").strip()
            if not kommune or not _NEEDS_BY_CONVERT.match(kommune):
                continue
            by_name = kommune_to_by(kommune)
            if by_name != kommune:
                to_convert.append({"id": row["id"], "title": row.get("title") or "", "kommune": kommune, "by": by_name})
        print(f"Shelters med kommune-navn der konverteres til by: {len(to_convert)}")
        if not to_convert:
            print("Ingen rækker har kommune-navn der skal konverteres.")
            return 0
        if args.dry_run:
            print("(dry-run – ingen opdateringer)")
        updated = 0
        for i, s in enumerate(to_convert):
            if not args.dry_run:
                supabase.table("shelters").update({"kommune": s["by"]}).eq("id", s["id"]).execute()
            updated += 1
            print(f"  [{i+1}/{len(to_convert)}] {s['kommune']} → {s['by']}  ({s['title'][:40]}…)")
        print(f"Færdig. Opdateret {updated} shelter(s) til by-navn.")
        return 0

    missing = []
    with_location = 0
    with_kommune = 0
    for row in all_rows:
        loc = row.get("location")
        if loc:
            with_location += 1
        kommune = (row.get("kommune") or "").strip()
        if kommune and not re.match(r"^\d+$", kommune):
            with_kommune += 1
            continue
        lon, lat = parse_point(loc)
        if lon is None or lat is None:
            continue
        missing.append({"id": row["id"], "title": row.get("title") or "", "lat": lat, "lon": lon})

    print(f"Shelters i DB: {len(all_rows)}, med location: {with_location}, med gyldig kommune: {with_kommune}, mangler kommune: {len(missing)}")
    if not missing:
        print("Ingen shelters mangler kommune (eller har allerede gyldig kommune).")
        return 0

    print(f"Finder by for {len(missing)} shelter(s) via Nominatim (ca. {len(missing) * RATE_LIMIT_S:.0f} sek)...")
    if args.dry_run:
        print("(dry-run – ingen opdateringer)")
    updated = 0
    for i, s in enumerate(missing):
        name = reverse_geocode(s["lat"], s["lon"])
        if name:
            if not args.dry_run:
                supabase.table("shelters").update({"kommune": name}).eq("id", s["id"]).execute()
            updated += 1
            print(f"  [{i+1}/{len(missing)}] {s['title'][:50]} → {name}")
        else:
            print(f"  [{i+1}/{len(missing)}] {s['title'][:50]} → (ingen by fundet)")
        if i < len(missing) - 1:
            time.sleep(RATE_LIMIT_S)
    print(f"Færdig. Opdateret {updated} shelter(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
