#!/usr/bin/env python3
"""
Backfill vand-status for shelters hvor water=null.

Bruger geofa_raw.vandhane og beskrivelsestekst via detect_water_status.
Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.

Kør: python3 backfill_water.py [--dry-run] [--all]
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
from import_shelters import detect_water_status

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not url or not key:
    print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
    sys.exit(1)

supabase = create_client(url, key)


BATCH_SIZE = 1000


def main():
    ap = argparse.ArgumentParser(description="Backfill vand-status for shelters")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun hvad der ville blive opdateret")
    ap.add_argument("--all", action="store_true", help="Behandl alle shelters (ikke kun water=null)")
    args = ap.parse_args()

    scope = "alle" if args.all else "water=null"
    total_updated = 0
    batch_num = 0
    offset = 0

    while True:
        batch_num += 1
        query = (
            supabase.table("shelters")
            .select("id, slug, title, description, geofa_raw, water")
            .is_("duplicate_of_shelter_id", None)
            .order("id")
        )
        if not args.all:
            query = query.is_("water", None)
        # Paginering: Supabase default max 1000, så brug range
        query = query.range(offset, offset + BATCH_SIZE - 1)

        r = query.execute()
        rows = r.data or []
        if not rows:
            break

        print(f"Batch {batch_num}: fundet {len(rows)} shelters ({scope})")
        updated = 0
        for row in rows:
            desc = row.get("description") or ""
            geofa = row.get("geofa_raw") or {}
            detected = detect_water_status(desc, geofa)
            current = row.get("water")
            # Skip hvis detekteret er ukendt og vi ikke kører --all (behold null)
            if detected is None and not args.all:
                continue
            if detected == current:
                continue
            if args.dry_run:
                print(f"  [{row.get('slug')}] {row.get('title', '')[:50]}... -> {detected}")
                updated += 1
                continue
            try:
                supabase.table("shelters").update({"water": detected}).eq("id", row["id"]).execute()
                updated += 1
                total_updated += 1
                if total_updated % 50 == 0:
                    print(f"  Opdateret {total_updated} i alt...")
            except Exception as e:
                print(f"  Fejl ved {row.get('slug')}: {e}")

        if len(rows) < BATCH_SIZE:
            break
        offset += BATCH_SIZE

    print(f"\nOpdateret {total_updated} shelters i alt" + (" (dry-run)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
