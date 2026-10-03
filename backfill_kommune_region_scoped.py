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

# GeoFA-importen 2026-10-03. slug -> (lat, lon)
TARGETS = {
    "kalo-hovedgard-shelter-nr-3-ikke-bookbar-10499": (56.29722, 10.49989),
    "shelter-ved-foreningshus-11978": (55.32893, 11.97888),
    "shelter-ved-poppelvej-88797": (56.74869, 8.87973),
    "shelterplads-ved-skovsoen-i-farvang-97345": (56.26173, 9.73458),
    "udsigtsshelter-ved-albaek-10167": (56.48458, 10.16785),
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
    "791": "Viborg", "540": "Sønderborg", "420": "Assens", "306": "Kalundborg", "316": "Holbæk", "326": "Ringsted",
    "706": "Norddjurs", "320": "Faxe", "779": "Skive", "740": "Silkeborg", "730": "Randers",
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
