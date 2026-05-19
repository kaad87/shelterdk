#!/usr/bin/env python3
"""
Backfill booking metadata on shelters without touching editorial text.

Sets:
  - booking_provider
  - booking_link_mode
  - booking_lookup_key
  - booking_url_verified_at
  - booking_confidence

The script only updates these metadata columns and never modifies title,
description, images, or existing booking URLs.

Usage:
  python3 backfill_shelter_booking_model.py --dry-run
  python3 backfill_shelter_booking_model.py
"""
import argparse
import os
from datetime import datetime, timezone
from urllib.parse import urlparse


def load_env():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(script_dir, ".env"), os.path.join(script_dir, ".env.local"), ".env"):
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


def raw_dict(row):
    raw = row.get("geofa_raw")
    return raw if isinstance(raw, dict) else {}


def str_in_raw(row, key):
    value = raw_dict(row).get(key)
    return value.strip() if isinstance(value, str) else ""


def is_legacy_bookable(row):
    url = (row.get("booking_url") or "").strip()
    if url:
        return True
    book = str_in_raw(row, "book").lower()
    if "ja" in book:
        return True
    title = (row.get("title") or "").lower()
    return "bookbar" in title


def infer_provider_from_url(url):
    if not url:
        return None
    lower = url.lower()
    if "shelterdk.dk" in lower:
        return "shelterdk"
    if "book.naturstyrelsen.dk" in lower:
        return "naturstyrelsen"
    if "udinaturen.dk" in lower:
        return "udinaturen"
    try:
        host = urlparse(url).hostname or ""
    except Exception:
        host = ""
    host = host.lower()
    if ".kommune.dk" in host or "kommune" in host:
        return "kommune"
    return "private"


def infer_provider_from_contact(row):
    haystack = " ".join([
        str_in_raw(row, "ansvar_org"),
        str_in_raw(row, "kontakt"),
        str(row.get("description") or ""),
    ]).lower()
    if not haystack.strip():
        return None
    if "naturstyrelsen" in haystack or "nst.dk" in haystack:
        return "naturstyrelsen"
    if "kommune" in haystack:
        return "kommune"
    return "private"


def naturstyrelsen_lookup_key(url):
    if not url or "book.naturstyrelsen.dk/sted/" not in url.lower():
        return None
    try:
        path = urlparse(url).path.strip("/")
    except Exception:
        return None
    parts = path.split("/")
    if len(parts) >= 2 and parts[0].lower() == "sted" and parts[1]:
        return parts[1]
    return None


def resolve_booking_metadata(row):
    url = (row.get("booking_url") or "").strip() or None
    provider = row.get("booking_provider") or infer_provider_from_url(url) or infer_provider_from_contact(row)
    confidence = row.get("booking_confidence")
    if not confidence:
        confidence = "imported" if url else "heuristic" if is_legacy_bookable(row) else None

    if row.get("booking_link_mode"):
        mode = row["booking_link_mode"]
    elif url:
        mode = "external_direct"
    elif is_legacy_bookable(row) and provider == "naturstyrelsen":
        mode = "external_search"
    elif is_legacy_bookable(row):
        mode = "contact_only"
    else:
        mode = "first_come"

    lookup_key = row.get("booking_lookup_key") or naturstyrelsen_lookup_key(url)
    verified_at = row.get("booking_url_verified_at")
    if not verified_at and url:
        verified_at = datetime.now(timezone.utc).isoformat()

    return {
        "booking_provider": provider or ("unknown" if mode != "first_come" else None),
        "booking_link_mode": mode,
        "booking_lookup_key": lookup_key,
        "booking_url_verified_at": verified_at,
        "booking_confidence": confidence,
    }


def fetch_all_rows(supabase, table, select_sql):
    rows = []
    page_size = 1000
    start = 0
    while True:
        result = (
            supabase.table(table)
            .select(select_sql)
            .range(start, start + page_size - 1)
            .execute()
        )
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        start += page_size
    return rows


def main():
    load_env()
    parser = argparse.ArgumentParser(description="Backfill shelter booking metadata")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without updating DB")
    args = parser.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return 1

    from supabase import create_client
    supabase = create_client(url, key)

    rows = fetch_all_rows(
        supabase,
        "shelters",
        "id,title,slug,description,booking_url,booking_provider,booking_link_mode,booking_lookup_key,booking_url_verified_at,booking_confidence,geofa_raw"
    )
    changes = []

    for row in rows:
        resolved = resolve_booking_metadata(row)
        changed = {
            key: value
            for key, value in resolved.items()
            if row.get(key) != value
        }
        if changed:
            changes.append((row, changed))

    print(f"Found {len(changes)} shelters with booking metadata changes.")
    for row, changed in changes[:30]:
        print(f"- {row.get('slug')}: {changed}")
    if len(changes) > 30:
        print(f"... and {len(changes) - 30} more")

    if args.dry_run or not changes:
        return 0

    updated = 0
    for row, changed in changes:
        supabase.table("shelters").update(changed).eq("id", row["id"]).execute()
        updated += 1

    print(f"Updated {updated} shelters.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
