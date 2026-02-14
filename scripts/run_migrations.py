#!/usr/bin/env python3
"""
Kør migrationer (001–017) mod Supabase/Postgres.

Kræver database-connection-string med rettigheder til DDL (ALTER TABLE, CREATE TABLE osv.).
I Supabase: Project Settings → Database → Connection string (URI). Brug fx "Transaction" mode.

Sæt i .env eller miljø:
  DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
  # eller
  SUPABASE_DB_URL=postgresql://...

Kør: python3 scripts/run_migrations.py
  --dry-run   vis kun hvilke filer der ville blive kørt
"""
import argparse
import os
import re
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
        if not os.environ.get("DATABASE_URL") and not os.environ.get("SUPABASE_DB_URL"):
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        v = v.strip().strip('"').strip("'")
                        if k.strip() in ("DATABASE_URL", "SUPABASE_DB_URL") and v:
                            os.environ.setdefault(k.strip(), v)

def main():
    ap = argparse.ArgumentParser(description="Kør migrationer mod Postgres")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun filer, kør ikke SQL")
    args = ap.parse_args()

    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        print("Mangler DATABASE_URL eller SUPABASE_DB_URL.")
        print("  Supabase: Project Settings → Database → Connection string (URI).")
        print("  Sæt i .env: DATABASE_URL=postgresql://...")
        print()
        print("Eller kør migrationerne manuelt i Supabase Dashboard → SQL Editor:")
        mig_dir = os.path.join(_script_dir, "migrations")
        for name in sorted(os.listdir(mig_dir or [])):
            if name.endswith(".sql"):
                print(f"  - migrations/{name}")
        return 1

    mig_dir = os.path.join(_script_dir, "migrations")
    if not os.path.isdir(mig_dir):
        print("Mappen migrations/ findes ikke.")
        return 1

    files = []
    for name in os.listdir(mig_dir):
        if name.endswith(".sql"):
            m = re.match(r"^(\d+)_", name)
            if m:
                files.append((int(m.group(1)), name))
    files.sort(key=lambda x: x[0])

    if not files:
        print("Ingen migrations/*.sql fundet.")
        return 1

    if args.dry_run:
        print("Ville køre (dry-run):")
        for _, name in files:
            print(f"  migrations/{name}")
        return 0

    try:
        import psycopg2
    except ImportError:
        print("Installer psycopg2: pip install psycopg2-binary")
        return 1

    conn = None
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        cur = conn.cursor()
        for _, name in files:
            path = os.path.join(mig_dir, name)
            with open(path, encoding="utf-8") as f:
                body = f.read()
            try:
                cur.execute(body)
                print(f"  OK  {name}")
            except Exception as e:
                print(f"  FEJL {name}: {e}")
        cur.close()
    except Exception as e:
        print(f"Forbindelse/SQL-fejl: {e}")
        return 1
    finally:
        if conn:
            conn.close()

    print("Færdig.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
