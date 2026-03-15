#!/usr/bin/env python3
"""
Sæt shelters.image_url til NULL hvor URL'en returnerer 404 (eller anden fejl).

Så vises placeholder i stedet, og du kan evt. køre backfill_image_from_google_places.py
for at fylde med Google-billeder hvor muligt.

Kør: python3 clear_404_image_urls.py [--dry-run] [--limit N]
     --dry-run: vis kun hvad der ville blive opdateret
     --limit N: tjek max N shelters (default 2000, 0 = alle)
Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY
"""
import argparse
import os
import time
from typing import Optional

import requests

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_dirs = [_script_dir, os.path.join(_script_dir, "web")]
for d in _env_dirs:
    for p in (os.path.join(d, ".env.local"), os.path.join(d, ".env")):
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

USER_AGENT = "ShelterDK/1.0 (clear 404 image_urls)"
REQUEST_TIMEOUT = 10
# Undgå for mange samtidige kald
SLEEP_PER_REQUEST = 0.3


def check_url(url: str) -> bool:
    """Return True hvis URL'en virker (2xx), False ved 404/5xx/timeout."""
    if not url or not url.startswith("http"):
        return False
    try:
        r = requests.head(
            url,
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
            allow_redirects=True,
        )
        if r.status_code == 405:
            # Nogle servere tillader ikke HEAD – prøv GET
            r = requests.get(
                url,
                timeout=REQUEST_TIMEOUT,
                headers={"User-Agent": USER_AGENT},
                stream=True,
            )
            r.close()
        return 200 <= r.status_code < 400
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser(description="Sæt image_url til NULL hvor URL returnerer 404")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun hvad der ville blive opdateret")
    ap.add_argument("--limit", type=int, default=2000, help="Max antal shelters at tjekke (0 = alle)")
    args = ap.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return 1

    from supabase import create_client
    supabase = create_client(url, key)

    fetch_limit = (args.limit * 3) if args.limit > 0 else 10000
    r = supabase.table("shelters").select("id, title, image_url, image_urls").is_(
        "duplicate_of_shelter_id", None
    ).limit(fetch_limit).execute()
    rows = [s for s in (r.data or []) if (s.get("image_url") or "").strip() or (s.get("image_urls") or [])]
    if args.limit > 0:
        rows = rows[: args.limit]

    print(f"Tjekker {len(rows)} shelter(s) (image_url + image_urls)...")
    if not rows:
        print("Ingen at tjekke.")
        return 0

    to_update = []
    for i, s in enumerate(rows):
        sid = s["id"]
        title = s.get("title") or sid
        primary = (s.get("image_url") or "").strip()
        urls_list = s.get("image_urls")
        if not isinstance(urls_list, list):
            urls_list = []
        all_urls = ([primary] if primary and primary.startswith("http") else []) + [
            u for u in urls_list if isinstance(u, str) and u.strip().startswith("http")
        ]
        if not all_urls:
            continue

        working = []
        primary_ok = False
        for u in all_urls:
            url = (u or "").strip()
            if not url:
                continue
            if check_url(url):
                working.append(url)
                if url == primary:
                    primary_ok = True
            if (i + 1) % 50 == 0 and url == all_urls[-1]:
                print(f"  Tjekket {i + 1}/{len(rows)}...")
            time.sleep(SLEEP_PER_REQUEST)

        new_primary = working[0] if working else None
        if primary_ok and primary and primary in working:
            new_primary = primary
        new_urls_list = working[1:] if (working and new_primary == working[0]) else (working if working else [])
        new_urls_same = new_urls_list == urls_list

        primary_changed = (not primary_ok and primary) or (working and not primary_ok and primary)
        urls_changed = not new_urls_same

        if primary_changed or urls_changed:
            to_update.append((
                sid,
                title,
                new_primary,
                new_urls_list if urls_changed else None,
            ))

    updates = []
    for sid, title, new_primary, new_urls in to_update:
        payload = {}
        payload["image_url"] = new_primary
        if new_urls is not None:
            payload["image_urls"] = new_urls
        if payload:
            updates.append((sid, title, payload))

    print(f"Fundet {len(updates)} shelter(s) med defekte billed-URL'er (404/403/timeout).")
    if not updates:
        print("Ingen opdateringer nødvendige.")
        return 0

    if args.dry_run:
        print("(dry-run – ingen opdateringer)")
        for sid, title, payload in updates[:25]:
            msg = []
            if "image_url" in payload:
                msg.append("image_url→" + ("NULL" if payload["image_url"] is None else "opdateret"))
            if "image_urls" in payload:
                msg.append(f"image_urls→{len(payload['image_urls'])} URL'er")
            print(f"  {title[:45]}…  [{', '.join(msg)}]")
        if len(updates) > 25:
            print(f"  ... og {len(updates) - 25} til")
        return 0

    updated = 0
    for sid, title, payload in updates:
        supabase.table("shelters").update(payload).eq("id", sid).execute()
        updated += 1
        if updated <= 10 or updated % 100 == 0:
            print(f"  [{updated}/{len(updates)}] {title[:50]}…")
    print(f"Færdig. Opdateret {updated} shelter(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
