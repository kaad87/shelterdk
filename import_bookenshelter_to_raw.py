#!/usr/bin/env python3
"""
Importer Book en Shelter data fra bookenshelter_shelters.geojson til Supabase bookenshelter_raw.
Kør først fetch_bookenshelter_playwright.py for at generere GeoJSON, derefter dette script.

Kør: python3 import_bookenshelter_to_raw.py
"""
import json
import os
from slugify import slugify

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

geojson_path = os.path.join(_script_dir, "bookenshelter_shelters.geojson")


def main():
    if not os.path.isfile(geojson_path):
        print("Ingen fil:", geojson_path)
        print("Kør først: python3 fetch_bookenshelter_playwright.py")
        return
    with open(geojson_path, encoding="utf-8") as f:
        data = json.load(f)
    features = data.get("features", [])
    if not features:
        print("Ingen features i", geojson_path)
        return

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return

    from supabase import create_client
    supabase = create_client(url, key)
    count = 0
    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [0, 0])
        lon, lat = coords[0], coords[1]
        name = props.get("name", "Shelter")
        booking_url = props.get("booking_url") or ""
        raw = props.get("raw")
        if raw is None:
            raw = {k: v for k, v in props.items() if k != "raw"}
        bes_id = f"bookenshelter-{slugify(name)}-{str(lon)[:8].replace('.', '')}-{str(lat)[:8].replace('.', '')}"
        try:
            supabase.table("bookenshelter_raw").upsert({
                "bookenshelter_id": bes_id,
                "name": name,
                "location": f"POINT({lon} {lat})",
                "booking_url": booking_url or None,
                "raw": raw,
            }, on_conflict="bookenshelter_id").execute()
            count += 1
        except Exception as e:
            print("Fejl ved", name, ":", e)
    print("Importeret", count, "rækker til bookenshelter_raw.")


if __name__ == "__main__":
    main()
