#!/usr/bin/env python3
"""
Hent Book en Shelter-data via sitemap: hent sitemap → besøg hver URL → scrape titel, koordinater, booking-link, billeder.

Kør lokalt (bookenshelter.dk kan blokere script-forespørgsler fra datacentre):
  python3 fetch_bookenshelter_sitemap.py

Kræver: requests. Output: bookenshelter_shelters.geojson (+ evt. bookenshelter_raw i Supabase).
"""
import json
import os
import re
import time
import xml.etree.ElementTree as ET

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

BASE = "https://bookenshelter.dk"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
}

# Sitemap-URL'er – shelterplads-sitemap indeholder de enkelte shelter-URL'er (alle indeholder /shelterplads/)
SITEMAP_URLS = [
    f"{BASE}/shelterplads-sitemap.xml",
    f"{BASE}/shelter-sitemap.xml",
    f"{BASE}/wp-sitemap.xml",
    f"{BASE}/sitemap.xml",
    f"{BASE}/sitemap_index.xml",
]


def get_sitemap_urls():
    """Hent alle <loc> fra sitemap (inkl. indeks-sitemaps)."""
    all_locs = []
    seen = set()

    for url in SITEMAP_URLS:
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code != 200:
                continue
            ct = (r.headers.get("content-type") or "").lower()
            if "xml" not in ct and "html" in ct:
                continue
            root = ET.fromstring(r.content)
            # WordPress sitemap: <url><loc>...</loc></url>  eller sitemap index: <sitemap><loc>...</loc></sitemap>
            for elem in root.iter():
                if elem.tag.endswith("loc"):
                    loc = (elem.text or "").strip()
                    if loc and loc not in seen and "bookenshelter.dk" in loc:
                        seen.add(loc)
                        all_locs.append(loc)
            # Hvis det er en sitemap-index, hent under-sitemaps
            for elem in root.iter():
                if elem.tag.endswith("loc"):
                    loc = (elem.text or "").strip()
                    if loc and "sitemap" in loc and loc not in seen:
                        seen.add(loc)
                        try:
                            r2 = requests.get(loc, headers=HEADERS, timeout=20)
                            if r2.status_code == 200:
                                sub = ET.fromstring(r2.content)
                                for e in sub.iter():
                                    if e.tag.endswith("loc"):
                                        u = (e.text or "").strip()
                                        if u and u not in seen and "bookenshelter.dk" in u and "/shelterplads/" in u:
                                            seen.add(u)
                                            all_locs.append(u)
                        except Exception:
                            pass
            if all_locs:
                break
        except Exception as e:
            print("  Sitemap", url, ":", e)
            continue

    return all_locs


def is_shelter_page(url):
    """Alle shelter-sider indeholder /shelterplads/ i URL'en."""
    if "/shelterplads/" not in url:
        return False
    path = url.split("bookenshelter.dk")[-1].split("?")[0].lower()
    skip = ("/kontakt", "/handelsbetingelser", "/bookning", "/mad-paa-tur", "/om-bookenshelter", "/kasse", "/spoergsmaal")
    if any(s in path for s in skip):
        return False
    return True


def scrape_page(url):
    """Scrape én side for koordinater, titel, booking-link, billeder."""
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return None
        html = r.text
    except Exception as e:
        print("  Fejl", url[:60], "...", e)
        return None

    out = {"url": url, "title": "", "lat": None, "lon": None, "booking_url": url, "image_urls": [], "address": None, "geocoded": False}

    # Titel: <title> eller <h1>
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if m:
        out["title"] = re.sub(r"\s+", " ", m.group(1)).strip()
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
    if m and not out["title"]:
        out["title"] = re.sub(r"\s+", " ", m.group(1)).strip()
    if not out["title"]:
        out["title"] = url.split("/")[-2] if "/" in url.rstrip("/") else "Shelter"

    # Koordinater: Google Maps mønster !3dLAT!4dLON
    for m in re.finditer(r"!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)", html):
        try:
            lat, lon = float(m.group(1)), float(m.group(2))
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                out["lat"], out["lon"] = lat, lon
                break
        except ValueError:
            pass

    # data-lat / data-lng
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

    # Billeder: img src fra deres domæne
    for m in re.finditer(r'<img[^>]+src=["\'](https?://[^"\']*bookenshelter\.dk[^"\']+)["\']', html, re.I):
        src = m.group(1).split("?")[0]
        if src and src not in out["image_urls"] and not any(x in src for x in ("logo", "icon", "pixel")):
            out["image_urls"].append(src)

    return out


def main():
    print("Henter sitemap fra bookenshelter.dk...")
    urls = get_sitemap_urls()
    if not urls:
        print("Ingen URLs i sitemap (eller sitemap blokeret). Prøv at køre scriptet lokalt fra din egen maskine.")
        return

    shelter_urls = [u for u in urls if is_shelter_page(u)]
    print(f"Fandt {len(urls)} URLs i sitemap, {len(shelter_urls)} ligner shelter-sider.")

    if not shelter_urls:
        # Brug alle (undtagen åbenlyse ikke-shelters) som fallback
        shelter_urls = [u for u in urls if "find-en-shelter" in u or "/sted/" in u][:200]

    features = []
    seen_coords = set()

    for i, url in enumerate(shelter_urls[:150]):
        print(f"  Scraper {i+1}/{min(len(shelter_urls), 150)}: {url[:70]}...")
        data = scrape_page(url)
        if not data:
            continue
        if data["lat"] is not None and data["lon"] is not None:
            key = (round(data["lat"], 5), round(data["lon"], 5))
            if key in seen_coords:
                continue
            seen_coords.add(key)
        else:
            # Behold også sider uden coords (vi kan matche på titel/URL senere)
            pass

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
            # Gem uden geometri (kan bruges til at berige eksisterende shelters via titel-match)
            features.append({
                "type": "Feature",
                "properties": {**props, "no_coords": True},
                "geometry": None,
            })

        time.sleep(0.5)

    # Kun beholde features med koordinater til GeoJSON
    with_coords = [f for f in features if f.get("geometry") and f["geometry"].get("coordinates")]
    geocoded_count = sum(1 for f in with_coords if f.get("properties", {}).get("geocoded"))
    print(f"\nFandt {len(with_coords)} steder med koordinater, {len(features) - len(with_coords)} uden.")
    if geocoded_count:
        print(f"  ({geocoded_count} koordinater fra adresse-geocoding)")

    if with_coords:
        geojson = {"type": "FeatureCollection", "features": with_coords}
        out_path = os.path.join(_script_dir, "bookenshelter_shelters.geojson")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        print("Gemt som", out_path)

    # Gem også alle (inkl. uden coords) til debug/berigelse
    all_path = os.path.join(_script_dir, "bookenshelter_sitemap_scraped.json")
    with open(all_path, "w", encoding="utf-8") as f:
        json.dump(features, f, ensure_ascii=False, indent=2)
    print("Alle scrapede sider (inkl. uden coords):", all_path)

    # Supabase bookenshelter_raw
    url_env = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key_env = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if url_env and key_env and with_coords:
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
                print("  DB fejl", name[:30], ":", e)
        print("Opdateret bookenshelter_raw i Supabase.")


if __name__ == "__main__":
    main()
