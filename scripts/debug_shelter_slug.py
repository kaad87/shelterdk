#!/usr/bin/env python3
"""
Tjek om et shelter med given slug findes i databasen.

Kør: python3 scripts/debug_shelter_slug.py shelters-ved-gyldendal-havn-87118
"""
import os
import sys

slug = sys.argv[1] if len(sys.argv) > 1 else "shelters-ved-gyldendal-havn-87118"

_script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(_script_dir)
for p in (".env", "web/.env.local", ".env.local"):
    path = os.path.join(_script_dir, p)
    if os.path.isfile(path):
        try:
            from dotenv import load_dotenv
            load_dotenv(path)
        except ImportError:
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        os.environ.setdefault(k.strip(), v.strip().strip('"'))
        break

try:
    from supabase import create_client
except ImportError:
    print("pip install supabase")
    sys.exit(1)

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not url or not key:
    print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
    sys.exit(1)

sb = create_client(url, key)

print(f"Søger efter slug: {slug}\n")

# 1. Præcis match (kanonisk)
r = sb.table("shelters").select("id, title, slug, region, kommune, duplicate_of_shelter_id").eq("slug", slug).is_("duplicate_of_shelter_id", None).execute()
print("1. Kanonisk (duplicate_of=null):", len(r.data or []), "rækker")
for row in (r.data or []):
    print("   ", row)

# 2. Præcis match inkl. duplicates
r2 = sb.table("shelters").select("id, title, slug, region, kommune, duplicate_of_shelter_id").eq("slug", slug).execute()
print("\n2. Alle (inkl. duplicates):", len(r2.data or []), "rækker")
for row in (r2.data or []):
    print("   ", row)

# 3. Fuzzy – gyldendal
r3 = sb.table("shelters").select("id, title, slug, region, kommune").ilike("slug", "%gyldendal%").limit(10).execute()
print("\n3. Fuzzy (slug ILIKE '%gyldendal%'):", len(r3.data or []), "rækker")
for row in (r3.data or []):
    print("   ", row)

# 4. Skive kommune
r4 = sb.table("shelters").select("id, title, slug, region, kommune").eq("kommune", "Skive").is_("duplicate_of_shelter_id", None).limit(5).execute()
print("\n4. Eksempel Skive kommune (5 stk):")
for row in (r4.data or []):
    print("   ", row)
