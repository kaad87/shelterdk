#!/usr/bin/env python3
"""Taeller brugbare produkter pr. ny kategori i de cachede feeds.

Laeser kun fra disk. Formaalet er at afgoere, OM en guide kan bygges, foer
der bygges noget: en guide kraever 6-8 produkter paa lager, helst fra mere
end én forhandler, saa den ikke doer naar én butik fjerner en vare.

Stoerrelsesvarianter foldes sammen. Fleece og dunjakker kommer som samme
model i otte stoerrelser, og uden foldning ser et sortiment paa ti modeller
ud som firs produkter.
"""
from __future__ import annotations

import collections, glob, gzip, os, re, sys, unicodedata
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "raw", "feeds")

# Navne-moenstre pr. kategori. EXCL fjerner det der ligner, men ikke er:
# en fleecehandske er ikke en fleecetroeje.
KATEGORIER = {
    "fleece": (
        r"\bfleece", r"handske|hue|sok|vante|tæppe|plaid|blanket|hund|baby|bodystocking|halsedisse"),
    "dunjakke": (
        r"\bdun(jakke|vest|frakke|foret)|\bdown\s+(jacket|vest)|primaloft|isolerende jakke",
        r"sovepose|hund|pude|dyne"),
    "multitool": (
        r"multitool|multi-tool|multiværktøj|leatherman|multi tool", r"etui|hylster|slibe"),
    "okse": (
        r"\bøkse|\bøkser\b|\bhatchet|\baxe\b|foldesav|buesav|grensav|handsaw",
        r"etui|hylster|skaft til|blad til|legetøj"),
    "vandrestave": (
        r"vandrestav|trekkingstav|gåstav|trekking pole|hiking pole|nordic walking",
        r"spids|gummi|kurv|reservedel|tilbehør|basket|tip\b"),
    "kikkert": (
        r"\bkikkert|\bbinocular|monokular|\bteleskop", r"mikroskop|lup|stativ|taske|rem|etui|rens"),
}


def felt(p, navn):
    e = p.find(navn)
    return (e.text or "").strip() if e is not None and e.text else ""


def paa_lager(raw: str) -> bool:
    t = raw.strip().lower()
    if t in ("in stock", "in_stock", "på lager", "pa lager"):
        return True
    if t in ("udsolgt", "out of stock", "out_of_stock", ""):
        return False
    try:
        return int(t) > 0
    except ValueError:
        return False


def model(brand: str, navn: str) -> str:
    """Foldenoegle: samme model i otte stoerrelser er ét produkt."""
    s = f"{brand} {navn}".lower()
    s = s.replace("ø", "oe").replace("æ", "ae").replace("å", "aa")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    # Stoerrelser, farver og koen staar typisk til sidst og varierer pr. variant
    s = re.sub(r"\b(xxs|xs|s|m|l|xl|xxl|xxxl|3xl|4xl)\b", " ", s)
    s = re.sub(r"\b(str|size|stoerrelse)\.?\s*\d+\b", " ", s)
    s = re.sub(r"\b\d{2,3}\s*(cm|mm)\b", " ", s)
    s = re.sub(r"\b(herre|dame|unisex|men|women|mens|womens|kids|junior)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def laes(fil):
    with gzip.open(fil, "rb") as fh:
        rod = ET.fromstring(fh.read())
    return rod.findall(".//produkt")


def main() -> int:
    filer = {}
    for f in sorted(glob.glob(os.path.join(CACHE, "*.xml.gz"))):
        noegle = os.path.basename(f).split("_")[0]
        filer[noegle] = f    # seneste vinder, da listen er sorteret

    alle = []
    for noegle, f in filer.items():
        for p in laes(f):
            alle.append({
                "feed": noegle,
                "kat": felt(p, "kategorinavn"),
                "brand": felt(p, "brand"),
                "navn": felt(p, "produktnavn"),
                "pris": felt(p, "nypris"),
                "lager": felt(p, "lagerantal"),
                "billede": felt(p, "billedurl"),
                "besk": felt(p, "beskrivelse"),
            })
    print(f"{len(filer)} feeds laest · {len(alle):,} varer i alt\n".replace(",", "."))

    print(f"{'kategori':14s} {'traef':>6s} {'paa lager':>10s} {'modeller':>9s} {'m/billede':>10s} {'forhandlere'}")
    for kat, (inkl, excl) in KATEGORIER.items():
        ri, re_ = re.compile(inkl, re.I), re.compile(excl, re.I)
        traf = [x for x in alle
                if ri.search(f"{x['navn']} {x['kat']}") and not re_.search(x["navn"])]
        lager = [x for x in traf if paa_lager(x["lager"])]
        modeller = {}
        for x in lager:
            modeller.setdefault(model(x["brand"], x["navn"]), []).append(x)
        m_billede = sum(1 for v in modeller.values() if any(y["billede"] for y in v))
        feeds = collections.Counter(x["feed"] for x in lager)
        print(f"  {kat:12s} {len(traf):6d} {len(lager):10d} {len(modeller):9d} {m_billede:10d}  "
              f"{', '.join(f'{k}:{v}' for k, v in feeds.most_common(3))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
