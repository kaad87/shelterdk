#!/usr/bin/env python3
"""
Gratis: Hent Book en Shelter-data ved at scrape en liste af URLs.

Du selv finder URL'erne (alle shelter-sider indeholder /shelterplads/ i URL'en).
Søg fx: site:bookenshelter.dk shelterplads – gem links i bookenshelter_urls.txt.

1. Opret filen bookenshelter_urls.txt med én URL per linje, fx:
   https://bookenshelter.dk/fyn/find-en-shelter/shelterplads/et-navn/
   https://bookenshelter.dk/naturlandet/find-en-shelter/shelterplads/andet-navn/

2. Kør (lokal maskine – så bookenshelter.dk ofte ikke blokerer):
   python3 fetch_bookenshelter_from_urls.py

Output: bookenshelter_shelters.geojson + evt. bookenshelter_raw i Supabase.
"""
import json
import os
import re
import time

import requests

from geocode_bookenshelter import extract_address_from_html, geocode_address

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")
try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
except ImportError:
    pass
if os.path.isfile(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

URLS_FILE = os.path.join(_script_dir, "bookenshelter_urls.txt")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
}


def scrape_html(html, url):
    """Udtræk titel, koordinater, adresse, billeder fra HTML. Geocoder adresse hvis ingen koordinater."""
    out = {"url": url, "title": "", "lat": None, "lon": None, "booking_url": url, "image_urls": [], "address": None, "geocoded": False}
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if m:
        out["title"] = re.sub(r"\s+", " ", m.group(1)).strip()
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
    if m and not out["title"]:
        out["title"] = re.sub(r"\s+", " ", m.group(1)).strip()
    if not out["title"]:
        out["title"] = url.split("/")[-2] if "/" in url.rstrip("/") else "Shelter"

    for m in re.finditer(r"!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)", html):
        try:
            lat, lon = float(m.group(1)), float(m.group(2))
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                out["lat"], out["lon"] = lat, lon
                break
        except ValueError:
            pass
    if out["lat"] is None:
        m = re.search(r'data-lat=["\']([^"\']+)["\'].*?data-l[no]g=["\']([^"\']+)["\']', html, re.I | re.DOTALL)
        if not m:
            m = re.search(r'data-l[no]g=["\']([^"\']+)["\'].*?data-lat=["\']([^"\']+)["\']', html, re.I | re.DOTALL)
        if m:
            try:
                lat, lon = float(m.group(1)), float(m.group(2))
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    out["lat"], out["lon"] = lat, lon
            except (ValueError, IndexError):
                pass

    # Ingen koordinater: prøv adresse → geocoding
    if out["lat"] is None:
        out["address"] = extract_address_from_html(html)
        if out["address"]:
            lat, lon = geocode_address(out["address"])
            if lat is not None and lon is not None:
                out["lat"], out["lon"] = lat, lon
                out["geocoded"] = True

    for m in re.finditer(r'<img[^>]+src=["\'](https?://[^"\']*bookenshelter\.dk[^"\']+)["\']', html, re.I):
        src = m.group(1).split("?")[0]
        if src not in out["image_urls"] and not any(x in src for x in ("logo", "icon", "pixel")):
            out["image_urls"].append(src)
    return out


def main():
    if not os.path.isfile(URLS_FILE):
        print("Opret filen", URLS_FILE)
        print("Med én URL per linje. Eksempel:")
        print("  https://bookenshelter.dk/fyn/find-en-shelter/et-shelter-navn/")
        print("Du kan finde URLs ved at søge i Google: site:bookenshelter.dk shelter")
        print("og kopiere links fra søgeresultaterne ind i filen.")
        return

    with open(URLS_FILE, encoding="utf-8") as f:
        urls = [u.strip() for u in f if u.strip() and not u.strip().startswith("#") and "bookenshelter.dk" in u and "/shelterplads/" in u]
    if not urls:
        print("Ingen gyldige URLs i", URLS_FILE)
        return

    print(f"Henter {len(urls)} sider fra bookenshelter.dk (kør lokalt for at undgå blokering)...")
    features = []
    seen_coords = set()
    for i, url in enumerate(urls):
        print(f"  {i+1}/{len(urls)}: {url[:60]}...")
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code != 200:
                print("    Status", r.status_code)
                continue
            data = scrape_html(r.text, url)
        except Exception as e:
            print("    Fejl:", e)
            continue
        if data["lat"] is not None and data["lon"] is not None:
            key = (round(data["lat"], 5), round(data["lon"], 5))
            if key in seen_coords:
                continue
            seen_coords.add(key)
        props = {
            "name": data["title"],
            "description": "",
            "source_url": url,
            "booking_url": data["booking_url"],
            "image_urls": data["image_urls"][:10],
        }
        if data.get("address"):
            props["address"] = data["address"]
        if data.get("geocoded"):
            props["geocoded"] = True
        if data["lat"] is not None and data["lon"] is not None:
            features.append({
                "type": "Feature",
                "properties": props,
                "geometry": {"type": "Point", "coordinates": [data["lon"], data["lat"]]},
            })
        else:
            features.append({
                "type": "Feature",
                "properties": {**props, "no_coords": True},
                "geometry": None,
            })
        time.sleep(0.6)

    with_coords = [f for f in features if f.get("geometry") and f["geometry"].get("coordinates")]
    geocoded_count = sum(1 for f in with_coords if f.get("properties", {}).get("geocoded"))
    print(f"\nFandt {len(with_coords)} steder med koordinater, {len(features) - len(with_coords)} uden.")
    if geocoded_count:
        print(f"  ({geocoded_count} koordinater fra adresse-geocoding)")

    if with_coords:
        out_path = os.path.join(_script_dir, "bookenshelter_shelters.geojson")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": with_coords}, f, ensure_ascii=False, indent=2)
        print("Gemt som", out_path)

    all_path = os.path.join(_script_dir, "bookenshelter_from_urls_scraped.json")
    with open(all_path, "w", encoding="utf-8") as f:
        json.dump(features, f, ensure_ascii=False, indent=2)
    print("Alle:", all_path)

    if with_coords:
        url_env = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key_env = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        if url_env and key_env:
            from supabase import create_client
            from slugify import slugify
            supabase = create_client(url_env, key_env)
            for f in with_coords:
                p = f.get("properties", {})
                g = f.get("geometry", {})
                co = g.get("coordinates", [0, 0])
                lon, lat = co[0], co[1]
                name = p.get("name", "Shelter")
                bid = f"bookenshelter-{slugify(name)}-{str(lon)[:8].replace('.','')}-{str(lat)[:8].replace('.','')}"
                try:
                    supabase.table("bookenshelter_raw").upsert({
                        "bookenshelter_id": bid,
                        "name": name,
                        "location": f"POINT({lon} {lat})",
                        "booking_url": p.get("booking_url") or p.get("source_url"),
                        "raw": p,
                    }, on_conflict="bookenshelter_id").execute()
                except Exception as e:
                    print("  DB:", e)
            print("Opdateret bookenshelter_raw. Kør: python3 match_bookenshelter_to_shelters.py")


if __name__ == "__main__":
    main()
