#!/usr/bin/env python3
"""
Vis overblik over shelters der har Google-rating, og om ratingen vises på sitet.

Kør: python3 list_shelters_with_ratings.py

Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.
"""
import os
import sys

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")
try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
except ImportError:
    pass
if os.path.isfile(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if not url or not key:
    print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
    sys.exit(1)

from supabase import create_client
supabase = create_client(url, key)


def is_shelter_place(place_name):
    """Vises på sitet kun når google_stednavn indeholder 'shelter'."""
    if not place_name or not isinstance(place_name, str):
        return False
    return "shelter" in place_name.lower().strip()


def main():
    # Shelters med rating eller place_id; brug google_place_name fra shelters (eller join)
    r = supabase.table("shelters").select(
        "id, title, slug, google_place_id, google_place_name, google_rating, google_user_ratings_total"
    ).or_("google_rating.not.is.null,google_place_id.not.is.null").execute()

    shelters = r.data or []
    if not shelters:
        print("Ingen shelters har google_rating eller google_place_id sat.")
        return

    # Hvis google_place_name mangler, hent fra google_places
    place_ids = {s["google_place_id"] for s in shelters if s.get("google_place_id")}
    places = {}
    if place_ids:
        r2 = supabase.table("google_places").select("google_place_id, name").in_(
            "google_place_id", list(place_ids)
        ).execute()
        for row in (r2.data or []):
            places[row["google_place_id"]] = row.get("name")

    print(f"\n{'Shelter':<50} {'Rating':<8} {'Antal':<8} {'Google-sted':<35} {'Vises (shelter)':<14}")
    print("-" * 120)

    with_rating_shown = 0
    with_rating_hidden = 0

    for s in sorted(shelters, key=lambda x: (x.get("google_user_ratings_total") or 0, x.get("google_rating") or 0), reverse=True):
        title = (s.get("title") or "")[:48]
        rating = s.get("google_rating")
        total = s.get("google_user_ratings_total")
        place_name = s.get("google_place_name") or (places.get(s.get("google_place_id")) if s.get("google_place_id") else None)

        show = rating is not None and is_shelter_place(place_name)
        if show:
            with_rating_shown += 1
        elif rating is not None:
            with_rating_hidden += 1

        rating_str = f"{rating:.1f}" if rating is not None else "–"
        total_str = str(total) if total is not None else "–"
        place_str = (place_name or "–")[:33]
        vises = "Ja" if show else "Nej"
        print(f"{title:<50} {rating_str:<8} {total_str:<8} {place_str:<35} {vises:<14}")

    print("-" * 120)
    print(f"\nI alt: {len(shelters)} shelters med rating/place_id.")
    print(f"  – Vises på sitet (stednavn indeholder 'shelter'): {with_rating_shown}")
    print(f"  – Skjult (stednavn uden 'shelter'):               {with_rating_hidden}")
    print()


if __name__ == "__main__":
    main()
