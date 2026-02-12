#!/usr/bin/env python3
"""
Matcher Book en Shelter-punkter med GeoFA-shelters (nærmeste inden for ~300 m)
og opdaterer shelters med booking_url m.m. fra Book en Shelter.

Kør: python3 match_bookenshelter_to_shelters.py

Kræver: shelters og bookenshelter_raw er fyldt (kør import_shelters.py og fetch_bookenshelter_playwright.py først).
"""
import math
import os
import re

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

# Maks afstand (meter) for at acceptere et match
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
    R = 6_371_000  # meter
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def main():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return

    from supabase import create_client
    supabase = create_client(url, key)

    # Hent alle shelters (id, slug, title, location)
    r_shelters = supabase.table("shelters").select("id,slug,title,location").execute()
    shelters = []
    for row in r_shelters.data or []:
        lon, lat = parse_point(row.get("location"))
        if lon is not None and lat is not None:
            shelters.append({
                "id": row["id"],
                "slug": row.get("slug"),
                "title": row.get("title"),
                "lon": lon,
                "lat": lat,
            })

    # Hent alle bookenshelter_raw
    r_bes = supabase.table("bookenshelter_raw").select("id,bookenshelter_id,name,location,booking_url,raw").execute()
    bes_list = []
    for row in r_bes.data or []:
        lon, lat = parse_point(row.get("location"))
        if lon is not None and lat is not None:
            bes_list.append({
                "id": row["id"],
                "bookenshelter_id": row.get("bookenshelter_id"),
                "name": row.get("name"),
                "lon": lon,
                "lat": lat,
                "booking_url": (row.get("booking_url") or "").strip() or None,
                "raw": row.get("raw"),
            })

    if not shelters:
        print("Ingen shelters i databasen. Kør import_shelters.py først.")
        return
    if not bes_list:
        print("Ingen rækker i bookenshelter_raw. Kør fetch_bookenshelter_playwright.py og import_bookenshelter_to_raw.py.")
        return

    print(f"Matcher {len(bes_list)} Book en Shelter-punkter mod {len(shelters)} shelters (max {MAX_DISTANCE_M} m)...")

    updated = 0
    for bes in bes_list:
        best_id = None
        best_dist = float("inf")
        for s in shelters:
            d = haversine_m(bes["lon"], bes["lat"], s["lon"], s["lat"])
            if d < best_dist and d <= MAX_DISTANCE_M:
                best_dist = d
                best_id = s["id"]
        if best_id and bes.get("booking_url"):
            try:
                supabase.table("shelters").update({
                    "booking_url": bes["booking_url"],
                }).eq("id", best_id).execute()
                updated += 1
            except Exception as e:
                print("Fejl ved opdatering", best_id, ":", e)

    print(f"Opdateret {updated} shelters med booking_url fra Book en Shelter.")


if __name__ == "__main__":
    main()
