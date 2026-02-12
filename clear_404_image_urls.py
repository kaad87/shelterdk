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

    # Hent i batcher og filtrer i Python (undgår .not_() API som kan give "not callable")
    fetch_limit = (args.limit * 3) if args.limit > 0 else 10000
    r = supabase.table("shelters").select("id, title, image_url").limit(fetch_limit).execute()
    rows = [s for s in (r.data or []) if (s.get("image_url") or "").strip()]
    if args.limit > 0:
        rows = rows[: args.limit]

    print(f"Tjekker {len(rows)} shelter(s) med image_url...")
    if not rows:
        print("Ingen at tjekke.")
        return 0

    to_clear = []
    for i, s in enumerate(rows):
        img = (s.get("image_url") or "").strip()
        if not img or not img.startswith("http"):
            to_clear.append((s["id"], s.get("title") or s["id"], img[:60]))
            continue
        if not check_url(img):
            to_clear.append((s["id"], s.get("title") or s["id"], img[:60]))
        if (i + 1) % 50 == 0:
            print(f"  Tjekket {i + 1}/{len(rows)}...")
        time.sleep(SLEEP_PER_REQUEST)

    print(f"Fundet {len(to_clear)} med 404/fejl der sættes til NULL.")
    if not to_clear:
        print("Ingen opdateringer nødvendige.")
        return 0

    if args.dry_run:
        print("(dry-run – ingen opdateringer)")
        for sid, title, u in to_clear[:20]:
            print(f"  {title[:45]}… → NULL")
        if len(to_clear) > 20:
            print(f"  ... og {len(to_clear) - 20} til")
        return 0

    updated = 0
    for sid, title, _ in to_clear:
        supabase.table("shelters").update({"image_url": None}).eq("id", sid).execute()
        updated += 1
        if updated <= 10 or updated % 100 == 0:
            print(f"  [{updated}/{len(to_clear)}] {title[:50]}…")
    print(f"Færdig. Opdateret {updated} shelter(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
