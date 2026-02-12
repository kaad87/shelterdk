#!/usr/bin/env python3
"""
Hent Naturstyrelsen booking-data (book.naturstyrelsen.dk).

URLs findes enten automatisk (Playwright scraper søgesiden) eller fra en fil
naturstyrelsen_urls.txt. Hvis filen mangler eller er tom, køres discovery først.

1. (Valgfrit) Opret naturstyrelsen_urls.txt med én URL per linje – ellers køres
   discover_naturstyrelsen_urls.py automatisk (kræver: pip3 install playwright,
   python3 -m playwright install chromium).
2. Kør: python3 fetch_naturstyrelsen_from_urls.py

Udtrækker titel (h1), beskrivelse, adresse fra teksten og geocoder adresse hvis muligt.
Output: naturstyrelsen_shelters.geojson + naturstyrelsen_raw i Supabase (efter migration 003).
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

URLS_FILE = os.path.join(_script_dir, "naturstyrelsen_urls.txt")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
}


def _extract_place_candidates(html: str, url: str, title: str):
    """Udtræk mulige stedsnavne til geocoding: adresse, titel-mønstre, URL-slug."""
    candidates = []
    # 1) Klassisk adresse fra teksten
    addr = extract_address_from_html(html)
    if addr:
        candidates.append(addr)
    # 2) Fra titel: "Shelterplads i Vindum Skov", "Bålhytte ved Rabjerg", "X - Stednavn"
    if title:
        t = title.strip()
        m = re.search(r"\s+i\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\s\-]+(?:Skov|Hegn|Sti|Strand|Sø|Å|Skove))\b", t, re.I)
        if m:
            candidates.append(m.group(1).strip())
        m = re.search(r"\s+ved\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\s\-]{2,40}?)(?:\s+[-–]|\s*$)", t, re.I)
        if m:
            candidates.append(m.group(1).strip())
        m = re.search(r"\s+i\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\s\-]{2,50}?)(?:\s+[-–]|\s+shelter|\s*$)", t, re.I)
        if m:
            s = m.group(1).strip()
            if len(s) > 2 and s not in candidates:
                candidates.append(s)
    # 3) Fra URL-slug: shelterplads-i-vindum-skov-shelter-nr-1 -> "Vindum Skov"
    slug = url.rstrip("/").split("/")[-1] if "/" in url else ""
    if slug:
        slug = re.sub(r"-(?:shelter|shelterplads|bålhytte|lejrplads|nr-\d+|bookbar)$", "", slug, flags=re.I)
        slug = slug.replace("-", " ").strip()
        if slug and len(slug) > 2:
            candidates.append(slug)
    # 4) Fra beskrivelsestekst: "ved [Sted]", "i [Skov]"
    block = re.sub(r"<[^>]+>", " ", html)
    block = re.sub(r"\s+", " ", block)[:2000]
    for m in re.finditer(r"(?:ved|nær|i)\s+([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå\s\-]{2,30}?(?:Skov|vej|Hegn|Strand|Sø))\b", block, re.I):
        s = m.group(1).strip()
        if s and s not in candidates and len(s) > 3:
            candidates.append(s)
    seen = set()
    out = []
    for c in candidates:
        if not c or len(c) < 3:
            continue
        c = c.strip()[:80]
        key = c.lower()
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def scrape_html(html, url):
    """Udtræk titel, beskrivelse, adresse fra Naturstyrelsen-side. Geocoder adresse hvis ingen koordinater."""
    out = {"url": url, "title": "", "description": "", "lat": None, "lon": None, "booking_url": url, "address": None, "geocoded": False}

    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if m:
        out["title"] = re.sub(r"\s+", " ", m.group(1)).strip()
    m = re.search(r"<h1[^>]*>([^<]+)</h1>", html, re.I)
    if m:
        out["title"] = re.sub(r"\s+", " ", m.group(1)).strip()
    if not out["title"]:
        slug = url.rstrip("/").split("/")[-1] if "/" in url else "shelter"
        out["title"] = slug.replace("-", " ").title()

    # Beskrivelse: første meningsfulde blok før "Booking til" eller form
    desc_match = re.search(
        r"<h1[^>]*>.*?</h1>\s*([^<]+(?:\s*<[^h/][^>]*>[^<]*)*)",
        html,
        re.I | re.DOTALL,
    )
    if desc_match:
        block = re.sub(r"<[^>]+>", " ", desc_match.group(1))
        block = re.sub(r"\s+", " ", block).strip()
        if "Booking til" not in block and len(block) > 20:
            out["description"] = block[:500]

    # Koordinater: Google Maps mønster eller data-attributter (sjældent på Naturstyrelsen)
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
    # Koordinater i JavaScript (fx kort-config)
    if out["lat"] is None:
        lats, lons = [], []
        for m in re.finditer(r'["\']?(?:lat|latitude)["\']?\s*:\s*([+-]?\d+\.?\d+)', html, re.I):
            try:
                v = float(m.group(1))
                if 54 <= v <= 58:
                    lats.append(v)
                    break
            except ValueError:
                pass
        for m in re.finditer(r'["\']?(?:lng|lon|longitude)["\']?\s*:\s*([+-]?\d+\.?\d+)', html, re.I):
            try:
                v = float(m.group(1))
                if 8 <= v <= 13:
                    lons.append(v)
                    break
            except ValueError:
                pass
        if lats and lons:
            out["lat"], out["lon"] = lats[0], lons[0]

    # Ingen koordinater: prøv flere kandidater (adresse, titel, slug, beskrivelse)
    if out["lat"] is None:
        candidates = _extract_place_candidates(html, url, out["title"])
        for candidate in candidates:
            lat, lon = geocode_address(candidate)
            if lat is not None and lon is not None:
                out["lat"], out["lon"] = lat, lon
                out["address"] = candidate
                out["geocoded"] = True
                break

    return out


def main():
    urls = []
    if os.path.isfile(URLS_FILE):
        with open(URLS_FILE, encoding="utf-8") as f:
            urls = [
                u.strip()
                for u in f
                if u.strip() and not u.strip().startswith("#") and "book.naturstyrelsen.dk" in u and "/sted/" in u
            ]
    if not urls:
        print("Ingen URLs i", URLS_FILE, "– finder URLs automatisk med Playwright...")
        try:
            from discover_naturstyrelsen_urls import discover_urls
            discovered = discover_urls()
            if not discovered:
                print("Playwright fandt 0 URLs. Installer browser: python3 -m playwright install chromium")
                print("Eller opret manuelt", URLS_FILE, "med én URL per linje (fx fra Google: site:book.naturstyrelsen.dk/sted/)")
                return
            urls = discovered
            with open(URLS_FILE, "w", encoding="utf-8") as f:
                f.write("# Auto-genereret af discover_naturstyrelsen_urls\n")
                for u in urls:
                    f.write(u + "\n")
            print("Fundet", len(urls), "URLs (gemt i", URLS_FILE, "). Henter sider...")
        except ImportError as e:
            print("Kunne ikke køre auto-discovery:", e)
            print("Opret", URLS_FILE, "med én URL per linje, eller installér Playwright:")
            print("  pip3 install playwright && python3 -m playwright install chromium")
            return

    print(f"Henter {len(urls)} sider fra book.naturstyrelsen.dk...")
    features = []
    seen_coords = set()
    for i, url in enumerate(urls):
        print(f"  {i+1}/{len(urls)}: {url[:65]}...")
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
                pass  # behold alligevel (flere shelters samme sted)
            seen_coords.add(key)
        props = {
            "name": data["title"],
            "description": data.get("description", ""),
            "source_url": url,
            "booking_url": data["booking_url"],
            "address": data.get("address"),
            "geocoded": data.get("geocoded", False),
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
        time.sleep(0.6)

    with_coords = [f for f in features if f.get("geometry") and f["geometry"].get("coordinates")]
    geocoded_count = sum(1 for f in with_coords if f.get("properties", {}).get("geocoded"))
    print(f"\nFandt {len(with_coords)} steder med koordinater, {len(features) - len(with_coords)} uden.")
    if geocoded_count:
        print(f"  ({geocoded_count} koordinater fra adresse-geocoding)")

    if with_coords:
        out_path = os.path.join(_script_dir, "naturstyrelsen_shelters.geojson")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": with_coords}, f, ensure_ascii=False, indent=2)
        print("Gemt som", out_path)

    all_path = os.path.join(_script_dir, "naturstyrelsen_scraped.json")
    with open(all_path, "w", encoding="utf-8") as f:
        json.dump(features, f, ensure_ascii=False, indent=2)
    print("Alle:", all_path)

    url_env = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key_env = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if url_env and key_env and features:
        try:
            from supabase import create_client
            from slugify import slugify
            supabase = create_client(url_env, key_env)
            for f in features:
                p = f.get("properties", {})
                g = f.get("geometry")
                co = g.get("coordinates", [0, 0]) if g else None
                if co and len(co) >= 2:
                    lon, lat = co[0], co[1]
                else:
                    lon, lat = None, None
                name = p.get("name", "Shelter")
                src_url = p.get("source_url", "")
                slug = src_url.rstrip("/").split("/")[-1] if "/" in src_url else slugify(name)
                nid = f"naturstyrelsen-{slug}"
                loc_str = f"POINT({lon} {lat})" if lon is not None and lat is not None else None
                row = {
                    "naturstyrelsen_id": nid,
                    "name": name,
                    "location": loc_str,
                    "booking_url": p.get("booking_url") or p.get("source_url"),
                    "raw": {k: v for k, v in p.items() if k not in ("no_coords",)},
                }
                if loc_str:
                    try:
                        supabase.table("naturstyrelsen_raw").upsert(row, on_conflict="naturstyrelsen_id").execute()
                    except Exception as e:
                        print("  DB:", e)
            print("Opdateret naturstyrelsen_raw. Kør: python3 match_naturstyrelsen_to_shelters.py")
        except Exception as e:
            print("Supabase:", e)


if __name__ == "__main__":
    main()
