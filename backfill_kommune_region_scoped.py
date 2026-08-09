"""
SCOPED kommune+region-backfill — KUN for de shelters der står i TARGETS.

Hvorfor et separat script: `backfill_kommune_from_geo.py` og
`backfill_region_from_kommune.py` rammer ALLE rækker med manglende kommune/region.
Der ligger 61 eksisterende shelters med kommune=null og 65 med region='Danmark'
som bevidst skal stå urørt. Kør derfor ALDRIG dem direkte efter en import.

Importeren sætter region='Danmark' fast og efterlader kommune=null, så uden dette
trin havner de nye shelters i noindex-siloen /danmark/danmark.

Koordinaterne står eksplicit her (ikke slået op via PostGIS), så det er
revisérbart præcis hvilke punkter der reverse-geocodes — samme princip som
NEW_SLUGS i enrich-scriptet.

Brug:  python3 backfill_kommune_region_scoped.py           # tørkørsel
       python3 backfill_kommune_region_scoped.py --apply   # skriver
"""
import os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supabase import create_client
from backfill_kommune_from_geo import reverse_geocode
from backfill_region_from_kommune import kommune_to_landsdel

# GeoFA-importen 2026-08-08. slug -> (lat, lon)
TARGETS = {
    "sohoj-telt-og-shelterplads-11910": (55.61915, 11.91055),
    "vorgod-primitive-lejrplads-engtoften-19-6920-videbaek-87087": (56.08807, 8.70875),
    "vorgod-primitive-lejrplads-engtoften-19-6920-videbaek-87091": (56.08802, 8.70919),
    "st-jyndevad-shelterplads-en-del-af-alandet-91501": (54.90028, 9.15012),
    "hevring-shelter-10394": (56.51572, 10.39402),
    "mejerivej-3-gredsted-6771-gredstedbro-87548": (55.40874, 8.75486),
    "to-2-mands-shelter-ved-bjorno-vingard-10238": (55.06513, 10.23878),
    "shelter-ved-abildhede-87309": (55.66226, 8.73095),
    "shelter-i-larsens-skov-86609": (55.57674, 8.66100),
    "granada-skoven-94375": (56.46438, 9.43754),
    "shelter-bogense-havn-10076": (55.56878, 10.07683),
}

# Kanoniske regionsnavne i DB: Jylland (1086), Sjælland og Øerne (406), Fyn (181),
# Bornholm (35). `kommune_to_landsdel` returnerer "Sjælland", som IKKE er kanonisk
# — de 35 eksisterende rækker med den værdi 301-redirecter. Nye må ikke havne der.
REGION_KANONISK = {"Sjælland": "Sjælland og Øerne", "Fyn og Øerne": "Fyn"}
BORNHOLM_KOMMUNER = {"bornholm", "rønne", "ronne", "allinge", "nexø", "nexo",
                     "aakirkeby", "gudhjem", "svaneke"}

# Officielle kommunekoder — bruges KUN som krydstjek af Nominatims svar, aldrig
# som kilde. Reverse geocoding kan ramme forkert tæt på kommunegrænser.
KODE_TIL_KOMMUNE = {
    "350": "Lejre", "430": "Faaborg-Midtfyn", "480": "Nordfyns", "561": "Esbjerg",
    "573": "Varde", "580": "Aabenraa", "707": "Norddjurs", "760": "Ringkøbing-Skjern",
    "791": "Viborg", "306": "Kalundborg", "316": "Holbæk", "326": "Ringsted",
}


def kanoniser(region, kommune):
    if kommune and kommune.strip().lower() in BORNHOLM_KOMMUNER:
        return "Bornholm"
    return REGION_KANONISK.get(region, region)


def main():
    apply = "--apply" in sys.argv
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    assert url and key, "Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    sb = create_client(url, key)

    rows = (sb.table("shelters")
            .select("id,slug,title,region,kommune,place,geofa_raw")
            .in_("slug", list(TARGETS))
            .execute().data or [])

    print(f"{'SKRIVER' if apply else 'TØRKØRSEL (intet skrives)'} — {len(rows)}/{len(TARGETS)} rækker i scope\n")
    if len(rows) != len(TARGETS):
        print("  ADVARSEL: antal matcher ikke — stopper.")
        sys.exit(1)

    updates, mismatches, mangler = [], 0, 0

    for r in sorted(rows, key=lambda x: x["slug"]):
        lat, lon = TARGETS[r["slug"]]
        place, kommune = reverse_geocode(lat, lon)
        time.sleep(1.1)  # Nominatim: maks 1 kald/sekund

        kode = str((r.get("geofa_raw") or {}).get("beliggenhedskommune") or "").strip()
        forventet = KODE_TIL_KOMMUNE.get(kode)

        region = kanoniser(kommune_to_landsdel(kommune), kommune)

        flag = ""
        if not kommune or not region:
            flag = "  ← MANGLER, springes over"
            mangler += 1
        elif forventet and kommune.strip().lower() != forventet.lower():
            flag = f"  ← AFVIGER fra kommunekode {kode} ({forventet})"
            mismatches += 1

        print(f"  · {r['title'][:50]}")
        print(f"      kommune : {kommune!r}  (geofa-kode {kode} = {forventet}){flag}")
        print(f"      region  : {region!r}   place: {place!r}")

        if kommune and region:
            patch = {"kommune": kommune, "region": region}
            if place:
                patch["place"] = place
            updates.append((r["id"], r["slug"], patch))

    print("\n" + "=" * 62)
    print(f"  klar til opdatering : {len(updates)}")
    print(f"  afviger fra kode    : {mismatches}")
    print(f"  mangler data        : {mangler}")
    print("=" * 62)

    if not apply:
        print("\nTørkørsel — kør med --apply for at skrive.")
        return

    for sid, slug, patch in updates:
        sb.table("shelters").update(patch).eq("id", sid).execute()
        print(f"  [OK] {slug} → {patch['region']} / {patch['kommune']}")
    print(f"\nOpdateret {len(updates)} rækker (kun de nye).")


if __name__ == "__main__":
    main()
