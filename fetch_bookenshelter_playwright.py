#!/usr/bin/env python3
"""
Hent shelter-data fra bookenshelter.dk ved at køre siden i en browser (Playwright)
og fange de netværkskald der loader kort-data.

Installation (én gang):
  pip3 install playwright
  playwright install chromium

Kør: python3 fetch_bookenshelter_playwright.py
"""
import json
import os
import re
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright er ikke installeret. Kør:")
    print("  pip3 install playwright")
    print("  python3 -m playwright install chromium")
    sys.exit(1)

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

URLS_TO_TRY = [
    "https://bookenshelter.dk/find-en-shelter/",
    "https://bookenshelter.dk/fyn/find-en-shelter/",
]
CAPTURED_JSON = []  # responses der ligner shelter/marker data


def on_response(response):
    """Fang JSON-svar der kan indeholde shelter-koordinater. Gem også andre JSON-svar til debug."""
    try:
        content_type = response.headers.get("content-type", "")
        if "json" not in content_type:
            return
        url = response.url
        if "analytics" in url or "gtm" in url or "facebook" in url or "google-analytics" in url or "gen_204" in url:
            return
        body = response.text()
        if not body or len(body) > 2_000_000:
            return
        data = json.loads(body)
        if isinstance(data, dict) and not data:
            return
        CAPTURED_JSON.append({"url": url, "data": data})
    except Exception:
        pass


def extract_features_from_obj(obj, features=None, source_url=""):
    """Udtræk GeoJSON-like features fra et vilkårligt objekt."""
    if features is None:
        features = []
    if isinstance(obj, list):
        for item in obj:
            extract_features_from_obj(item, features, source_url)
        return features
    if isinstance(obj, dict):
        lat = None
        lon = None
        if "lat" in obj and "lng" in obj:
            lat, lon = obj["lat"], obj["lng"]
        elif "lat" in obj and "lon" in obj:
            lat, lon = obj["lat"], obj["lon"]
        elif "latitude" in obj and "longitude" in obj:
            lat, lon = obj["latitude"], obj["longitude"]
        elif "position" in obj:
            p = obj["position"]
            if isinstance(p, dict):
                lat = p.get("lat") or p.get("latitude")
                lon = p.get("lng") or p.get("lon") or p.get("longitude")
        elif "geometry" in obj:
            g = obj["geometry"]
            if isinstance(g, dict) and "coordinates" in g:
                co = g["coordinates"]
                if len(co) >= 2:
                    lon, lat = co[0], co[1]
        elif "coordinates" in obj and isinstance(obj["coordinates"], (list, tuple)) and len(obj["coordinates"]) >= 2:
            lon, lat = obj["coordinates"][0], obj["coordinates"][1]
        if lat is not None and lon is not None:
            try:
                lat, lon = float(lat), float(lon)
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    name = (obj.get("name") or obj.get("title") or obj.get("navn") or
                            obj.get("label") or obj.get("placering") or "Shelter")
                    if isinstance(name, dict):
                        name = name.get("rendered", name.get("value", "Shelter"))
                    booking_url = obj.get("booking_url") or obj.get("link") or obj.get("url") or source_url if source_url.startswith("http") else ""
                    if isinstance(booking_url, dict):
                        booking_url = booking_url.get("rendered", booking_url.get("href", ""))
                    props_out = {
                        "name": str(name),
                        "description": str(obj.get("description") or obj.get("beskrivelse") or ""),
                        "source_url": source_url,
                        "booking_url": str(booking_url) if booking_url else "",
                    }
                    features.append({
                        "type": "Feature",
                        "properties": {**props_out, "raw": obj},
                        "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    })
            except (TypeError, ValueError):
                pass
        for v in obj.values():
            extract_features_from_obj(v, features, source_url)
    return features


def main():
    print("Starter browser og åbner Book en Shelter...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36"
        )
        page = context.new_page()
        page.on("response", on_response)
        for URL in URLS_TO_TRY:
            print("  Åbner", URL, "...")
            try:
                page.goto(URL, wait_until="networkidle", timeout=60000)
                break
            except Exception as e:
                print("  Fejl:", e)
                continue
        else:
            URL = URLS_TO_TRY[0]
            page.goto(URL, wait_until="networkidle", timeout=60000)
        # Vent lidt ekstra så evt. lazy-loaded kort-data når at loade
        page.wait_for_timeout(5000)

        # Prøv at klikke "Vælg område" eller lign. for at vise shelter-liste (kan udløse dataload)
        try:
            for selector in ['a:has-text("Vælg område")', 'a:has-text("Se shelterkort")', '[href*="find-en-shelter"]']:
                try:
                    el = page.locator(selector).first
                    if el.count() > 0:
                        el.click(timeout=2000)
                        page.wait_for_timeout(3000)
                        break
                except Exception:
                    pass
        except Exception:
            pass

        # Udtræk shelter-links fra DOM (detail-sider har ofte ekstra path)
        try:
            links_data = page.evaluate("""() => {
                const links = [];
                document.querySelectorAll('a[href*="find-en-shelter"]').forEach(a => {
                    const href = a.href || '';
                    const text = (a.textContent || '').trim().substring(0, 200);
                    if (href && (href.includes('/find-en-shelter/') || href.includes('find-en-shelter?'))) {
                        const path = new URL(href).pathname;
                        const parts = path.split('/').filter(Boolean);
                        if (parts.length >= 3 || (parts.length >= 2 && path.includes('find-en-shelter') && !path.endsWith('find-en-shelter')))
                            links.push({ href, text, path });
                    }
                });
                return links;
            }""")
            if links_data:
                CAPTURED_JSON.append({"url": "dom_shelter_links", "data": links_data})
        except Exception:
            pass

        # Udtræk elementer med data-lat/data-lng eller data-latitude/data-longitude
        try:
            dom_coords = page.evaluate("""() => {
                const out = [];
                document.querySelectorAll('[data-lat][data-lng], [data-latitude][data-longitude], [data-lat][data-lon]').forEach(el => {
                    const lat = parseFloat(el.getAttribute('data-lat') || el.getAttribute('data-latitude'));
                    const lng = parseFloat(el.getAttribute('data-lng') || el.getAttribute('data-longitude') || el.getAttribute('data-lon'));
                    if (!isNaN(lat) && !isNaN(lng)) out.push({ lat, lng, name: (el.getAttribute('data-name') || el.getAttribute('title') || el.textContent || '').trim().substring(0, 150) });
                });
                return out;
            }""")
            if dom_coords:
                CAPTURED_JSON.append({"url": "dom_data_coords", "data": dom_coords})
        except Exception:
            pass

        # Prøv at hente data fra window (nogle sites gemmer her)
        try:
            window_data = page.evaluate("""() => {
                const keys = [];
                for (const k of Object.keys(window)) {
                    if (k.toLowerCase().includes('shelter') || k.toLowerCase().includes('marker')
                        || k.toLowerCase().includes('map') || k.toLowerCase().includes('location'))
                        keys.push(k);
                }
                const out = {};
                for (const k of keys) {
                    try {
                        const v = window[k];
                        if (v && typeof v === 'object' && !(v instanceof Node))
                            out[k] = JSON.parse(JSON.stringify(v));
                    } catch (e) {}
                }
                return out;
            }""")
            if window_data:
                CAPTURED_JSON.append({"url": "window", "data": window_data})
        except Exception:
            pass
        # Spørg browseren efter globale variabler der kunne være marker/shelter-data (WordPress wp_localize_script osv.)
        try:
            extra = page.evaluate("""() => {
                const out = {};
                const names = ['markers', 'shelters', 'locations', 'places', 'shelterData', 'mapData',
                    'bookenshelter_markers', 'shelter_markers', 'mapMarkers', 'markerData', 'locationsData'];
                for (const n of names) {
                    if (typeof window[n] !== 'undefined' && window[n] !== null) {
                        try {
                            out[n] = JSON.parse(JSON.stringify(window[n]));
                        } catch (e) {}
                    }
                }
                return Object.keys(out).length ? out : null;
            }""")
            if extra:
                CAPTURED_JSON.append({"url": "window_globals", "data": extra})
        except Exception:
            pass
        # Hent HTML og led efter inline JSON i script-tags
        try:
            html = page.content()
            for m in re.finditer(
                r"(?:var|let|const)\s+(\w+)\s*=\s*(\{[\s\S]*?\});\s*(?:\n|$|</script>)",
                html,
            ):
                try:
                    js = m.group(2)
                    if not re.search(r"(lat|lng|shelter|marker|coordinate|position)", js, re.I):
                        continue
                    data = json.loads(js)
                    CAPTURED_JSON.append({"url": "html_inline:" + m.group(1), "data": data})
                except (json.JSONDecodeError, ValueError):
                    pass
            # Led efter koordinater i Google Maps / iframe-URLs (fx !3d55.123!4d10.456)
            coord_pairs = re.findall(r"!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)", html)
            for lat_s, lon_s in coord_pairs[:200]:
                try:
                    lat, lon = float(lat_s), float(lon_s)
                    if -90 <= lat <= 90 and -180 <= lon <= 180:
                        CAPTURED_JSON.append({
                            "url": "html_embed_coords",
                            "data": {"lat": lat, "lng": lon, "name": "Shelter"},
                        })
                except ValueError:
                    pass
        except Exception:
            pass

        # Hvis vi har shelter-links men stadig ingen koordinater: besøg op til 30 shelter-sider og led efter coords
        shelter_links = None
        for item in CAPTURED_JSON:
            if item.get("url") == "dom_shelter_links" and isinstance(item.get("data"), list):
                shelter_links = item["data"]
                break
        prelim = []
        for item in CAPTURED_JSON:
            extract_features_from_obj(item.get("data"), prelim, item.get("url", ""))
        if shelter_links and not prelim:
            seen_hrefs = set()
            for link_info in shelter_links[:30]:
                href = link_info.get("href") or link_info.get("path") or ""
                if not href or href in seen_hrefs:
                    continue
                seen_hrefs.add(href)
                if not href.startswith("http"):
                    href = "https://bookenshelter.dk" + (href if href.startswith("/") else "/" + href)
                try:
                    page.goto(href, wait_until="domcontentloaded", timeout=15000)
                    page.wait_for_timeout(2000)
                    html = page.content()
                    for lat_s, lon_s in re.findall(r"!3d([+-]?\d+\.?\d*)!4d([+-]?\d+\.?\d*)", html):
                        try:
                            lat, lon = float(lat_s), float(lon_s)
                            if -90 <= lat <= 90 and -180 <= lon <= 180:
                                name = (link_info.get("text") or link_info.get("path") or "Shelter").strip() or "Shelter"
                                CAPTURED_JSON.append({
                                    "url": "shelter_page:" + href,
                                    "data": {"lat": lat, "lng": lon, "name": name, "link": href},
                                })
                                break
                        except ValueError:
                            pass
                except Exception:
                    pass

        context.close()
        browser.close()

    features = []
    for item in CAPTURED_JSON:
        extract_features_from_obj(item["data"], features, source_url=item.get("url", ""))

    # Dedup på koordinater
    seen = set()
    unique = []
    for f in features:
        co = (round(f["geometry"]["coordinates"][0], 5), round(f["geometry"]["coordinates"][1], 5))
        if co not in seen:
            seen.add(co)
            unique.append(f)

    if not unique:
        print("Ingen shelter-koordinater fanget fra netværk eller window.")
        print("Fangede", len(CAPTURED_JSON), "JSON-svar.")
        debug_path = os.path.join(_script_dir, "bookenshelter_captured_debug.json")
        try:
            with open(debug_path, "w", encoding="utf-8") as f:
                json.dump(
                    [{"url": item["url"], "data": item["data"]} for item in CAPTURED_JSON],
                    f, ensure_ascii=False, indent=2,
                )
            print("Debug: Fangede data gemt som", debug_path, "– åbn filen og tjek strukturen.")
        except Exception as e:
            print("Kunne ikke gemme debug-fil:", e)
        print()
        print("Book en Shelter svarer ikke på henvendelser; uden API/export kan vi ikke hente deres data automatisk.")
        print("Du kan bruge GeoFA-shelters alene – match-scriptet er klar til den dag de giver adgang.")
        return

    print(f"Fandt {len(unique)} unikke steder med koordinater.")
    # Gem GeoJSON uden raw (filen bliver mindre og altid serialiserbar)
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {k: v for k, v in f.get("properties", {}).items() if k != "raw"},
                "geometry": f["geometry"],
            }
            for f in unique
        ],
    }
    out_path = os.path.join(_script_dir, "bookenshelter_shelters.geojson")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print("Gemt som", out_path)

    # Import til bookenshelter_raw (Supabase) hvis tabel findes
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if supabase_url and supabase_key:
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
        count_raw = 0
        for feat in unique:
            props = feat.get("properties", {})
            coords = feat["geometry"]["coordinates"]
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
                count_raw += 1
            except Exception as e:
                print("Fejl ved bookenshelter_raw", name, ":", e)
        if count_raw:
            print("Importeret", count_raw, "rækker til bookenshelter_raw.")


if __name__ == "__main__":
    main()
