#!/usr/bin/env python3
"""
Forsøg på at hente shelter-data fra bookenshelter.dk.
De har ikke et offentligt API – dette script prøver at finde data på find-en-shelter-siden
(fx indlejret JSON til kortet). Kør: python3 import_bookenshelter.py

Kræver: requests. Supabase-import kræver også .env med NEXT_PUBLIC_SUPABASE_*.
"""
import json
import os
import re
import requests
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

FIND_SHELTER_URL = "https://bookenshelter.dk/find-en-shelter/"
headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ShelterDK/1.0"}


def fetch_page():
    """Hent find-en-shelter HTML."""
    r = requests.get(FIND_SHELTER_URL, headers=headers, timeout=30)
    r.raise_for_status()
    return r.text


def extract_json_from_html(html):
    """Find JSON-objekter i script-tags eller data-attributter (typisk kort-plugins)."""
    found = []
    # Script med var x = {...}; eller const x = {...}
    for m in re.finditer(r"(?:var|let|const)\s+\w+\s*=\s*(\{[\s\S]*?\});?\s*(?:</script>|$)", html):
        try:
            s = m.group(1)
            if "lat" in s or "shelter" in s.lower() or "marker" in s.lower() or "coordinate" in s.lower():
                obj = json.loads(s)
                found.append(obj)
        except (json.JSONDecodeError, ValueError):
            pass
    # type="application/json" eller application/ld+json
    for m in re.finditer(r"<script[^>]*type=[\"']application/(?:json|ld\+json)[\"'][^>]*>([\s\S]*?)</script>", html, re.I):
        try:
            found.append(json.loads(m.group(1).strip()))
        except json.JSONDecodeError:
            pass
    # data-shelters="..." eller data-markers="..."
    for m in re.finditer(r'data-(?:shelters|markers|locations)=["\'](\{.*?\})["\']', html, re.DOTALL):
        try:
            found.append(json.loads(m.group(1)))
        except json.JSONDecodeError:
            pass
    return found


def json_to_features(obj, features=None):
    """Recursivt find features/locations med lat/lon eller coordinates."""
    if features is None:
        features = []
    if isinstance(obj, list):
        for item in obj:
            json_to_features(item, features)
        return features
    if isinstance(obj, dict):
        lat = obj.get("lat") or obj.get("latitude") or (obj.get("geometry", {}) or {}).get("coordinates", [None, None])[1]
        lon = obj.get("lng") or obj.get("lon") or obj.get("longitude") or (obj.get("geometry", {}) or {}).get("coordinates", [None, None])[0]
        if lat is not None and lon is not None:
            name = obj.get("name") or obj.get("title") or obj.get("navn") or "Shelter"
            features.append({
                "type": "Feature",
                "properties": {"name": name, "description": obj.get("description") or obj.get("beskrivelse") or ""},
                "geometry": {"type": "Point", "coordinates": [float(lon), float(lat)]},
            })
        for v in obj.values():
            json_to_features(v, features)
    return features


def main():
    print("Henter", FIND_SHELTER_URL, "...")
    try:
        html = fetch_page()
    except requests.RequestException as e:
        print("Kunne ikke hente siden:", e)
        return
    print("Søger efter indlejret shelter-data...")
    candidates = extract_json_from_html(html)
    features = []
    for c in candidates:
        features = json_to_features(c, features)
    # Dedup på koordinater
    seen = set()
    unique = []
    for f in features:
        co = tuple(f["geometry"]["coordinates"])
        if co not in seen:
            seen.add(co)
            unique.append(f)
    if not unique:
        print("Ingen shelter-koordinater fundet på siden.")
        print("Book en Shelter bruger sandsynligvis et plugin der loader data dynamisk.")
        print("Du kan skrive til kontakt@bookenshelter.dk og spørge om API eller export (CSV/GeoJSON).")
        return
    print(f"Fandt {len(unique)} steder med koordinater.")
    geojson = {"type": "FeatureCollection", "features": unique}
    out_path = os.path.join(_script_dir, "bookenshelter_shelters.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print("Gemt som", out_path)
    # Valgfri: importer til Supabase hvis .env er sat
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if url and key:
        from supabase import create_client
        supabase = create_client(url, key)
        count = 0
        for feat in unique:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [0, 0])
            lon, lat = coords[0], coords[1]
            title = props.get("name") or "Shelter"
            slug = f"{slugify(title)}-{str(lon)[:6].replace('.', '')}"
            try:
                supabase.table("shelters").upsert({
                    "title": title,
                    "slug": slug,
                    "description": props.get("description") or "",
                    "location": f"POINT({lon} {lat})",
                    "region": "Danmark",
                    "toilet": "unknown",
                    "access": "public",
                    "mode": "first_come",
                    "source_id": f"bookenshelter-{slug}",
                    "verified": True,
                }, on_conflict="slug").execute()
                count += 1
            except Exception as e:
                print("Fejl ved", title, ":", e)
        print("Importeret", count, "shelters til Supabase.")
    else:
        print("Supabase ikke konfigureret – brug kun GeoJSON-filen eller sæt .env.")


if __name__ == "__main__":
    main()
