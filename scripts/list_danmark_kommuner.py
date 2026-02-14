#!/usr/bin/env python3
"""
Vis hvilke kommuner der stadig har region = 'Danmark' – så du kan udvide
KOMMUNE_TO_LANDSDEL i backfill_region_from_kommune.py og få flere med Jylland/Sjælland/Fyn.

Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.
Kør: python3 scripts/list_danmark_kommuner.py
"""
import os
import re

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

from supabase import create_client

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not url or not key:
    print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY.")
    exit(1)

supabase = create_client(url, key)

# Saml alle rækker med region = Danmark (inkl. duplikater ignoreres vi ikke her, men vi tæller kommune)
all_rows = []
offset = 0
page_size = 1000
while True:
    r = supabase.table("shelters").select("kommune, region").is_("duplicate_of_shelter_id", None).range(offset, offset + page_size - 1).execute()
    chunk = r.data or []
    all_rows.extend(chunk)
    if len(chunk) < page_size:
        break
    offset += page_size

# Kun dem med region Danmark
danmark_rows = [row for row in all_rows if (row.get("region") or "").strip() == "Danmark"]
kommune_counts = {}
for row in danmark_rows:
    k = (row.get("kommune") or "").strip()
    if not k or k.isdigit():
        k = "(tom eller tal)"
    kommune_counts[k] = kommune_counts.get(k, 0) + 1

print(f"Shelters med region = 'Danmark': {len(danmark_rows)} / {len(all_rows)}")
print("\nKommune-navne hos disse (antal):")
print("-" * 50)
for kommune in sorted(kommune_counts.keys(), key=lambda x: (-kommune_counts[x], x)):
    print(f"  {kommune}: {kommune_counts[kommune]}")
print("\n→ Tilføj manglende kommuner til KOMMUNE_TO_LANDSDEL i backfill_region_from_kommune.py")
print("  eller ret stavning/normalisering (_n-funktionen), og kør derefter:")
print("  python3 backfill_region_from_kommune.py")
