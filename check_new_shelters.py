"""
Check for new shelters in GeoFA that don't exist in our Supabase database.
READ-ONLY — does NOT write anything to the database.
"""
import json
import os
import re
import sys
import requests
from supabase import create_client, Client
from slugify import slugify

# Load .env
_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")

try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
    load_dotenv(os.path.join(_script_dir, ".env.local"))
except ImportError:
    if os.path.isfile(_env_path):
        with open(_env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not url or not key:
    print("FEJL: Mangler Supabase URL eller KEY i .env")
    exit(1)

supabase: Client = create_client(url, key)

# --- GeoFA config (same as import_shelters.py) ---
GEOFA_WFS_BASES = [
    "https://geofa.geodanmark.dk/ows/fkg/fkg",
    "https://geofa-test.geodanmark.dk/ows/fkg/fkg",
]
GEOFA_TYPE_NAME = "fkg:fkg.t_5800_fac_pkt"
GEOFA_SQL_URL = "https://geofa.geodanmark.dk/api/v2/sql/fkg?format=geojson"
GEOFA_FACILITY_TYPES_IMPORT = {"Shelter"}

def _wfs_attempts():
    out = []
    for base in GEOFA_WFS_BASES:
        out.append(base + "?service=WFS&version=2.0.0&request=GetFeature&typeNames=" + GEOFA_TYPE_NAME + "&outputFormat=application/json&srsName=EPSG:4326")
        out.append(base + "?service=WFS&version=1.1.0&request=GetFeature&typeName=" + GEOFA_TYPE_NAME + "&outputFormat=application%2Fjson&srsName=EPSG:4326")
    return out

def _get_prop(props, *keys):
    for k in keys:
        if k in props and props[k] not in (None, ""):
            return props[k]
    return None

def make_slug(title, lon):
    """Generate slug same way as import_shelters.py"""
    base = slugify(title, lowercase=True, max_length=80)
    if not base:
        base = "shelter"
    lon_suffix = f"{abs(lon):.2f}".replace(".", "")
    return f"{base}-{lon_suffix}"

def fetch_geofa():
    """Fetch shelters from GeoFA API"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ShelterDK-check/1.0",
        "Accept": "application/json",
    }
    data = None

    for i, wfs_url in enumerate(_wfs_attempts()):
        print(f"Henter fra GeoFA WFS (forsog {i + 1})...")
        try:
            response = requests.get(wfs_url, headers=headers, timeout=60)
        except requests.RequestException as e:
            print(f"  Fejl: {e}")
            continue
        if response.status_code != 200:
            print(f"  Status {response.status_code}, prover naeste...")
            continue
        try:
            data = response.json()
            if data.get("features") is not None:
                print(f"  OK! {len(data['features'])} features hentet.")
                break
        except Exception:
            pass
        data = None

    # Fallback: SQL API
    if not data:
        print("Prover GeoFA SQL API...")
        try:
            r = requests.get(
                GEOFA_SQL_URL,
                params={"q": "SELECT * FROM fkg.t_5800_fac_pkt"},
                headers=headers,
                timeout=60,
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("features"):
                    print(f"  OK! {len(data['features'])} features fra SQL API.")
        except Exception as e:
            print(f"  Fejl: {e}")

    # Fallback: local file
    if not data:
        local_path = os.path.join(_script_dir, "geofa_shelters.geojson")
        if os.path.isfile(local_path):
            print(f"Bruger lokal fil: {local_path}")
            with open(local_path) as f:
                data = json.load(f)
        else:
            print("FEJL: Kunne ikke hente data fra GeoFA og ingen lokal fil fundet.")
            exit(1)

    return data

def fetch_existing_slugs():
    """Fetch all existing shelter slugs from Supabase"""
    print("Henter eksisterende slugs fra Supabase...")
    all_slugs = set()
    offset = 0
    batch_size = 1000
    while True:
        result = supabase.table("shelters").select("slug").range(offset, offset + batch_size - 1).execute()
        rows = result.data or []
        for row in rows:
            if row.get("slug"):
                all_slugs.add(row["slug"])
        if len(rows) < batch_size:
            break
        offset += batch_size
    print(f"  {len(all_slugs)} shelters i databasen.")
    return all_slugs

def main():
    print("=" * 60)
    print("CHECK FOR NYE SHELTERS (READ-ONLY)")
    print("Skriver INTET til databasen.")
    print("=" * 60)
    print()

    geofa_data = fetch_geofa()
    existing_slugs = fetch_existing_slugs()

    features = geofa_data.get("features", [])
    new_shelters = []
    skipped_type = 0

    for feature in features:
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})

        # Filter: only shelters
        facil_ty = (_get_prop(props, "facil_ty", "facil_ty_k") or "").strip()
        if facil_ty not in GEOFA_FACILITY_TYPES_IMPORT:
            skipped_type += 1
            continue

        # Get title
        title = (_get_prop(props, "navn", "facil_ty") or "").strip()
        if not title:
            title = "Shelter"

        # Get coordinates
        coords = geom.get("coordinates", [])
        if not coords or len(coords) < 2:
            continue
        if isinstance(coords[0], list):
            coords = coords[0]
        lon, lat = float(coords[0]), float(coords[1])

        # Generate slug (same logic as import_shelters.py)
        slug = make_slug(title, lon)

        if slug not in existing_slugs:
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

            description = (_get_prop(props, "beskrivels", "beskrivelse") or "").strip()
            objekt_id = _get_prop(props, "objekt_id", "id", "objectid", "fkg_id")

            new_shelters.append({
                "title": title,
                "slug": slug,
                "kommune": kommune,
                "lat": lat,
                "lon": lon,
                "description": description[:120] + "..." if len(description) > 120 else description,
                "objekt_id": objekt_id,
            })

    print()
    print("=" * 60)
    print(f"RESULTAT")
    print(f"  GeoFA shelters total: {len(features) - skipped_type}")
    print(f"  Eksisterende i DB:    {len(existing_slugs)}")
    print(f"  NYE (ikke i DB):      {len(new_shelters)}")
    print(f"  Sprunget over (ikke shelter): {skipped_type}")
    print("=" * 60)

    if new_shelters:
        print()
        print("NYE SHELTERS:")
        print("-" * 60)
        for i, s in enumerate(new_shelters, 1):
            print(f"\n{i}. {s['title']}")
            print(f"   Slug: {s['slug']}")
            print(f"   Kommune: {s['kommune'] or 'ukendt'}")
            print(f"   Koordinater: {s['lat']:.4f}, {s['lon']:.4f}")
            print(f"   GeoFA ID: {s['objekt_id']}")
            if s['description']:
                print(f"   Beskrivelse: {s['description']}")

        # Save to file for reference
        output_path = os.path.join(_script_dir, "new_shelters_found.json")
        with open(output_path, "w") as f:
            json.dump(new_shelters, f, indent=2, ensure_ascii=False)
        print(f"\nGemt til {output_path} for reference.")
    else:
        print("\nIngen nye shelters fundet — databasen er up-to-date!")

if __name__ == "__main__":
    main()
