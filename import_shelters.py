import json
import os
import re
import subprocess
import sys
import requests
from supabase import create_client, Client
from slugify import slugify

# Indlæs .env fra scriptets mappe
_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")

try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
    load_dotenv(os.path.join(_script_dir, ".env.local"))
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    # Fallback: læs .env manuelt (virker uden python-dotenv)
    if os.path.isfile(_env_path):
        with open(_env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())

# --- KONFIGURATION ---
url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("FEJL: Mangler Supabase URL eller KEY.")
    print("  Opret shelterdk/.env med:")
    print("    NEXT_PUBLIC_SUPABASE_URL=https://dit-projekt.supabase.co")
    print("    NEXT_PUBLIC_SUPABASE_ANON_KEY=din-anon-key")
    print("  Eller kør: export NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=...")
    exit(1)

supabase: Client = create_client(url, key)

# GeoFA WFS – 500 på GetFeature er en kendt serverfejl hos GeoFA (Wms.php, $layer null). Vi prøver både prod og test.
# Layer t_5800_fac_pkt = faciliteter som punkt (shelters, bålpladser m.m.)
GEOFA_WFS_BASES = [
    "https://geofa.geodanmark.dk/ows/fkg/fkg",
    "https://geofa-test.geodanmark.dk/ows/fkg/fkg",  # testmiljø – kan have anden version
]
# GeoFA's eget virkende kald bruger typeNames=fkg:fkg.t_5800_fac_pkt (med "fkg." foran tabellen).
# Uden "fkg." giver serveren 500 ($layer null i Wms.php).
GEOFA_TYPE_NAME = "fkg:fkg.t_5800_fac_pkt"

# Kun denne facilitetstype importeres (API felt: facil_ty).
GEOFA_FACILITY_TYPES_IMPORT = {"Shelter"}

def _wfs_attempts():
    out = []
    for base in GEOFA_WFS_BASES:
        out.append(("GET", base + "?service=WFS&version=2.0.0&request=GetFeature&typeNames=" + GEOFA_TYPE_NAME + "&outputFormat=application/json&srsName=EPSG:4326"))
        out.append(("GET", base + "?service=WFS&version=1.1.0&request=GetFeature&typeName=" + GEOFA_TYPE_NAME + "&outputFormat=application%2Fjson&srsName=EPSG:4326"))
        out.append(("GET", base + "?service=WFS&version=1.1.0&request=GetFeature&typeName=t_5800_fac_pkt&outputFormat=application%2Fjson&srsName=EPSG:4326"))
    return out
GEOFA_WFS_ATTEMPTS = _wfs_attempts()
GEOFA_WFS_BASE = GEOFA_WFS_BASES[0]  # POST bruger prod
# POST GetFeature – namespace fra GetCapabilities: xmlns:fkg="https://geofa.geodanmark.dk"
GEOFA_WFS_POST_BODY = """<?xml version="1.0" encoding="UTF-8"?>
<wfs:GetFeature service="WFS" version="2.0.0"
  xmlns:wfs="http://www.opengis.net/wfs/2.0"
  xmlns:fkg="https://geofa.geodanmark.dk">
  <wfs:Query typeNames="fkg:fkg.t_5800_fac_pkt">
    <wfs:OutputFormat>application/json</wfs:OutputFormat>
  </wfs:Query>
</wfs:GetFeature>"""
GEOFA_SQL_URL = "https://geofa.geodanmark.dk/api/v2/sql/fkg?format=geojson"

def detect_toilet_status(description, facilities):
    """
    Scanner tekst for toilet-keywords.
    Returnerer: 'flush', 'mulch', 'none', eller 'unknown'
    """
    full_text = (str(description) + " " + str(facilities)).lower()

    if "træk og slip" in full_text or "wc" in full_text or "vandskyllende" in full_text:
        return "flush"
    elif "muldtoilet" in full_text or "tørkloset" in full_text or "das" in full_text or "primitivt toilet" in full_text:
        return "mulch"
    elif "ingen toilet" in full_text or "medbring spade" in full_text:
        return "none"
    else:
        return "unknown"

def _get_prop(props, *keys):
    """Hent første forekomst af en af keys (GeoFA bruger bl.a. danske feltnavne)."""
    for k in keys:
        if k in props and props[k] not in (None, ""):
            return props[k]
    return None

def import_shelters():
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ShelterDK-import/1.0",
        "Accept": "application/json",
    }
    data = None
    for i, (method, wfs_url) in enumerate(GEOFA_WFS_ATTEMPTS):
        print(f"Henter data fra GeoFA WFS (forsøg {i + 1}/{len(GEOFA_WFS_ATTEMPTS)})...")
        try:
            response = requests.get(wfs_url, headers=headers, timeout=60)
        except requests.RequestException as e:
            print(f"  Fejl: {e}")
            continue
        if response.status_code != 200:
            print(f"  Status {response.status_code}, prøver næste...")
            continue
        try:
            data = response.json()
            if data.get("features") is not None:
                break
        except Exception:
            pass
    # POST GetFeature på prod og test
    for base in GEOFA_WFS_BASES:
        if data:
            break
        print("Henter data fra GeoFA WFS (POST GetFeature)...")
        try:
            post_headers = {**headers, "Content-Type": "application/xml"}
            r = requests.post(base, headers=post_headers, data=GEOFA_WFS_POST_BODY, timeout=60)
            if r.status_code == 200:
                data = r.json()
                if not data.get("features"):
                    data = None
        except Exception:
            pass
    if not data:
        for sql_base in ("https://geofa.geodanmark.dk/api/v2/sql/fkg", "https://geofa-test.geodanmark.dk/api/v2/sql/fkg"):
            if data:
                break
            print("Henter data fra GeoFA SQL API...")
            try:
                r = requests.get(sql_base + "?format=geojson", headers=headers, timeout=60)
                if r.status_code == 200:
                    data = r.json()
                    if not data.get("features"):
                        data = None
            except Exception:
                pass
    if not data:
        local_geojson = os.environ.get("GEOFA_GEOJSON_FILE") or os.path.join(_script_dir, "geofa_shelters.geojson")
        if os.path.isfile(local_geojson):
            print(f"Indlæser lokal fil: {local_geojson}")
            try:
                with open(local_geojson, encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"Kunne ikke læse fil: {e}")
                return
        else:
            print("Kunne ikke hente data fra GeoFA (alle forsøg fejlede – ofte pga. 500 fra deres server).")
            print("Løsning: Brug lokal GeoJSON.")
            print("  1. Åbn GeoFA-webkortet: https://geofa-kort.geodanmark.dk")
            print("  2. Vælg lag 'Facilitet punkt' (shelters m.m.) og eksporter/download data.")
            print("  3. Gem filen som:", local_geojson)
            print("  Eller sæt miljøvariabel: GEOFA_GEOJSON_FILE=/sti/til/fil.geojson")
            return

    features = data.get("features", [])
    if not features:
        print("Ingen features i svaret. Tjek at GeoFA WFS URL og typeNames er korrekte.")
        return
    print(f"Fandt {len(features)} steder. Importerer kun typer: {', '.join(sorted(GEOFA_FACILITY_TYPES_IMPORT))}...")

    count = 0
    skipped_type = 0
    for feature in features:
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {}) or {}
        gtype = geometry.get("type")
        coords = geometry.get("coordinates")

        # GeoFA bruger MultiPoint til mange faciliteter; vi tager første punkt.
        if not geometry or not coords:
            continue
        if gtype == "Point":
            if len(coords) < 2:
                continue
            lon, lat = float(coords[0]), float(coords[1])
        elif gtype == "MultiPoint":
            if not coords or not isinstance(coords, (list, tuple)) or len(coords[0]) < 2:
                continue
            lon, lat = float(coords[0][0]), float(coords[0][1])
        else:
            # Andre geometri-typer (LineString, Polygon osv.) springes over.
            continue

        # Kun importer faciliteter af typen shelter/bålplads/teltplads (API: facil_ty).
        facil_ty = (props.get("facil_ty") or "").strip()
        if facil_ty and facil_ty not in GEOFA_FACILITY_TYPES_IMPORT:
            skipped_type += 1
            continue

        navn = _get_prop(props, "navn", "name", "facilitetnavn")
        if navn:
            title = navn
        else:
            kommune = _get_prop(props, "beliggenhedskommune")
            obj_id = _get_prop(props, "objekt_id")
            if kommune:
                title = f"Shelter, {kommune}"
            elif obj_id is not None:
                title = f"Shelter ({obj_id})"
            else:
                title = "Ukendt Shelter"

        base_slug = slugify(title)
        slug = f"{base_slug}-{str(lon)[:6].replace('.', '')}"

        # GeoFA bruger "beskrivels" og "d_k_beskr" (dansk beskrivelse), ikke "beskrivelse".
        description = _get_prop(
            props,
            "beskrivels",
            "d_k_beskr",
            "lang_beskr",
            "beskrivelse",
            "description",
            "facilitetbeskrivelse",
        ) or ""
        toilet_status = detect_toilet_status(description, props)

        # Billeder: saml alle ikke-tomme foto/geofafoto-URL'er fra GeoFA.
        # Spring over Cookiebot-tracking/placeholder (1.gif) – det er ikke rigtige billeder.
        def _is_valid_image_url(url):
            if not url or not isinstance(url, str):
                return False
            u = url.strip()
            if not u or "cookiebot.com" in u or u.endswith("/1.gif"):
                return False
            return True
        _img_keys = (
            "foto_link", "foto_link1", "foto_link2", "foto_link3",
            "geofafoto", "geofafoto1", "geofafoto2", "geofafoto3",
        )
        image_urls_list = []
        for k in _img_keys:
            v = (props.get(k) or "").strip()
            if _is_valid_image_url(v) and v not in image_urls_list:
                image_urls_list.append(v)
        image_url = image_urls_list[0] if image_urls_list else None
        image_urls = image_urls_list if image_urls_list else None

        # Ekstra felter fra GeoFA – "næsten gratis" berigelse.
        capacity_raw = _get_prop(props, "antal_pl")
        try:
            capacity = int(capacity_raw) if capacity_raw not in (None, "") else None
        except (TypeError, ValueError):
            capacity = None

        booking_url = _get_prop(props, "bookinglink", "link", "link1", "link2", "link3")
        # Mangler vi booking-link men titlen/GeoFA angiver bookbar, så led i alle felter efter udinaturen.dk
        if not (booking_url or "").strip():
            for _k, val in props.items():
                if isinstance(val, str) and "udinaturen.dk" in val and val.strip().startswith("http"):
                    booking_url = val.strip()
                    break

        betaling = (_get_prop(props, "betaling") or "").strip().lower()
        is_free = None
        if betaling:
            if "nej" in betaling:
                is_free = True
            elif "ja" in betaling:
                is_free = False

        booking_required = bool(booking_url)

        owner_name = _get_prop(props, "ansvar_org")
        owner_type = _get_prop(props, "ansva_v")

        contact = _get_prop(props, "kontak_ved")

        season = _get_prop(props, "saeson")
        season_note = _get_prop(props, "saeson_bem")

        doegnaab = (_get_prop(props, "doegnaab") or "").strip().lower()
        open_24_7 = None
        if doegnaab:
            if "ja" in doegnaab:
                open_24_7 = True
            elif "nej" in doegnaab:
                open_24_7 = False

        handicap = (_get_prop(props, "handicap") or "").strip().lower()
        wheelchair_accessible = None
        if handicap:
            if "ja" in handicap:
                wheelchair_accessible = True
            elif "nej" in handicap:
                wheelchair_accessible = False

        # By/kommune til MapPin: kun bynavn, aldrig kommunekode (tal). Foretræk postnr_by ("6400 Sønderborg" -> "Sønderborg").
        kommune = None
        postnr_by = (_get_prop(props, "postnr_by") or "").strip()
        if postnr_by:
            by_part = re.sub(r"^\s*\d+\s*[,-]?\s*", "", postnr_by).strip()
            if by_part and not re.match(r"^\d+$", by_part):
                kommune = by_part
        if not kommune:
            bel = (_get_prop(props, "beliggenhedskommune") or "").strip()
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
            "access": "public",
            "mode": "first_come",
            "source_id": str(_get_prop(props, "objekt_id", "id", "objectid", "fkg_id") or feature.get("id", "geofa")),
            "geofa_raw": props,
            "image_url": image_url,
            "image_urls": image_urls,
            "capacity": capacity,
            "booking_url": booking_url,
            "is_free": is_free,
            "booking_required": booking_required,
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
            supabase.table("shelters").upsert(shelter_data, on_conflict="slug").execute()
            count += 1
            if count % 10 == 0:
                print(f"Importeret {count} shelters...")
        except Exception as e:
            err_str = str(e)
            if "geofa_raw" in err_str and "PGRST204" in err_str:
                print()
                print("FEJL: Tabellen 'shelters' mangler kolonner (geofa_raw, image_url, image_urls m.m.).")
                print("  Kør migrations i Supabase → SQL Editor (001 + berigelse-kolonner).")
                print("  Eller kør filen: shelterdk/migrations/001_add_geofa_raw_and_image_url.sql")
                print()
                raise SystemExit(1) from e
            print(f"Fejl ved {title}: {e}")

    if skipped_type:
        print(f"(Sprang {skipped_type} over – anden facilitetstype end shelter/bålplads/teltplads.)")
    print(f"FÆRDIG! {count} shelters er nu i din database.")

    # Udfyld kommune fra location (reverse geocoding) for dem der mangler
    backfill_script = os.path.join(_script_dir, "backfill_kommune_from_geo.py")
    if os.path.isfile(backfill_script):
        print()
        print("Udfylder kommune fra koordinater (Nominatim)...")
        try:
            subprocess.run(
                [sys.executable, "backfill_kommune_from_geo.py"],
                cwd=_script_dir,
                check=False,
            )
        except Exception as e:
            print(f"(Backfill af kommune fejlede: {e}. Kør manuelt: python3 backfill_kommune_from_geo.py)")
    else:
        print("(Kommune-backfill: kør manuelt python3 backfill_kommune_from_geo.py)")

if __name__ == "__main__":
    import_shelters()
