#!/usr/bin/env python3
"""
Tjek om databasen er klar til silo-routing og FAQ.

- region + kommune: skal være udfyldt for /danmark/[region]/[municipality]/[slug]
- toilet: bruges til FAQ på sheltersiden (valgfri kolonne)
- display_score: bruges til sortering (migration 016)

Kræver: .env eller web/.env.local med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.
Kør: python3 scripts/check_silo_data.py
"""
import os
import sys

_script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(_script_dir)

for p in (".env", ".env.local", "web/.env.local"):
    path = os.path.join(_script_dir, p)
    if os.path.isfile(path):
        try:
            from dotenv import load_dotenv
            load_dotenv(path)
        except ImportError:
            pass
        if not os.environ.get("NEXT_PUBLIC_SUPABASE_URL"):
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        os.environ.setdefault(k.strip(), v.strip().strip('"'))

try:
    from supabase import create_client
except ImportError:
    print("FEJL: Installer supabase: pip install supabase")
    sys.exit(1)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not url or not key:
    print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY.")
    print("  Sæt dem i .env eller web/.env.local i projektroden.")
    sys.exit(1)

supabase = create_client(url, key)

def main():
    print("=" * 60)
    print("ShelterDK – tjek af data til silo + FAQ")
    print("=" * 60)

    # Basis: antal shelters (uden duplikater)
    r = supabase.table("shelters").select("id", count="exact").is_("duplicate_of_shelter_id", None).execute()
    total = r.count if hasattr(r, "count") and r.count is not None else len(r.data or [])
    print(f"\n1. Shelters (uden duplikater): {total}")

    # Region + kommune
    try:
        r = supabase.table("shelters").select("region, kommune").is_("duplicate_of_shelter_id", None).execute()
        rows = r.data or []
    except Exception as e:
        print(f"   Kunne ikke hente region/kommune: {e}")
        rows = []

    with_region = sum(1 for row in rows if (row.get("region") or "").strip() and (row.get("region") or "").strip() != "Danmark")
    with_region_any = sum(1 for row in rows if (row.get("region") or "").strip())
    with_kommune = sum(1 for row in rows if (row.get("kommune") or "").strip() and not (str(row.get("kommune") or "").strip()).isdigit())
    with_both = sum(1 for row in rows if (row.get("region") or "").strip() and (row.get("region") or "").strip() != "Danmark" and (row.get("kommune") or "").strip() and not (str(row.get("kommune") or "").strip()).isdigit())

    print(f"\n2. REGION (til silo /danmark/[region]/...)")
    print(f"   - Med region udfyldt (alle):     {with_region_any} / {total}")
    print(f"   - Med region ≠ 'Danmark':        {with_region} / {total}  (Jylland/Sjælland/Fyn)")
    if with_region < total and total > 0:
        print(f"   → Kør: python3 backfill_region_from_kommune.py")
        print(f"     (sætter region til Jylland/Sjælland/Fyn ud fra kommune)")

    print(f"\n3. KOMMUNE (til silo .../[municipality]/...)")
    print(f"   - Med kommune udfyldt (gyldig):  {with_kommune} / {total}")
    if with_kommune < total and total > 0:
        print(f"   → Kør: python3 backfill_kommune_from_geo.py")
        print(f"     (udfylder kommune fra koordinater via Nominatim)")

    print(f"\n4. SILO-KLAR (region ≠ Danmark OG kommune)")
    print(f"   - Shelters med begge:            {with_both} / {total}")
    if with_both == 0 and total > 0:
        print("   → Kør først backfill_kommune_from_geo.py, derefter backfill_region_from_kommune.py")

    # Fordeling af regioner
    regions = {}
    for row in rows:
        reg = (row.get("region") or "").strip()
        if reg:
            regions[reg] = regions.get(reg, 0) + 1
    if regions:
        print("\n5. FORDELING – regioner i DB")
        for reg in sorted(regions.keys(), key=lambda x: (-regions[x], x)):
            print(f"   - {reg}: {regions[reg]} shelters")

    # Toilet (valgfri kolonne)
    print("\n6. TOILET (til FAQ på shelterside)")
    try:
        r = supabase.table("shelters").select("toilet").is_("duplicate_of_shelter_id", None).limit(1).execute()
        print("   - Kolonne 'toilet' findes: ja")
        r2 = supabase.table("shelters").select("toilet").is_("duplicate_of_shelter_id", None).execute()
        rows2 = r2.data or []
        with_toilet = sum(1 for row in rows2 if row.get("toilet") in ("flush", "mulch", "none", "unknown"))
        print(f"   - Shelters med toilet sat:   {with_toilet} / {len(rows2)}")
        if with_toilet == 0 and len(rows2) > 0:
            print("   - Tip: toilet sættes ved import (import_shelters.py). Evt. kør re-import eller lad FAQ vise 'ukendt'.")
    except Exception as e:
        if "42703" in str(e) or "column" in str(e).lower():
            print("   - Kolonne 'toilet' findes ikke i DB.")
            print("     Tilføj evt. med: ALTER TABLE shelters ADD COLUMN IF NOT EXISTS toilet text CHECK (toilet IN ('flush','mulch','none','unknown'));")
        else:
            print(f"   - Fejl: {e}")

    # display_score
    print("\n7. DISPLAY_SCORE (til sortering)")
    try:
        r = supabase.table("shelters").select("display_score").is_("duplicate_of_shelter_id", None).limit(1).execute()
        print("   - Kolonne 'display_score' findes: ja")
        r2 = supabase.table("shelters").select("display_score").is_("duplicate_of_shelter_id", None).execute()
        rows2 = r2.data or []
        with_score = sum(1 for row in rows2 if row.get("display_score") is not None)
        print(f"   - Shelters med display_score:  {with_score} / {len(rows2)}")
        if with_score == 0 and len(rows2) > 0:
            print("   - Kør migration 016_display_score.sql (beregnet kolonne).")
    except Exception as e:
        if "42703" in str(e) or "column" in str(e).lower():
            print("   - Kolonne 'display_score' findes ikke.")
            print("     Kør: migrations/016_display_score.sql i Supabase SQL Editor.")
        else:
            print(f"   - Fejl: {e}")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
