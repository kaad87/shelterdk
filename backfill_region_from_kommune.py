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
     "Mariagerfjord", "Morsø", "Rebild", "Thisted", "Vesthimmerland", "Vesthimmerlands",
     "Aarhus", "Favrskov", "Hedensted", "Herning", "Holstebro", "Horsens",
     "Ikast-Brande", "Lemvig", "Norddjurs", "Odder", "Randers", "Ringkøbing-Skjern",
     "Samsø", "Silkeborg", "Skanderborg", "Skive", "Struer", "Syddjurs", "Viborg",
     "Aabenraa", "Billund", "Esbjerg", "Fanø", "Fredericia", "Haderslev",
     "Kolding", "Sønderborg", "Tønder", "Varde", "Vejle", "Vejen",
     "Skagen", "Hirtshals", "Struer", "Holstebro", "Lemvig", "Ringkøbing",
     "Grenaa", "Kibæk", "Bjerringbro", "Grindsted", "Kollund", "Dalmose", "Hinnerup",
     "Hobro", "Rødding", "Brovst", "Gurre", "Hundelev", "Troldhede", "Vester Nebel",
     "Årslev", "Arden", "Borre", "Brande", "Bække", "Ebeltoft", "Filskov", "Frederiksværk",
     "Gelsted", "Gredstedbro", "Grønbjerg", "Hasle", "Hvide Sande", "Kjellerup", "Kloster",
     "Lisbjerg", "Nordenskov", "Nørre Snede", "Ribe", "Sindal", "Skjern", "Sønder Omme",
     "Tranum", "Aars", "Agerbæk", "Aggersund", "Allingåbro", "Brædstrup", "Buresø",
     "Farsø", "Fasterholt", "Fjaltring", "Gedsted", "Givskud", "Gjern", "Gjerrild",
     "Gråsten", "Hanstholm", "Haslev", "Hirtshals", "Hjallerup", "Hovborg", "Hundested",
     "Hvilsom", "Højer", "Hørning", "Ikast", "Jelling", "Juelsminde", "Karup", "Klejtrup",
     "Klovborg", "Kolind", "Kruså", "Løgstør", "Møldrup", "Nordborg", "Nordby",
     "Nørre Lyngvig", "Ranum", "Rødby", "Rønde", "Saltum", "Sejs", "Sejs-Svejbæk",
     "Skave", "Skjern", "Stauning", "Stenum", "Støvring", "Sunds", "Svenstrup", "Sæby",
     "Sønder Nissum", "Søndersø", "Tarm", "Tejn", "Thyborøn", "Tranebjerg", "Tversted",
     "Ulfborg", "Vemb", "Vestervig", "Vinderup", "Vodskov", "Voel", "Voerladegård", "Voerså",
     "Vrads", "Vridsted", "Ydby", "Ålbæk", "Årre", "Årøsund", "Ødis", "Ørting",
     "Øster Hornum", "Østrup", "Ølgod", "Østervrå",
     "Andrup", "Astrup", "Bedsted Thy", "Birkelse", "Bjerregrav", "Bork Havn", "Branderup",
     "Bruunshåb", "Døstrup", "Erslev", "Grimstrup", "Havnstrup", "Hjordkær", "Hodsager", "Håstrup",
     "Klitmøller", "Mejrup Kirkeby", "Ny Nørup", "Nørholm", "Sig", "Solbjerg", "Stjær", "Store Damme",
     "Sundby Mors", "Sønder Felding", "Sørup", "Tjæreborg", "Tofterup", "Ulstrup", "Vejrup", "Velling",
     "Vemmedrup", "Vester Vedsted", "Vindblæs", "Vorbasse", "Øster Højst", "Øster Jølby",
     "Aabybro", "Aale", "Aalestrup", "Abild", "Agersted", "Alken", "Alsønderup", "Ans", "Ansager",
     "Arnborg", "Aså", "Augustenborg", "Balka", "Balle", "Beder-Malling", "Bevtoft", "Biersted",
     "Bindslev", "Bjergby", "Bjergsted", "Blans", "Blåhøj", "Bonderup", "Borris", "Bredebro",
     "Brunshuse", "Bryrup", "Brødeskov", "Brøndum", "Brøns", "Bur", "Båring", "Bækmarksbro",
     "Christiansfeld", "Dalbyover", "Davinde", "Dronninglund", "Durup", "Egebjerg", "Egernsund",
     "Egeskov", "Engesvang", "Eskilstrup", "Espe", "Faldsled", "Feldborg", "Femmøller", "Ferring",
     "Fjellerup", "Fjelsted", "Fjerritslev", "Flakkebjerg", "Frejlev", "Frøstrup", "Føns", "Gandrup",
     "Gedved", "Genner", "Gjellerodde", "Gjerlev", "Gjesing", "Glesborg", "Glyngøre", "Grænge", "Guderup",
     "Gylling", "Gærum", "Gørding", "Gørlev", "Hadbjerg", "Haderup", "Hadsund", "Hald", "Haldrup",
     "Halvrimmen", "Hammel", "Hammelev", "Harridslev", "Hasmark Strand", "Hatting", "Haverslev",
     "Hejls", "Hejsager Strand", "Hellevad", "Herslev", "Holbøl", "Hoptrup", "Horbelev", "Horslunde",
     "Hou", "Hovedgård", "Husum-Ballum", "Hvalpsund", "Hvissinge", "Hørby", "Hørup", "Idom Kirkeby",
     "Ildved", "Ilskov", "Ingstrup", "Jejsing", "Jernved", "Jerup", "Kagerup", "Karup", "Klemensker",
     "Klokkerholm", "Kokkedal", "Korshavn", "Kragelund", "Kregme", "Kvissel", "Kvong", "Kærbøl", "Kølkær",
     "Laanshøj", "Langå", "Langø", "Lem", "Lemming", "Lundby", "Lyngså", "Lystrup", "Mammen", "Mellerup",
     "Mesing", "Morud", "Mosbjerg", "Møgeltønder", "Nim", "Norup", "Ny Hammersholt", "Ny Tolstrup",
     "Nybøl", "Nykøbing Mors", "Nykøbing Strandhuse", "Næsbjerg", "Nødebohuse", "Nørre Lyngby",
     "Nørre Nebel", "Nørre Vedby", "Oksbøl", "Onsbjerg", "Oue", "Præstbro", "Rask Mølle", "Ravnkilde",
     "Reersø", "Rens", "Rinkenæs", "Roager", "Romalt", "Roslev", "Rudegård", "Rørby", "Sandby",
     "Simmelkær", "Sinding", "Skalbjerg", "Skamby", "Skarrild", "Skelhøje", "Skelund", "Skibbild",
     "Skivum", "Skodborg", "Skovsgård", "Skærbæk", "Skærup", "Skødstrup", "Sommersted", "Sorring",
     "Stakroge", "Stokkemarke", "Store Rørbæk", "Søby", "Sønder Onsild Stationsby", "Sønderup", "Søvang",
     "Tapdrup", "Thorsager", "Thorsø", "Thorup Strand", "Thorøhuse", "Tim", "Torkilstrup", "Tornby",
     "Tornemark", "Torrild", "Tranbjerg", "Tylstrup", "Tørresø", "Ubby", "Udby", "Udbyhøj Vasehuse",
     "Uggelhuse", "Uglev", "Utterslev", "Vaarst", "Vadum", "Valsgård", "Vebbestrup", "Vedsted", "Vegger",
     "Vellerup", "Vemmelev", "Venø By", "Vestenskov", "Vester Hjermitslev", "Vig", "Vils", "Vilsted",
     "Vilsund Vest", "Vinderød", "Vipperød", "Virksund", "Voer")

# Fyn
_add("Fyn",
     "Assens", "Faaborg-Midtfyn", "Faaborg", "Kerteminde", "Langeland",
     "Middelfart", "Nordfyns", "Nordfyn", "Nyborg", "Odense", "Svendborg", "Ærø",
     "Bogense", "Otterup", "Lohals", "Haarby", "Jordløse", "Vester Hæsinge", "Bagenkop",
     "Brejning", "Dalby", "Dybbøl", "Errindlev", "Gelsted", "Holeby", "Knebel", "Marstal",
     "Nørreby", "Ollerup", "Ommel", "Ringe", "Rudkøbing", "Stenstrup", "Tommerup Stationsby",
     "Vissenbjerg", "Ærøskøbing", "Aarup", "Agedrup", "Ejby", "Fraugde", "Glumsø", "Munkebo",
     "Havnebyen", "Mårum", "Nørre Lyndelse", "Refsvindinge", "Skårup", "Strib", "Veflinge")

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
     "Helsingør", "Hillerød", "Næstved", "Slagelse", "Køge", "Holbæk",
     "Dalmose", "Skodsborg", "Frederiksværk", "Gammel Holte", "Gyrstinge", "Humlebæk",
     "Lillerød", "Nexø", "Nødebo", "Rødvig", "Rønninge", "Smørumnedre", "Snekkersten",
     "Snogebæk", "Vallensbæk Landsby", "Værløse", "Faxe Ladeplads", "Gammel Kalvehave",
     "Gedser", "Holeby", "Hunseby", "Kettinge", "Klippinge", "Kulhuse", "Lellinge",
     "Mønsted", "Nørre Alslev", "Rødby", "Stubbekøbing", "Vestermarie",
     "Birkerød", "Farum", "Hedehusene", "Helsinge", "Hørve", "Jyderup", "Jyllinge",
     "Nivå", "Nødebo", "Slangerup", "Solrød Strand", "Sørvad", "Tappernøje", "Ølstykke",
     "Visby", "Øster Kippinge", "Østerby Havn", "Østerlars", "Ørslev",
     "Bårse", "Gadevang", "Rostved", "Sjørup", "Snertinge", "Tofterup", "Svogerslev", "Vålse",
     "Store Fuglede Stationsby", "Strøby", "Strøby Egede", "Undløse", "Vallensved", "Vester Såby",
     "Gammel Tølløse", "Hagested", "Bjæverskov", "Boeslunde", "Græsted", "Gudhjem", "Holtug",
     "Karlebo", "Klemensker", "Kokkedal", "Lendemarke", "Omø By", "Pedersker", "Rø",
     "Skuldelev Strand", "Store Lyngby", "Horslunde")

# Fyn – stednavne der hører til Fyn/Langeland/Ærø (tilføjes så de ikke ender i Jylland)
_add("Fyn",
     "Verninge", "Tranekær", "Dall Villaby")


def kommune_to_landsdel(kommune: Optional[str]) -> Optional[str]:
    if not kommune or not (kommune := (kommune or "").strip()):
        return None
    key = _n(kommune)
    if not key or key in ("danmark", "denmark", "true"):
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
