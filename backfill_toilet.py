#!/usr/bin/env python3
"""
Backfill toilet-status for shelters der har toilet=null eller toilet='unknown'.

Scanner beskrivelse og geofa_raw med forbedret detect_toilet_status-logik.
Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.

Kør: python3 backfill_toilet.py [--dry-run]
"""
import argparse
import os
import sys

_script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _script_dir)

for p in (os.path.join(_script_dir, ".env"), os.path.join(_script_dir, ".env.local"), ".env"):
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

from supabase import create_client
from import_shelters import detect_toilet_status

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not url or not key:
    print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
    sys.exit(1)

supabase = create_client(url, key)


def main():
    ap = argparse.ArgumentParser(description="Backfill toilet-status for shelters")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun hvad der ville blive opdateret")
    ap.add_argument("--all", action="store_true", help="Behandl alle shelters (ikke kun unknown)")
    args = ap.parse_args()

    query = (
        supabase.table("shelters")
        .select("id, slug, title, description, geofa_raw, toilet")
        .is_("duplicate_of_shelter_id", None)
    )
    if not args.all:
        query = query.or_("toilet.is.null,toilet.eq.unknown")

    r = query.execute()
    rows = r.data or []
    scope = "alle" if args.all else "toilet=null eller unknown"
    print(f"Fundet {len(rows)} shelters ({scope})")

    updated = 0
    for row in rows:
        desc = row.get("description") or ""
        geofa = row.get("geofa_raw") or {}
        detected = detect_toilet_status(desc, geofa)
        current = row.get("toilet") or "unknown"
        if detected == "unknown" or detected == current:
            continue
        if args.dry_run:
            print(f"  [{row.get('slug')}] {row.get('title')[:50]}... -> {detected}")
            updated += 1
            continue
        try:
            supabase.table("shelters").update({"toilet": detected}).eq("id", row["id"]).execute()
            updated += 1
            if updated % 50 == 0:
                print(f"  Opdateret {updated}...")
        except Exception as e:
            print(f"  Fejl ved {row.get('slug')}: {e}")

    print(f"\nOpdateret {updated} shelters" + (" (dry-run)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
