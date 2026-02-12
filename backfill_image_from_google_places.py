#!/usr/bin/env python3
"""
Udfyld shelters.image_url fra Google Places-billeder når GeoFA-billedet mangler eller er defekt.

Vi har allerede google_place_id og google_places.photo_references (fra fetch_google_places.py).
Dette script kalder Google Place Photo API, følger redirect til den faktiske billed-URL
(lh3.googleusercontent.com) og gemmer den i shelters.image_url.

Kør: python3 backfill_image_from_google_places.py [--dry-run] [--force]
     --dry-run: vis kun hvad der ville blive opdateret
     --force:   opdater også shelters der allerede har image_url (erstatter med Google-billede)
Kræver: .env med NEXT_PUBLIC_SUPABASE_*, GOOGLE_MAPS_API_KEY (eller GOOGLE_PLACES_API_KEY)
"""
import argparse
import os
import time
from typing import Optional

import requests

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")
for p in (_env_path, os.path.join(_script_dir, ".env.local"), ".env.local", ".env"):
    if os.path.isfile(p):
        try:
            from dotenv import load_dotenv
            load_dotenv(p)
        except ImportError:
            pass
        if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL") and os.path.isfile(p):
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        os.environ.setdefault(k.strip(), v.strip())

PHOTO_API = "https://maps.googleapis.com/maps/api/place/photo"
RATE_LIMIT_S = 1.0


def get_photo_url(api_key: str, photo_reference: str, max_width: int = 1200) -> Optional[str]:
    """
    Kald Place Photo API; returner den endelige billed-URL (redirect destination).
    Returnerer None ved fejl.
    """
    if not photo_reference or not api_key:
        return None
    try:
        resp = requests.get(
            PHOTO_API,
            params={
                "photo_reference": photo_reference,
                "maxwidth": max_width,
                "key": api_key,
            },
            allow_redirects=False,
            timeout=10,
        )
        if resp.status_code == 302 and "Location" in resp.headers:
            return resp.headers["Location"].strip()
        return None
    except Exception as e:
        print(f"    Photo API fejl: {e}")
        return None


def main():
    ap = argparse.ArgumentParser(description="Udfyld image_url fra Google Places-billeder")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun hvad der ville blive opdateret")
    ap.add_argument(
        "--force",
        action="store_true",
        help="Opdater også shelters der allerede har image_url (erstatter med Google-billede)",
    )
    args = ap.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not url or not key:
        print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return 1
    if not api_key:
        print("FEJL: Mangler GOOGLE_MAPS_API_KEY (eller GOOGLE_PLACES_API_KEY) i .env")
        return 1

    from supabase import create_client
    supabase = create_client(url, key)

    # Shelters med google_place_id
    r = supabase.table("shelters").select("id, title, slug, image_url, google_place_id").execute()
    shelters = [s for s in (r.data or []) if (s.get("google_place_id") or "").strip()]
    if not shelters:
        print("Ingen shelters med google_place_id.")
        return 0

    # Filtrer: kun dem uden image_url (eller alle ved --force)
    if not args.force:
        shelters = [s for s in shelters if not (s.get("image_url") or "").strip()]
    if not shelters:
        print("Ingen shelters mangler image_url. Brug --force for at erstatte med Google-billede.")
        return 0

    # Hent google_places for de place_id'er vi skal bruge
    place_ids = list({s["google_place_id"] for s in shelters})
    r2 = supabase.table("google_places").select("google_place_id, photo_references").in_(
        "google_place_id", place_ids
    ).execute()
    places = {}
    for row in r2.data or []:
        refs = row.get("photo_references")
        if refs and isinstance(refs, list) and len(refs) > 0 and refs[0]:
            places[row["google_place_id"]] = refs[0] if isinstance(refs[0], str) else None

    to_update = [s for s in shelters if places.get(s["google_place_id"])]
    print(f"Shelters med google_place_id: {len(shelters)}, med photo_reference: {len(to_update)}")
    if not to_update:
        print("Ingen shelters har Google-billede at hente (kør fetch_google_places.py først).")
        return 0

    if args.dry_run:
        print("(dry-run – ingen opdateringer)")
    updated = 0
    for i, s in enumerate(to_update):
        ref = places.get(s["google_place_id"])
        if not ref:
            continue
        photo_url = get_photo_url(api_key, ref)
        if photo_url:
            if not args.dry_run:
                supabase.table("shelters").update({"image_url": photo_url}).eq("id", s["id"]).execute()
            updated += 1
            print(f"  [{i+1}/{len(to_update)}] {s.get('title', s['id'])[:50]} → Google-billede")
        else:
            print(f"  [{i+1}/{len(to_update)}] {s.get('title', s['id'])[:50]} → (kunne ikke hente URL)")
        if i < len(to_update) - 1:
            time.sleep(RATE_LIMIT_S)

    print(f"Færdig. Opdateret {updated} shelter(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
