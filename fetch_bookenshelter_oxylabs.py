#!/usr/bin/env python3
"""
Hent Book en Shelter-data via Oxylabs Web Scraper API:

1. Google Search (site:bookenshelter.dk) – find alle shelter-URL'er uden at bruge deres sitemap.
2. Universal – hent hver side gennem Oxylabs (undgår bookenshelter.dks 455-firewall).
3. Scrape HTML for koordinater, titel, booking-link, billeder.

Kræver Oxylabs-konto og credentials i .env:
  OXYLABS_USER=din_brugernavn
  OXYLABS_PASSWORD=din_adgangskode

Kør: python3 fetch_bookenshelter_oxylabs.py

Dokumentation: https://developers.oxylabs.io/scraper-apis/web-scraper-api
"""
import json
import os
import re
import time

import requests

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

OXYLABS_ENDPOINT = "https://realtime.oxylabs.io/v1/queries"


def oxylabs_request(payload):
    """Send request til Oxylabs Realtime API. Returnerer response JSON."""
    user = os.environ.get("OXYLABS_USER")
    password = os.environ.get("OXYLABS_PASSWORD")
    if not user or not password:
        raise ValueError("Sæt OXYLABS_USER og OXYLABS_PASSWORD i .env (fra dashboard.oxylabs.io)")
    r = requests.post(
        OXYLABS_ENDPOINT,
        auth=(user, password),
        json=payload,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def get_urls_via_google_search():
    """Brug Oxylabs Google Search til at finde bookenshelter.dk-URL'er."""
    urls = []
    for query in ["site:bookenshelter.dk shelter", "site:bookenshelter.dk find-en-shelter"]:
        payload = {
            "source": "google_search",
            "query": query,
            "domain": "dk",
            "parse": True,
            "pages": 2,
        }
        try:
            data = oxylabs_request(payload)
        except Exception as e:
            print("  Oxylabs Google Search fejl:", e)
            continue
        for res in data.get("results") or []:
            content = res.get("content") or {}
            if isinstance(content, dict):
                results = content.get("results") or {}
                organic = results.get("organic") or []
                for item in organic:
                    u = (item.get("url") or "").strip()
                    if u and "bookenshelter.dk" in u and u not in urls:
                        urls.append(u)
        time.sleep(1)
    return urls


def is_shelter_url(url):
    """Alle shelter-sider indeholder /shelterplads/ i URL'en."""
    if "/shelterplads/" not in url:
        return False
    path = url.split("bookenshelter.dk")[-1].split("?")[0].lower()
    skip = ("/kontakt", "/handelsbetingelser", "/bookning", "/mad-paa-tur", "/om-bookenshelter", "/kasse", "/spoergsmaal")
    if any(s in path for s in skip):
        return False
    return True


def scrape_page_via_oxylabs(url):
    """Hent én side via Oxylabs Universal og udtræk koordinater, titel, billeder."""
    payload = {
        "source": "universal",
        "url": url,
        "render": "html",
    }
    try:
        data = oxylabs_request(payload)
    except Exception as e:
        print("    Fejl:", e)
        return None
    for res in data.get("results") or []:
        html = res.get("content")
        if not html or not isinstance(html, str):
            continue
        out = {"url": url, "title": "", "lat": None, "lon": None, "booking_url": url, "image_urls": []}

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

        for m in re.finditer(r'<img[^>]+src=["\'](https?://[^"\']*bookenshelter\.dk[^"\']+)["\']', html, re.I):
            src = m.group(1).split("?")[0]
            if src not in out["image_urls"] and not any(x in src for x in ("logo", "icon", "pixel")):
                out["image_urls"].append(src)

        return out
    return None


def main():
    user = os.environ.get("OXYLABS_USER")
    password = os.environ.get("OXYLABS_PASSWORD")
    if not user or not password:
        print("Mangler OXYLABS_USER og OXYLABS_PASSWORD i .env")
        print("Opret konto på https://dashboard.oxylabs.io og tilføj credentials.")
        return

    print("Trin 1: Finder bookenshelter.dk-URL'er via Oxylabs Google Search...")
    urls = get_urls_via_google_search()
    shelter_urls = [u for u in urls if is_shelter_url(u)]
    print(f"  Fandt {len(urls)} URLs, {len(shelter_urls)} ligner shelter-sider.")

    if not shelter_urls:
        print("Ingen shelter-URL'er. Prøv at køre igen eller tjek Oxylabs-konto.")
        return

    print("Trin 2: Henter hver side via Oxylabs Universal og scraper indhold...")
    features = []
    seen_coords = set()
    for i, url in enumerate(shelter_urls[:80]):
        print(f"  {i+1}/{min(len(shelter_urls), 80)}: {url[:65]}...")
        data = scrape_page_via_oxylabs(url)
        if not data:
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
        time.sleep(0.8)

    with_coords = [f for f in features if f.get("geometry") and f["geometry"].get("coordinates")]
    print(f"\nFandt {len(with_coords)} steder med koordinater, {len(features) - len(with_coords)} uden.")

    if with_coords:
        out_path = os.path.join(_script_dir, "bookenshelter_shelters.geojson")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": with_coords}, f, ensure_ascii=False, indent=2)
        print("Gemt som", out_path)

    all_path = os.path.join(_script_dir, "bookenshelter_oxylabs_scraped.json")
    with open(all_path, "w", encoding="utf-8") as f:
        json.dump(features, f, ensure_ascii=False, indent=2)
    print("Alle scrapede sider:", all_path)

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
                    print("  DB fejl", name[:30], ":", e)
            print("Opdateret bookenshelter_raw i Supabase.")
            print("Kør derefter: python3 match_bookenshelter_to_shelters.py")


if __name__ == "__main__":
    main()
