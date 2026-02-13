#!/usr/bin/env python3
"""
Sæt shelters.region til Jylland, Sjælland eller Fyn ud fra shelters.kommune.

Så "Udforsk efter region" på forsiden og filtrering på /soeg virker.
Kræver: .env med NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.
Kør: python3 backfill_region_from_kommune.py [--dry-run]
"""
import argparse
import os
import re
from typing import Optional

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

# Landsdel: Jylland, Sjælland, Fyn (Øerne er lagt ind under Sjælland)
# Nøgler normaliseres: lowercase, fjern " kommune", " regionskommune", " by"
def _n(s: str) -> str:
    if not s:
        return ""
    t = (s or "").strip().lower()
    t = re.sub(r"\s+(kommune|regionskommune|by)$", "", t, flags=re.I)
    return t.strip()

# Kommune-/bynavn (normaliseret) → landsdel
KOMMUNE_TO_LANDSDEL = {}

def _add(landsdel: str, *names: str) -> None:
    for n in names:
        KOMMUNE_TO_LANDSDEL[_n(n)] = landsdel

# Jylland – Nordjylland, Midtjylland + Jylland-delen af Syddanmark
_add("Jylland",
     "Aalborg", "Brønderslev", "Frederikshavn", "Hjørring", "Jammerbugt", "Læsø",
     "Mariagerfjord", "Morsø", "Rebild", "Thisted", "Vesthimmerland",
     "Aarhus", "Favrskov", "Hedensted", "Herning", "Holstebro", "Horsens",
     "Ikast-Brande", "Lemvig", "Norddjurs", "Odder", "Randers", "Ringkøbing-Skjern",
     "Samsø", "Silkeborg", "Skanderborg", "Skive", "Struer", "Syddjurs", "Viborg",
     "Aabenraa", "Billund", "Esbjerg", "Fanø", "Fredericia", "Haderslev",
     "Kolding", "Sønderborg", "Tønder", "Varde", "Vejle",
     "Skagen", "Hirtshals", "Struer", "Holstebro", "Lemvig", "Ringkøbing")

# Fyn
_add("Fyn",
     "Assens", "Faaborg-Midtfyn", "Faaborg", "Kerteminde", "Langeland",
     "Middelfart", "Nordfyns", "Nordfyn", "Nyborg", "Odense", "Svendborg", "Ærø",
     "Bogense", "Otterup")

# Sjælland – inkl. Bornholm, Lolland, Falster, Møn (tidligere "Øerne") + Region Sjælland + Hovedstaden
_add("Sjælland",
     "Bornholm", "Rønne", "Lolland", "Guldborgsund", "Nakskov", "Maribo",
     "Nykøbing Falster", "Nykøbing", "Stege", "Møn", "Lolland Falster")
_add("Sjælland",
     "Faxe", "Greve", "Holbæk", "Kalundborg", "Køge", "Lejre", "Næstved",
     "Odsherred", "Ringsted", "Slagelse", "Solrød", "Sorø", "Stevns", "Vordingborg",
     "Albertslund", "Allerød", "Ballerup", "Brøndby", "København", "Copenhagen",
     "Dragør", "Egedal", "Fredensborg", "Frederiksberg", "Frederikssund", "Furesø",
     "Gentofte", "Gladsaxe", "Glostrup", "Gribskov", "Halsnæs", "Helsingør",
     "Hillerød", "Høje-Taastrup", "Hørsholm", "Ishøj", "Lyngby-Taarbæk",
     "Rudersdal", "Rødovre", "Tårnby", "Vallensbæk", "Roskilde",
     "Helsingør", "Hillerød", "Næstved", "Slagelse", "Køge", "Holbæk")


def kommune_to_landsdel(kommune: Optional[str]) -> Optional[str]:
    if not kommune or not (kommune := (kommune or "").strip()):
        return None
    key = _n(kommune)
    if not key or key in ("danmark", "denmark"):
        return None
    return KOMMUNE_TO_LANDSDEL.get(key)


def main():
    ap = argparse.ArgumentParser(description="Sæt region fra kommune (Jylland/Sjælland/Fyn)")
    ap.add_argument("--dry-run", action="store_true", help="Vis kun hvad der ville blive opdateret")
    args = ap.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("FEJL: Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return 1

    from supabase import create_client
    supabase = create_client(url, key)

    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        r = supabase.table("shelters").select("id, title, kommune, region").range(offset, offset + page_size - 1).execute()
        chunk = r.data or []
        all_rows.extend(chunk)
        if len(chunk) < page_size:
            break
        offset += page_size

    to_update = []
    for row in all_rows:
        kommune = (row.get("kommune") or "").strip()
        landsdel = kommune_to_landsdel(kommune)
        if not landsdel:
            continue
        current = (row.get("region") or "").strip()
        if current == landsdel:
            continue
        to_update.append({
            "id": row["id"],
            "title": (row.get("title") or "")[:45],
            "kommune": kommune,
            "region": landsdel,
        })

    print(f"Shelters i DB: {len(all_rows)}. Opdaterer region for {len(to_update)} shelter(s).")
    if not to_update:
        print("Ingen at opdatere (alle har allerede korrekt region eller ukendt kommune).")
        return 0

    if args.dry_run:
        print("(dry-run – ingen opdateringer)")
    for u in to_update:
        if not args.dry_run:
            supabase.table("shelters").update({"region": u["region"]}).eq("id", u["id"]).execute()
        print(f"  {u['kommune']} → {u['region']}  ({u['title']}…)")

    print(f"Færdig. Opdateret {len(to_update)} shelter(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
