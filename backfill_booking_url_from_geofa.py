#!/usr/bin/env python3
"""
Udfyld shelters.booking_url fra geofa_raw når GeoFA har et udinaturen.dk-link et sted i data.

F.eks. shelters hvor titlen siger "bookbar" men booking_url er tom – linket kan ligge
i et andet GeoFA-felt. Scanner alle værdier i geofa_raw efter udinaturen.dk-URL'er.

Kør: python3 backfill_booking_url_from_geofa.py [--dry-run]
Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.
"""
import argparse
import os
import re

_script_dir = os.path.dirname(os.path.abspath(__file__))
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

# Match URL der indeholder udinaturen.dk og ser ud som et facilitets-/booking-link
UDINATUREN_URL_RE = re.compile(
    r"https?://(?:www\.)?udinaturen\.dk/[^\s\"'<>]+",
    re.I
)


def _find_udinaturen_url_in_obj(obj):
    """Recursivt: find første string i dict/list der matcher udinaturen.dk-URL."""
    if isinstance(obj, dict):
        for v in obj.values():
            u = _find_udinaturen_url_in_obj(v)
            if u:
                return u
    elif isinstance(obj, list):
        for item in obj:
            u = _find_udinaturen_url_in_obj(item)
            if u:
                return u
    elif isinstance(obj, str):
        m = UDINATUREN_URL_RE.search(obj)
        if m:
            url = m.group(0).rstrip(".,;)]}\"'")
            if "facilitet" in url or "?" in url or "/sted/" in url:
                return url
    return None


def main():
    ap = argparse.ArgumentParser(description="Udfyld booking_url fra geofa_raw (udinaturen.dk)")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun hvad der ville blive opdateret")
    args = ap.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return 1

    from supabase import create_client
    supabase = create_client(url, key)

    # Shelters uden booking_url men med geofa_raw (så vi kan lede efter udinaturen-link)
    r = supabase.table("shelters").select("id, title, slug, booking_url, geofa_raw").execute()
    rows = r.data or []
    to_update = []
    for row in rows:
        if (row.get("booking_url") or "").strip():
            continue
        raw = row.get("geofa_raw")
        if not raw or not isinstance(raw, dict):
            continue
        found = _find_udinaturen_url_in_obj(raw)
        if found:
            to_update.append({
                "id": row["id"],
                "title": (row.get("title") or "")[:50],
                "booking_url": found,
            })

    print(f"Fundet {len(to_update)} shelter(s) med udinaturen.dk-link i geofa_raw uden booking_url.")
    if not to_update:
        print("Ingen at opdatere.")
        return 0

    if args.dry_run:
        print("(dry-run – ingen opdateringer)")
    for u in to_update:
        if not args.dry_run:
            supabase.table("shelters").update({"booking_url": u["booking_url"]}).eq("id", u["id"]).execute()
        print(f"  {u['title']}… → {u['booking_url'][:60]}…")

    print(f"Færdig. Opdateret {len(to_update)} shelter(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
