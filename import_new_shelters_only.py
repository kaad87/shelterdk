"""
import_new_shelters_only.py
===========================
Henter shelters fra GeoFA og inserter KUN dem der IKKE allerede findes
i databasen. Eksisterende shelters røres IKKE – hverken title, description,
seo_title, seo_description, image_url, eller noget andet.

Tjek sker på to felter:
  - slug        (genereret af title + koordinat)
  - source_id   (GeoFA's objekt_id)

Hvis ET AF DE TO allerede findes i DB → skippes shelterets.
"""

import json
import os
import re
import sys
import requests
from supabase import create_client, Client
from slugify import slugify

# ── Indlæs .env ────────────────────────────────────────────────────────────
_script_dir = os.path.dirname(os.path.abspath(__file__))
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_script_dir, ".env"))
    load_dotenv(os.path.join(_script_dir, ".env.local"))
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    for _p in (os.path.join(_script_dir, ".env"), ".env"):
        if os.path.isfile(_p):
            with open(_p) as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line and not _line.startswith("#") and "=" in _line:
                        _k, _, _v = _line.partition("=")
                        os.environ.setdefault(_k.strip(), _v.strip())

# ── Supabase ────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL og/eller SUPABASE_SERVICE_ROLE_KEY i .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── GeoFA ───────────────────────────────────────────────────────────────────
GEOFA_WFS_BASES = [
    "https://geofa.geodanmark.dk/ows/fkg/fkg",
    "https://geofa-test.geodanmark.dk/ows/fkg/fkg",
]
GEOFA_TYPE_NAME = "fkg:fkg.t_5800_fac_pkt"
GEOFA_FACILITY_TYPES_IMPORT = {"Shelter"}

def _wfs_urls():
    out = []
    for base in GEOFA_WFS_BASES:
        out.append(base + "?service=WFS&version=2.0.0&request=GetFeature&typeNames=" + GEOFA_TYPE_NAME + "&outputFormat=application/json&srsName=EPSG:4326")
        out.append(base + "?service=WFS&version=1.1.0&request=GetFeature&typeName=" + GEOFA_TYPE_NAME + "&outputFormat=application%2Fjson&srsName=EPSG:4326")
    return out

GEOFA_WFS_POST_BODY = """<?xml version="1.0" encoding="UTF-8"?>
<wfs:GetFeature service="WFS" version="2.0.0"
  xmlns:wfs="http://www.opengis.net/wfs/2.0"
  xmlns:fkg="https://geofa.geodanmark.dk">
  <wfs:Query typeNames="fkg:fkg.t_5800_fac_pkt">
    <wfs:OutputFormat>application/json</wfs:OutputFormat>
  </wfs:Query>
</wfs:GetFeature>"""

# ── Helpers (kopieret fra import_shelters.py) ───────────────────────────────

def _get_prop(props, *keys):
    for k in keys:
        if k in props and props[k] not in (None, ""):
            return props[k]
    return None

def detect_toilet_status(description, props):
    full_text = (str(description) + " " + str(props)).lower()
    if any(x in full_text for x in ["træk og slip", "vandskyllende", " wc ", "offentligt toilet", "handicapvenligt toilet"]):
        return "flush"
    if any(x in full_text for x in ["ingen toilet", "ikke toilet", "medbring spade", "der er ikke toilet"]):
        return "none"
    for p in ["muldtoilet", "multtoilet", "tørkloset", "skovtoilet", "primitivt toilet", "primitivt lokum"]:
        if p in full_text:
            return "mulch"
    if "vand og toilet" in full_text or "toilet og vand" in full_text:
        return "flush" if "uden vand" not in full_text else "mulch"
    if any(x in full_text for x in ["der er toilet", "toilet på pladsen", "adgang til toilet"]):
        return "mulch"
    return "unknown"

def detect_water_status(description, props):
    full_text = (str(description) + " " + str(props)).lower()
    if isinstance(props, dict):
        vh = (props.get("vandhane") or "").strip().lower()
        if "ja" in vh:
            return True
        if "nej" in vh:
            return False
    if any(x in full_text for x in ["uden vand", "ingen vand", "ikke vand", "medbring vand"]):
        return False
    if any(x in full_text for x in ["drikkevand", "vandhane", "vand på pladsen", "adgang til vand"]):
        return None if "uden vand" in full_text else True
    return None

def _is_valid_image_url(u):
    if not u or not isinstance(u, str):
        return False
    u = u.strip()
    return bool(u) and "cookiebot.com" not in u and not u.endswith("/1.gif")

# ── Pre-hent eksisterende slugs + source_ids ────────────────────────────────

def fetch_existing_identifiers():
    """
    Returnerer (set_of_slugs, set_of_source_ids) for ALLE shelters i DB.
    Paginerer automatisk hvis der er mange.
    """
    print("Henter eksisterende slugs og source_ids fra databasen...")
    slugs = set()
    source_ids = set()
    page_size = 1000
    offset = 0
    while True:
        resp = (
            supabase.table("shelters")
            .select("slug, source_id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = resp.data or []
        for row in rows:
            if row.get("slug"):
                slugs.add(row["slug"])
            if row.get("source_id"):
                source_ids.add(str(row["source_id"]))
        if len(rows) < page_size:
            break
        offset += page_size
    print(f"  → {len(slugs)} eksisterende slugs, {len(source_ids)} source_ids i DB.")
    return slugs, source_ids

# ── Hent GeoFA-data ─────────────────────────────────────────────────────────

def fetch_geofa():
    headers = {
        "User-Agent": "ShelterDK-import/1.0",
        "Accept": "application/json",
    }
    for url in _wfs_urls():
        print(f"Prøver: {url[:80]}...")
        try:
            r = requests.get(url, headers=headers, timeout=60)
            if r.status_code == 200:
                d = r.json()
                if d.get("features"):
                    print(f"  → {len(d['features'])} features hentet.")
                    return d
        except Exception as e:
            print(f"  Fejl: {e}")

    print("Prøver POST GetFeature...")
    for base in GEOFA_WFS_BASES:
        try:
            r = requests.post(base, headers={**headers, "Content-Type": "application/xml"},
                              data=GEOFA_WFS_POST_BODY, timeout=60)
            if r.status_code == 200:
                d = r.json()
                if d.get("features"):
                    return d
        except Exception:
            pass

    local = os.environ.get("GEOFA_GEOJSON_FILE") or os.path.join(_script_dir, "geofa_shelters.geojson")
    if os.path.isfile(local):
        print(f"Indlæser lokal fil: {local}")
        with open(local, encoding="utf-8") as f:
            return json.load(f)

    print("FEJL: Kunne ikke hente GeoFA-data.")
    return None

# ── Hovedfunktion ────────────────────────────────────────────────────────────

def main():
    # 1. Pre-hent hvad der allerede er i DB
    existing_slugs, existing_source_ids = fetch_existing_identifiers()

    # 2. Hent GeoFA
    data = fetch_geofa()
    if not data:
        sys.exit(1)

    features = data.get("features", [])
    print(f"\nGeoFA returnerede {len(features)} steder total.")
    print(f"Importerer kun type: {', '.join(sorted(GEOFA_FACILITY_TYPES_IMPORT))}\n")

    inserted = 0
    skipped_existing = 0
    skipped_type = 0
    errors = 0

    for feature in features:
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {}) or {}
        gtype = geometry.get("type")
        coords = geometry.get("coordinates")

        if not geometry or not coords:
            continue
        if gtype == "Point":
            if len(coords) < 2:
                continue
            lon, lat = float(coords[0]), float(coords[1])
        elif gtype == "MultiPoint":
            if not coords or len(coords[0]) < 2:
                continue
            lon, lat = float(coords[0][0]), float(coords[0][1])
        else:
            continue

        # Kun shelter-typer
        facil_ty = (props.get("facil_ty") or "").strip()
        if facil_ty and facil_ty not in GEOFA_FACILITY_TYPES_IMPORT:
            skipped_type += 1
            continue

        # Beregn slug + source_id
        navn = _get_prop(props, "navn", "name", "facilitetnavn")
        if navn:
            title = navn
        else:
            bel = _get_prop(props, "beliggenhedskommune")
            obj_id = _get_prop(props, "objekt_id")
            title = f"Shelter, {bel}" if bel else (f"Shelter ({obj_id})" if obj_id else "Ukendt Shelter")

        base_slug = slugify(title)
        slug = f"{base_slug}-{str(lon)[:6].replace('.', '')}"
        source_id = str(_get_prop(props, "objekt_id", "id", "objectid", "fkg_id") or feature.get("id", "geofa"))

        # ── KERNEKONTROL: spring over hvis allerede i DB ──
        if slug in existing_slugs:
            skipped_existing += 1
            continue
        if source_id in existing_source_ids:
            skipped_existing += 1
            continue

        # Byg shelter-data til INSERT
        description = _get_prop(props, "lang_beskr", "beskrivelse", "beskrivels", "d_k_beskr", "description", "facilitetbeskrivelse") or ""
        toilet_status = detect_toilet_status(description, props)
        water_status = detect_water_status(description, props)

        img_keys = ("foto_link", "foto_link1", "foto_link2", "foto_link3", "geofafoto", "geofafoto1", "geofafoto2", "geofafoto3")
        image_urls_list = []
        for k in img_keys:
            v = (props.get(k) or "").strip()
            if _is_valid_image_url(v) and v not in image_urls_list:
                image_urls_list.append(v)

        capacity_raw = _get_prop(props, "antal_pl")
        try:
            capacity = int(capacity_raw) if capacity_raw not in (None, "") else None
        except (TypeError, ValueError):
            capacity = None

        booking_url = _get_prop(props, "bookinglink", "link", "link1", "link2", "link3")
        if not (booking_url or "").strip():
            for _k, val in props.items():
                if isinstance(val, str) and "udinaturen.dk" in val and val.strip().startswith("http"):
                    booking_url = val.strip()
                    break

        betaling = (_get_prop(props, "betaling") or "").strip().lower()
        is_free = True if "nej" in betaling else (False if "ja" in betaling else None)

        owner_name = _get_prop(props, "ansvar_org")
        owner_type = _get_prop(props, "ansva_v")
        contact = _get_prop(props, "kontak_ved")
        season = _get_prop(props, "saeson")
        season_note = _get_prop(props, "saeson_bem")

        doegnaab = (_get_prop(props, "doegnaab") or "").strip().lower()
        open_24_7 = True if "ja" in doegnaab else (False if "nej" in doegnaab else None)

        handicap = (_get_prop(props, "handicap") or "").strip().lower()
        wheelchair_accessible = True if "ja" in handicap else (False if "nej" in handicap else None)

        kommune = None
        postnr_by = (_get_prop(props, "postnr_by") or "").strip()
        if postnr_by:
            by_part = re.sub(r"^\s*\d+\s*[,-]?\s*", "", postnr_by).strip()
            if by_part and not re.match(r"^\d+$", by_part):
                kommune = by_part
        if not kommune:
            bel = str(_get_prop(props, "beliggenhedskommune") or "").strip()
            if bel and not re.match(r"^\d+$", bel):
                kommune = bel

        shelter_data = {
            "title": title,
            "slug": slug,
            "description": description,
            "location": f"POINT({lon} {lat})",
            "region": "Danmark",
            "kommune": kommune,
            "toilet": toilet_status,
            "water": water_status,
            "access": "public",
            "mode": "first_come",
            "source_id": source_id,
            "geofa_raw": props,
            "image_url": image_urls_list[0] if image_urls_list else None,
            "image_urls": image_urls_list if image_urls_list else None,
            "capacity": capacity,
            "booking_url": booking_url,
            "is_free": is_free,
            "booking_required": bool(booking_url),
            "owner_name": owner_name,
            "owner_type": owner_type,
            "contact": contact,
            "season": season,
            "season_note": season_note,
            "open_24_7": open_24_7,
            "wheelchair_accessible": wheelchair_accessible,
            "verified": True,
        }

        try:
            # INSERT – aldrig upsert, aldrig update på eksisterende
            supabase.table("shelters").insert(shelter_data).execute()
            inserted += 1
            # Opdatér in-memory sets så dubletter i samme GeoFA-kørsel også fanges
            existing_slugs.add(slug)
            existing_source_ids.add(source_id)
            print(f"  [NY] {title} ({slug})")
        except Exception as e:
            errors += 1
            print(f"  [FEJL] {title}: {e}")

    print()
    print("=" * 60)
    print(f"FÆRDIG!")
    print(f"  Nye shelters inserteret : {inserted}")
    print(f"  Eksisterende (sprunget over): {skipped_existing}")
    print(f"  Anden type (sprunget over)  : {skipped_type}")
    if errors:
        print(f"  Fejl                        : {errors}")
    print("=" * 60)

    # Netlifys durable cache rydes ikke af et deploy. Revalidér forside + /nye
    # eksplicit, så de nye shelters dukker op med det samme (i stedet for at
    # vente på ISR-vinduet). Kun relevant når der faktisk blev inserteret noget.
    if inserted > 0:
        revalidate_paths(["/", "/nye"])


def revalidate_paths(paths):
    """Kald /api/revalidate med ADMIN_SECRET så ISR-cachen ryddes for paths."""
    site_url = (
        os.environ.get("SITE_URL")
        or os.environ.get("NEXT_PUBLIC_SITE_ORIGIN")
        or "https://shelterdk.dk"
    ).rstrip("/")
    admin_secret = os.environ.get("ADMIN_SECRET")
    if not admin_secret:
        print("  (springer revalidering over — ADMIN_SECRET mangler i .env)")
        return
    try:
        r = requests.post(
            f"{site_url}/api/revalidate",
            headers={"x-admin-secret": admin_secret, "Content-Type": "application/json"},
            json={"paths": paths},
            timeout=30,
        )
        if r.ok:
            print(f"  Revalideret: {', '.join(paths)}")
        else:
            print(f"  Revalidering fejlede ({r.status_code}): {r.text[:200]}")
    except Exception as e:
        print(f"  Revalidering-fejl: {e}")


if __name__ == "__main__":
    main()
