#!/usr/bin/env python3
"""
Hent billed-URL'er fra udinaturen.dk til shelters der mangler image_url.

Udinaturen viser samme faciliteter som GeoFA (samme id). For hver shelter med source_id
men uden billede hentes siden https://udinaturen.dk/facilitet/?id=<source_id> og
billed-URL'er udtrækkes fra HTML. Billeder loades via JavaScript, så Playwright bruges
hvis simpel HTTP ikke finder nogen (kræver: pip3 install playwright, playwright install chromium).

Kør: python3 fetch_udinaturen_images.py
Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.
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

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ShelterDK/1.0",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
}

# UUID-lignende (udinaturen bruger disse i ?id=)
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def _looks_like_udinaturen_id(source_id):
    """Udinaturen bruger UUID i ?id=; GeoFA objekt_id kan være UUID eller tal."""
    if source_id is None:
        return False
    s = str(source_id).strip()
    if not s:
        return False
    if UUID_RE.match(s):
        return True
    if len(s) == 32 and all(c in "0123456789abcdefABCDEF" for c in s):
        return True  # UUID uden bindestreger
    if s.isdigit() and len(s) <= 20:
        return True  # numerisk id – udinaturen kan bruge det
    return False


def extract_image_urls(html: str) -> list:
    """Udtræk billed-URL'er fra udinaturen-siden. Filtrerer logos og ikoner."""
    urls = []
    # img src
    for m in re.finditer(r'<img[^>]+src=["\'](https?://[^"\']+)["\']', html, re.I):
        u = m.group(1).split("?")[0]
        if u in urls:
            continue
        if any(skip in u.lower() for skip in ("logo", "icon", "sprite", "pixel", "1x1", "placeholder", "avatar")):
            continue
        if any(ext in u.lower() for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif")) or "upload" in u.lower() or "billed" in u.lower():
            urls.append(u)
    # data-src (lazy load)
    for m in re.finditer(r'<img[^>]+data-src=["\'](https?://[^"\']+)["\']', html, re.I):
        u = m.group(1).split("?")[0]
        if u not in urls and not any(skip in u.lower() for skip in ("logo", "icon", "sprite", "pixel")):
            if any(ext in u.lower() for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif")) or "upload" in u.lower():
                urls.append(u)
    # JSON/script med billed-URL'er (fx "url":"https://...")
    for m in re.finditer(r'["\'](https?://[^"\']+\.(?:jpg|jpeg|png|webp|gif))["\']', html, re.I):
        u = m.group(1).split("?")[0]
        if u not in urls and "udinaturen" in u or "geodanmark" in u or "geofa" in u:
            if not any(skip in u.lower() for skip in ("logo", "icon")):
                urls.append(u)
    return urls[:20]  # max 20


def _fetch_images_playwright(facility_url: str) -> list:
    """Hent billed-URL'er via Playwright (JS-renderet side). Returnerer tom liste ved fejl."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.set_default_timeout(15000)
            page.goto(facility_url, wait_until="networkidle")
            page.wait_for_timeout(3000)
            hrefs = page.eval_on_selector_all(
                "img[src*='http']",
                """nodes => nodes
                    .map(img => img.getAttribute('src') || img.getAttribute('data-src') || '')
                    .filter(Boolean)""",
            )
            urls = []
            for h in hrefs:
                u = h.split("?")[0]
                if u in urls:
                    continue
                if any(skip in u.lower() for skip in ("logo", "icon", "sprite", "pixel")):
                    continue
                if any(ext in u.lower() for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif")) or "upload" in u.lower() or "billed" in u.lower():
                    urls.append(u)
            return urls[:20]
        except Exception:
            return []
        finally:
            browser.close()


def main():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return

    from supabase import create_client
    supabase = create_client(url, key)

    # Shelters uden billede men med source_id der ligner udinaturen/GeoFA id
    r = supabase.table("shelters").select("id,title,source_id,image_url").execute()
    to_fetch = []
    for row in (r.data or []):
        sid = row.get("source_id")
        img = row.get("image_url")
        if not _looks_like_udinaturen_id(sid):
            continue
        if img and str(img).strip():
            continue  # har allerede billede
        to_fetch.append({"id": row["id"], "title": row.get("title"), "source_id": sid})

    if not to_fetch:
        print("Ingen shelters fundet uden image_url med udinaturen-agtig source_id.")
        return

    print(f"Henter billeder fra udinaturen.dk for {len(to_fetch)} shelters...")
    updated = 0
    for i, s in enumerate(to_fetch):
        sid = (s["source_id"] or "").strip()
        # udinaturen bruger ofte lowercase UUID i deres links
        # Udinaturen bruger ofte lowercase UUID i links
        uid = sid.lower() if UUID_RE.match(sid) else sid
        facility_url = f"https://udinaturen.dk/facilitet/?id={uid}"
        try:
            resp = requests.get(facility_url, headers=HEADERS, timeout=15)
            if resp.status_code != 200:
                continue
            urls = extract_image_urls(resp.text)
            if not urls:
                urls = _fetch_images_playwright(facility_url)
            if not urls:
                time.sleep(0.4)
                continue
            image_url = urls[0]
            image_urls = urls
            try:
                supabase.table("shelters").update({
                    "image_url": image_url,
                    "image_urls": image_urls,
                }).eq("id", s["id"]).execute()
                updated += 1
                print(f"  [{updated}] {s['title'][:50]}... – {len(urls)} billeder")
            except Exception as e:
                print(f"  DB-fejl {s['id']}: {e}")
        except Exception as e:
            print(f"  Fejl {facility_url[:50]}...: {e}")
        time.sleep(0.6)

    print(f"\nOpdateret {updated} shelters med billeder fra udinaturen.dk.")


if __name__ == "__main__":
    main()
