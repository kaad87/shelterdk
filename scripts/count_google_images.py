#!/usr/bin/env python3
"""
Tæl hvor mange shelters der bruger Google-billeder (image_url fra lh3.googleusercontent.com).
Kræver: .env med NEXT_PUBLIC_SUPABASE_* (som de andre script).
"""
import os
import sys

_script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_env_path = os.path.join(_script_dir, ".env")
for p in (_env_path, os.path.join(_script_dir, ".env.local"), ".env.local", ".env"):
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

GOOGLE_IMAGE_HOST = "googleusercontent.com"


def main():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return 1

    from supabase import create_client
    supabase = create_client(url, key)

    # Hent alle (paginér – Supabase default limit er 1000)
    rows = []
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("shelters")
            .select("id, image_url, image_urls")
            .is_("duplicate_of_shelter_id", None)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        chunk = r.data or []
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size
    total = len(rows)

    # Primært billede (image_url) fra Google
    with_google_primary = 0
    # Mindst ét Google-billede i image_url eller image_urls
    with_google_any = 0

    for s in rows:
        primary = (s.get("image_url") or "").strip()
        urls_json = s.get("image_urls")
        all_urls = [primary] if primary else []
        if urls_json:
            if isinstance(urls_json, list):
                all_urls.extend([u for u in urls_json if isinstance(u, str) and u.strip()])
            elif isinstance(urls_json, str):
                all_urls.append(urls_json)
        has_google_primary = primary and GOOGLE_IMAGE_HOST in primary
        has_google_any = any(GOOGLE_IMAGE_HOST in u for u in all_urls)
        if has_google_primary:
            with_google_primary += 1
        if has_google_any:
            with_google_any += 1

    print("Shelters (uden duplikater):", total)
    print("Med Google-billede som primært (image_url):", with_google_primary)
    print("Med mindst ét Google-billede (image_url eller image_urls):", with_google_any)
    if total:
        print(f"Procent med Google som primært: {100 * with_google_primary / total:.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
