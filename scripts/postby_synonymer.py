#!/usr/bin/env python3
"""Byg synonymer fra postby til de byer der faktisk har shelters i naerheden.

Problemet: soeger man "Hurup" faar man nul traeffere, selv om der ligger 48
shelters inden for 25 km, det naermeste 4,5 km vaek. Byen findes bare ikke i
vores data, fordi ingen shelter ligger i selve Hurup.

Loesningen bruger den mekanisme der allerede virker: et soegeord der ikke
staar i dataene mappes til dem der goer. SEARCH_SYNONYMS goer det for
landsdele; det her goer det for postbyer.

To ting goer det sikkert:

  1. Kun postbyer der i dag rammer INTET kommer med. En soegning der virker
     kan dermed ikke aendre adfaerd.
  2. Resultatet er en SEPARAT liste med bynavne, ikke en udvidelse af
     SEARCH_SYNONYMS, som bruges som kommune.eq. Dermed roeres de
     eksisterende landsdels-synonymer ikke.

Nominatim kaldes én gang pr. postby, med den ene forespoergsel i sekundet.

    python3 scripts/postby_synonymer.py
"""
import json, math, os, re, sys, time, unicodedata
import urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "shelterdk-postby/1.0 (+https://shelterdk.dk)"
UD = os.path.join(ROOT, "web", "lib", "generated", "postby-synonymer.ts")
# Hvor langt vi regner som "i naerheden". 25 km er en halv times koersel og
# den radius det eksisterende naturophold-modul bruger.
RADIUS_KM = 25
# Flere end det bliver stoej i en resultatliste, og de fjerneste er mindst
# relevante.
MAKS_BYER = 25


def km(a, b, c, d):
    R = 6371.0
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def nøgle(s):
    s = (s or "").lower().strip()
    s = s.replace("ø", "oe").replace("æ", "ae").replace("å", "aa")
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


# Tillaeg i postbynavne der ikke er en del af stednavnet. Nominatim finder
# "7760 Hurup", men ikke "7760 Hurup Thy": tillaegget braekker opslaget, og det
# var grunden til at Hurup manglede helt i foerste udgave.
#
# Listen er lukket med vilje. Et hvilket som helst andet ord ville ogsaa
# fjerne den halvdel af navnet man ikke maa smide vaek: "Hvide Sande",
# "Faxe Ladeplads" og "Broendby Strand" er hele navne.
TILLAEG = {
    "thy", "fyn", "falster", "sjælland", "sjaelland", "j", "jylland", "mors",
    "lolland", "bornholm", "c", "n", "s", "v", "sv", "sø", "soe", "nv", "nø",
    "noe", "øst", "oest", "vest", "nord", "syd",
}


def uden_tillaeg(by: str) -> str:
    """"Hurup Thy" -> "Hurup". Uaendret naar sidste ord hoerer til navnet."""
    dele = by.split()
    if len(dele) > 1 and dele[-1].lower().strip(".") in TILLAEG:
        return " ".join(dele[:-1])
    return by


def geokod(by, postnr):
    q = urllib.parse.urlencode({
        "q": f"{postnr} {by}, Danmark", "format": "json", "limit": "1",
    })
    req = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{q}", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
    except Exception:
        return None
    return (float(d[0]["lat"]), float(d[0]["lon"])) if d else None


CACHE = "/tmp/postby_koordinater.json"


def laes_cache():
    try:
        return json.load(open(CACHE, encoding="utf-8"))
    except Exception:
        return {}


def geokod_med_fald_tilbage(by, postnr):
    """Proev det korte navn foerst: det er det Nominatim kender."""
    kort = uden_tillaeg(by)
    if kort != by:
        r = geokod(kort, postnr)
        if r:
            return r
        time.sleep(1.1)
    return geokod(by, postnr)


def main():
    for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
        if os.path.isfile(p):
            for line in open(p, encoding="utf-8"):
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k, v)
    from supabase import create_client
    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"],
                       os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    src = open(os.path.join(ROOT, "web", "lib", "postnummer.ts"), encoding="utf-8").read()
    postbyer = {}
    for m in re.finditer(r'"(\d{4})":\s*"([^"]+)"', src):
        postbyer.setdefault(m.group(2), m.group(1))

    rows, off = [], 0
    while True:
        b = (sb.table("shelters")
             .select("place,kommune,title,location,duplicate_of_shelter_id")
             .range(off, off + 999).execute().data)
        if not b:
            break
        rows += b
        off += 1000
        if len(b) < 1000:
            break
    ægte = [x for x in rows if not x["duplicate_of_shelter_id"]]

    # Hvad rammer allerede noget? Dem roerer vi ikke.
    places = {nøgle(x["place"]) for x in ægte if x["place"]}
    kommuner = {nøgle(x["kommune"]) for x in ægte if x["kommune"]}
    titler = " | ".join(nøgle(x["title"]) for x in ægte)
    ramt = places | kommuner | {nøgle(t) for t in titler.split(" | ")}
    # Tre byer hedder Nykoebing. Et alias paa den bare form ville pege paa én
    # af dem og tie om de to andre, saa en tvetydig kort form faar intet alias.
    kort_antal = {}
    for b in postbyer:
        k = nøgle(uden_tillaeg(b))
        kort_antal[k] = kort_antal.get(k, 0) + 1
    tvetydige = {k for k, n in kort_antal.items() if n > 1}
    kandidater = [b for b in sorted(postbyer)
                  if nøgle(b) not in places and nøgle(b) not in kommuner
                  and nøgle(b) not in titler]

    punkter = []
    for x in ægte:
        m = re.match(r"POINT\(([-\d.]+) ([-\d.]+)\)", x["location"] or "")
        if m and (x["place"] or "").strip():
            punkter.append((float(m.group(2)), float(m.group(1)), x["place"].strip()))

    print(f"{len(postbyer)} postbyer · {len(kandidater)} rammer intet i dag")
    print(f"{len(punkter)} shelters med baade koordinat og bynavn")
    print(f"Geokoder {len(kandidater)} byer (ca. {len(kandidater) * 1.1 / 60:.0f} min)...\n")

    cache = laes_cache()
    ud, tomme = {}, []
    for i, by in enumerate(kandidater, 1):
        if by in cache:
            pos = tuple(cache[by]) if cache[by] else None
            brugte_api = False
        else:
            pos = geokod_med_fald_tilbage(by, postbyer[by])
            cache[by] = list(pos) if pos else None
            brugte_api = True
        if pos:
            naer = sorted(((km(pos[0], pos[1], la, lo), p) for la, lo, p in punkter),
                          key=lambda t: t[0])
            byer, set_ = [], set()
            for d, p in naer:
                if d > RADIUS_KM or len(byer) >= MAKS_BYER:
                    break
                if p not in set_:
                    set_.add(p)
                    byer.append(p)
            if byer:
                ud[by] = byer
                # Folk skriver "Hurup", ikke "Hurup Thy". Den korte form
                # indekseres ogsaa, men kun naar den ikke i forvejen rammer
                # noget i dataene: ellers ville "Aarhus C" lave et synonym for
                # "Aarhus", som virker fint i forvejen.
                kort = uden_tillaeg(by)
                if kort != by and nøgle(kort) not in ramt and nøgle(kort) not in tvetydige:
                    ud[kort] = byer
            else:
                tomme.append(by)
        else:
            tomme.append(by)
        if i % 40 == 0 or i == len(kandidater):
            print(f"  {i}/{len(kandidater)} · {len(ud)} med naboer")
        if i < len(kandidater) and brugte_api:
            time.sleep(1.1)

    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    os.makedirs(os.path.dirname(UD), exist_ok=True)
    linjer = "\n".join(
        f'  {json.dumps(nøgle(b), ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)},'
        for b, v in sorted(ud.items()))
    with open(UD, "w", encoding="utf-8") as fh:
        fh.write(f'''/**
 * Genereret af scripts/postby_synonymer.py. Ret ikke i haanden.
 *
 * Postbyer der IKKE findes i vores shelter-data, mappet til de bynavne der
 * har shelters inden for {RADIUS_KM} km. Soeger man "Hurup" uden det her, faar
 * man nul traeffere, selv om der ligger shelters 4,5 km vaek.
 *
 * Kun byer der i dag rammer intet er med, saa en soegning der virker ikke kan
 * aendre adfaerd. Noeglerne er normaliserede (oe/ae/aa, smaa bogstaver).
 *
 * Kilde: OpenStreetMap Nominatim (c) OpenStreetMap contributors.
 */
export const POSTBY_SYNONYMER: Record<string, string[]> = {{
{linjer}
}};
''')
    print(f"\nSkrevet: {os.path.relpath(UD, ROOT)}")
    print(f"  {len(ud)} postbyer med naboer · {len(tomme)} uden shelters inden for {RADIUS_KM} km")
    return 0


if __name__ == "__main__":
    sys.exit(main())
