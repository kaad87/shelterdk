#!/usr/bin/env python3
"""Hvad kan vi faktisk bygge en guide af? Optaelling paa tvaers af feeds.

Taeller kun produkter der er PAA LAGER og har en BRUGBAR BESKRIVELSE. Begge
dele er noedvendige: uden lager kan varen ikke koebes, og uden tekst kan
guiden ikke skrives uden at finde paa indhold. Elleve af de 22 feeds leverer
ingen beskrivelser overhovedet, og det er den afgoerende forskel, ikke
antallet af varer.

Stoerrelsesvarianter foldes sammen paa maerke plus normaliseret navn: samme
jakke i otte stoerrelser er ét produkt, ikke otte.

    python3 scripts/feed_inventar.py            # kendte kategorier
    python3 scripts/feed_inventar.py --nye      # find uudnyttede klynger
"""
from __future__ import annotations
import collections, glob, gzip, os, re, sys, unicodedata
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "raw", "feeds")
MINDSTE_TEKST = 40


def felt(p, n):
    e = p.find(n)
    return (e.text or "").strip() if e is not None and e.text else ""


def ren(d):
    return re.sub(r"\s+", " ", re.sub(r"\[[a-z_]+[^\]]*\]", " ", d or "")).strip()


def paa_lager(raw):
    t = (raw or "").strip().lower()
    if t in ("in stock", "in_stock", "på lager", "pa lager"):
        return True
    if t in ("", "udsolgt", "out of stock", "out_of_stock"):
        return False
    try:
        return int(t) > 0
    except ValueError:
        return False


def model(brand, navn):
    s = f"{brand or ''} {navn}".lower()
    s = s.replace("ø", "oe").replace("æ", "ae").replace("å", "aa")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\b(xxs|xs|s|m|l|xl|xxl|xxxl|3xl|4xl)\b", " ", s)
    s = re.sub(r"\b(str|size)\.?\s*\d+\b", " ", s)
    s = re.sub(r"\b(herre|dame|unisex|men|women|mens|womens|kids|junior|barn|børn)\b", " ", s)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s)).strip()


def indlaes():
    filer = {}
    for f in sorted(glob.glob(os.path.join(CACHE, "*.xml.gz"))):
        filer[os.path.basename(f).split("_")[0]] = f
    ud = []
    for k, f in filer.items():
        with gzip.open(f, "rb") as fh:
            rod = ET.fromstring(fh.read())
        for p in rod.findall(".//produkt"):
            besk = ren(felt(p, "beskrivelse"))
            if len(besk) < MINDSTE_TEKST or not paa_lager(felt(p, "lagerantal")):
                continue
            try:
                pris = float((felt(p, "nypris") or "0").replace(",", "."))
            except ValueError:
                pris = 0.0
            ud.append({"feed": k, "kat": felt(p, "kategorinavn"), "brand": felt(p, "brand"),
                       "navn": felt(p, "produktnavn"), "pris": pris, "besk": besk})
    return ud


# Kategorier vi har overvejet. (inkluder, udeluk)
KENDTE = {
    "fleece":        (r"\bfleece", r"handske|hue|sok|vante|tæppe|plaid|hund|baby"),
    "dunjakke":      (r"\bdun(jakke|vest|frakke)|down jacket|primaloft|isolerings?jakke",
                      r"sovepose|pude|dyne|hund"),
    "kikkert":       (r"\bkikkert|binocular|monokular", r"mikroskop|\blup\b|stativ|taske|rem|rens"),
    "multitool":     (r"multitool|multiværktøj|leatherman|multi-tool", r"etui|hylster|slibe"),
    "økse/sav":      (r"\bøkse|\bøkser\b|hatchet|foldesav|buesav|grensav", r"etui|skaft til|blad til"),
    "vandrestav":    (r"vandrestav|trekkingstav|gåstav|trekking pole|walking pole",
                      r"spids|gummi|kurv|reservedel|tilbehør|\btip\b|paws"),
    "badeponcho":    (r"badeponcho|skiftekåbe|badekåbe|changing robe", r"hund"),
    "bålfad":        (r"bålfad|bålring|bålsted|fire pit|bålpande", r"hund|rist til"),
    "sokker":        (r"\bsokke?r?\b|\bstrømpe", r"hund|lagen"),
    "softshell":     (r"softshell", r"handske|hund"),
    "vinterstøvle":  (r"vinterstøvle|vintersko|snowboot", r"hund|barn"),
    "dagsrygsæk":    (r"dagsrygsæk|dagstursrygsæk|daypack", r"hund"),
}


def kendte(varer):
    print(f"{'kategori':14s} {'modeller':>9s} {'<400kr':>7s}  feeds (modeller)")
    print("  " + "-" * 74)
    for navn, (i, e) in KENDTE.items():
        ri, re_ = re.compile(i, re.I), re.compile(e, re.I)
        t = [x for x in varer if ri.search(f"{x['navn']} {x['kat']}") and not re_.search(x["navn"])]
        mod = {}
        for x in t:
            mod.setdefault(model(x["brand"], x["navn"]), x)
        billig = sum(1 for x in mod.values() if 0 < x["pris"] < 400)
        pr = collections.Counter(x["feed"] for x in mod.values())
        nok = "JA " if len(mod) >= 8 else "nej"
        print(f"  {navn:12s} {len(mod):9d} {billig:7d}  {nok} "
              f"{', '.join(f'{k}:{v}' for k, v in pr.most_common(3))}")


def nye(varer, eksisterende):
    """Feedenes egne kategorinavne, grupperet, minus det vi allerede daekker."""
    pr = collections.defaultdict(dict)
    for x in varer:
        k = (x["kat"] or "").strip()
        if not k:
            continue
        pr[k][model(x["brand"], x["navn"])] = x
    rang = sorted(((len(v), k, v) for k, v in pr.items()), reverse=True)
    print(f"{'feedets kategorinavn':42s} {'modeller':>9s} {'median kr':>10s}  feeds")
    print("  " + "-" * 80)
    vist = 0
    for n, k, v in rang:
        if n < 8:
            continue
        if any(e in k.lower() for e in eksisterende):
            continue
        priser = sorted(x["pris"] for x in v.values() if x["pris"] > 0)
        med = priser[len(priser) // 2] if priser else 0
        f = collections.Counter(x["feed"] for x in v.values())
        print(f"  {k[:42]:42s} {n:9d} {med:10.0f}  {', '.join(list(f)[:2])}")
        vist += 1
        if vist >= 40:
            break


def main():
    varer = indlaes()
    print(f"{len(varer):,} varer paa lager MED beskrivelse i de cachede feeds\n".replace(",", "."))
    if "--nye" in sys.argv:
        # Ord fra de 39 guider vi allerede har, saa de ikke foreslaas igen.
        daekket = ["sovepose", "telt", "tarp", "liggeunderlag", "pandelampe", "lygte", "lanterne",
                   "kniv", "kompas", "rygsæk", "rygsaek", "drikke", "vandfilter", "stormkøkken",
                   "bestik", "myggenet", "hængekøje", "haengekoeje", "regntøj", "uld", "sok",
                   "handske", "hue", "gamache", "støvle", "stovle", "sko", "campingstol",
                   "første", "foerste", "håndklæde", "powerbank", "dry bag", "drybag",
                   "siddeunderlag", "frysetør", "pude"]
        nye(varer, daekket)
    else:
        kendte(varer)
    return 0


if __name__ == "__main__":
    sys.exit(main())
