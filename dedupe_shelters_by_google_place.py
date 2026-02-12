#!/usr/bin/env python3
"""
Deduplicer shelters baseret på Google Places-id.

Ide:
- Alle shelters med samme google_place_id antages at være samme fysiske sted.
- I hver gruppe vælges ét "primært" shelter.
- De øvrige i gruppen får duplicate_of_shelter_id sat til det primære id.

Heuristik for at vælge primær:
- Bonus for booking_url (3 point)
- Bonus for image_url (2 point)
- Bonus for ikke-tom description (1 point)
- Ved lighed: ældste created_at vinder (ellers laveste id)

Kør:
    python3 dedupe_shelters_by_google_place.py

Valgfrit:
    python3 dedupe_shelters_by_google_place.py --dry-run
    (viser hvad der ville blive ændret, uden at skrive til databasen)
"""
import argparse
import os
from datetime import datetime

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")

try:
    from dotenv import load_dotenv

    load_dotenv(_env_path)
except ImportError:
    if os.path.isfile(_env_path):
        with open(_env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())


def _score_shelter(row: dict) -> float:
    """Beregn en simpel score for at vælge primær shelter i en gruppe."""
    score = 0.0
    if (row.get("booking_url") or "").strip():
        score += 3.0
    if (row.get("image_url") or "").strip():
        score += 2.0
    if (row.get("description") or "").strip():
        score += 1.0
    # Lidt bonus hvis der er en kilde-id
    if (row.get("source_id") or "").strip():
        score += 0.5
    return score


def _parse_created_at(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            return None
    return None


def main():
    parser = argparse.ArgumentParser(description="Deduplicer shelters baseret på google_place_id")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Vis kun hvad der ville blive ændret, uden at opdatere databasen",
    )
    args = parser.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return

    from supabase import create_client

    supabase = create_client(url, key)

    # Hent alle shelters med google_place_id (og nødvendige felter for heuristik)
    cols = (
        "id,google_place_id,title,slug,description,booking_url,image_url,"
        "source_id,created_at,duplicate_of_shelter_id"
    )
    resp = supabase.table("shelters").select(cols).neq("google_place_id", None).execute()
    rows = resp.data or []
    if not rows:
        print("Ingen shelters med google_place_id – kør fetch_google_places.py først.")
        return

    # Gruppér efter google_place_id
    groups = {}
    for r in rows:
        pid = (r.get("google_place_id") or "").strip()
        if not pid:
            continue
        groups.setdefault(pid, []).append(r)

    total_groups = 0
    groups_with_dupes = 0
    updates = []

    for pid, group in groups.items():
        total_groups += 1
        if len(group) <= 1:
            continue

        # Vælg primær
        best = None
        best_score = -1.0
        best_created = None
        for r in group:
            sc = _score_shelter(r)
            created = _parse_created_at(r.get("created_at"))
            if best is None:
                best, best_score, best_created = r, sc, created
                continue
            better = False
            if sc > best_score:
                better = True
            elif sc == best_score:
                # Tie-breaker: ældste created_at, ellers laveste id
                if created and best_created and created < best_created:
                    better = True
                elif (created and not best_created) or (
                    (not created and not best_created) and str(r.get("id")) < str(best.get("id"))
                ):
                    better = True
            if better:
                best, best_score, best_created = r, sc, created

        primary_id = best["id"]
        groups_with_dupes += 1

        # Sæt duplicate_of_shelter_id for alle andre i gruppen
        for r in group:
            rid = r["id"]
            if rid == primary_id:
                # Sørg for at primæren ikke er markeret som dublet
                if r.get("duplicate_of_shelter_id"):
                    updates.append({"id": rid, "duplicate_of_shelter_id": None})
                continue
            if r.get("duplicate_of_shelter_id") == primary_id:
                continue  # allerede markeret korrekt
            updates.append({"id": rid, "duplicate_of_shelter_id": primary_id})

        # Kort log per gruppe
        titles = ", ".join((g.get("title") or g.get("slug") or "") for g in group)
        print(f"google_place_id={pid} → primær: {best.get('title') or best.get('slug')}  ({len(group)} shelters: {titles})")

    if not updates:
        print("Ingen dubletter fundet – ingen opdateringer nødvendige.")
        return

    print()
    print(f"Finder {groups_with_dupes} google_place_id-grupper med dubletter.")
    print(f"Vil opdatere {len(updates)} shelter-rækker (sætte duplicate_of_shelter_id).")

    if args.dry_run:
        print("Dry-run: ingen ændringer skrevet til databasen.")
        return

    # Udfør opdateringer en ad gangen (simpelt men robust, da antallet er begrænset)
    for u in updates:
        try:
            supabase.table("shelters").update(
                {"duplicate_of_shelter_id": u["duplicate_of_shelter_id"]}
            ).eq("id", u["id"]).execute()
        except Exception as e:
            print("Fejl ved opdatering af", u["id"], ":", e)

    print("Færdig: duplicate_of_shelter_id er sat for dubletter.")


if __name__ == "__main__":
    main()

