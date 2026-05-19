#!/usr/bin/env python3
"""
Matcher Naturstyrelsen-punkter (book.naturstyrelsen.dk) med GeoFA-shelters.
Sætter booking_url på shelters der matcher (inden for ~350 m), kun hvis shelter
ikke allerede har booking_url (så Book en Shelter beholder forrang).

Kør: python3 match_naturstyrelsen_to_shelters.py

Kræver: shelters fyldt (import_shelters.py), naturstyrelsen_raw fyldt (migration 003 + fetch_naturstyrelsen_from_urls.py).
"""
import math
import os
import re
from typing import Optional

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")
try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
except ImportError:
    if os.path.isfile(_env_path):
        with open(_env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())

MAX_DISTANCE_M = 350


def parse_point(location_str):
    """Udtræk lon, lat fra PostGIS POINT-streng eller None."""
    if not location_str or not isinstance(location_str, str):
        return None, None
    m = re.match(r"POINT\s*\(\s*([\d.e+-]+)\s+([\d.e+-]+)\s*\)", location_str, re.I)
    if not m:
        return None, None
    try:
        return float(m.group(1)), float(m.group(2))
    except (TypeError, ValueError):
        return None, None


def haversine_m(lon1, lat1, lon2, lat2):
    """Afstand i meter mellem to punkter (WGS84)."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def fetch_all_rows(supabase, table, select_sql):
    rows = []
    page_size = 1000
    start = 0
    while True:
        result = (
            supabase.table(table)
            .select(select_sql)
            .range(start, start + page_size - 1)
            .execute()
        )
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows


def main():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return

    from supabase import create_client
    supabase = create_client(url, key)

    r_shelters = fetch_all_rows(supabase, "shelters", "id,slug,title,location,booking_url")
    shelters = []
    for row in r_shelters:
        lon, lat = parse_point(row.get("location"))
        if lon is not None and lat is not None:
            shelters.append({
                "id": row["id"],
                "slug": row.get("slug"),
                "title": row.get("title"),
                "lon": lon,
                "lat": lat,
                "booking_url": (row.get("booking_url") or "").strip() or None,
            })

    r_nst = fetch_all_rows(
        supabase,
        "naturstyrelsen_raw",
        "id,naturstyrelsen_id,name,location,booking_url,raw",
    )
    nst_list = []
    for row in r_nst:
        lon, lat = parse_point(row.get("location"))
        if lon is not None and lat is not None:
            nst_list.append({
                "id": row["id"],
                "naturstyrelsen_id": row.get("naturstyrelsen_id"),
                "name": row.get("name"),
                "lon": lon,
                "lat": lat,
                "booking_url": (row.get("booking_url") or "").strip() or None,
            })

    if not shelters:
        print("Ingen shelters i databasen. Kør import_shelters.py først.")
        return
    if not nst_list:
        print("Ingen rækker i naturstyrelsen_raw. Kør migration 003 og fetch_naturstyrelsen_from_urls.py.")
        return

    print(f"Matcher {len(nst_list)} Naturstyrelsen-punkter mod {len(shelters)} shelters (max {MAX_DISTANCE_M} m)...")
    print("Sætter booking_url fra Naturstyrelsen. Overskriver udinaturen.dk (generisk), beholder Book en Shelter.")

    def should_overwrite(existing_url: Optional[str], nst_url: str) -> bool:
        """True hvis vi skal sætte nst_url. Overskriv udinaturen.dk – book.naturstyrelsen.dk er mere præcist."""
        if not (existing_url or "").strip():
            return True
        ex = (existing_url or "").lower()
        if "udinaturen.dk" in ex and "book.naturstyrelsen.dk" in (nst_url or "").lower():
            return True  # Naturstyrelsen-URL er mere specifik for disse shelters
        if "book.naturstyrelsen.dk" in ex:
            return False  # Allerede rigtigt
        if "bookenshelter" in ex or "bookenshelter.dk" in ex:
            return False  # Book en Shelter beholder forrang
        return False  # Ukendt – behold eksisterende

    updated = 0
    for nst in nst_list:
        best_id = None
        best_dist = float("inf")
        best_shelter = None
        for s in shelters:
            d = haversine_m(nst["lon"], nst["lat"], s["lon"], s["lat"])
            if d < best_dist and d <= MAX_DISTANCE_M:
                if not should_overwrite(s.get("booking_url"), nst.get("booking_url") or ""):
                    continue  # spring over – har bedre/andet link
                best_dist = d
                best_id = s["id"]
                best_shelter = s
        if best_id and nst.get("booking_url") and best_shelter:
            try:
                payload = {
                    "booking_url": nst["booking_url"],
                    "booking_provider": "naturstyrelsen",
                    "booking_link_mode": "external_direct",
                    "booking_lookup_key": (nst.get("booking_url") or "").rstrip("/").split("/")[-1] or None,
                    "booking_confidence": "verified_match",
                }
                supabase.table("shelters").update(payload).eq("id", best_id).execute()
                updated += 1
            except Exception as e:
                print("Fejl ved opdatering", best_id, ":", e)

    print(f"Opdateret {updated} shelters med booking_url fra Naturstyrelsen.")


if __name__ == "__main__":
    main()
