#!/usr/bin/env python3
"""Henter Partner-ads-feeds til disk, med cache.

Partner-ads tillader ét kald pr. feed pr. doegn. Derfor henter dette script
aldrig et feed der allerede ligger i cachen fra i dag, og alt videre arbejde
(kategori-optaelling, produktvalg) laeser fra disk. Bliver et kald afvist,
siges det hoejt frem for at skrive en tom fil hen over en god.

Partner-id'et er ikke en hemmelighed: det staar i hver eneste udgaaende
adresse og allerede haardkodet i web/lib/partner-shelters.ts. Banner- og
feed-id hoerer derfor ogsaa til i koden, saa et nyt feed er én linje i en
diff i stedet for en indstilling i Netlify.

    python3 scripts/feed_hent.py                 # henter dem der mangler
    python3 scripts/feed_hent.py proOutdoor      # kun ét
    python3 scripts/feed_hent.py --status        # hvad ligger i cachen
"""
from __future__ import annotations

import datetime as dt
import gzip
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "raw", "feeds")
PARTNER_ID = "19557"
UA = "shelterdk-feed/1.0 (+https://shelterdk.dk)"

# Kun de feeds vi faktisk skal bruge. Listen er bevidst kort: vi henter
# produkter til seks nye kategorier, ikke et katalog. Se samtalen bag
# beslutningen; de oevrige 35 godkendte programmer er fravalgt, fordi de
# enten kannibaliserer en eksisterende guide eller ligger uden for emnet.
FEEDS = {
    # noegle:            (bannerid, feedid, hvad vi skal bruge derfra)
    "prooutdoor":        ("42818", "523",  "fleece, dunjakke, vandrestave"),
    "outdoornu":         ("96182", "2641", "fleece, vandrestave"),
    "knivsalg":          ("64890", "1290", "multitool, økse, sav"),
    "multitool":         ("72606", "1560", "multitool, økse, sav"),
    "vandrestaven":      ("84264", "2052", "vandrestave"),
    "kikkertsalg":       ("64891", "1291", "kikkert"),
    # Resten af Tier 1 plus de Tier 2 der kan baere en guide. Hentes for at
    # maale, OM de har produktbeskrivelser: uden tekst kan en guide ikke
    # skrives, og det viste sig at vaere den afgoerende forskel mellem
    # forhandlerne, ikke antallet af varer.
    "outdooricentrum":   ("117229", "4361", "uld, fodtøj, stormkøkken, handsker"),
    "soveposesalg":      ("84256", "2051", "sovepose, liggeunderlag, myggenet, lagenpose"),
    "nyttelt":           ("84254", "2050", "telt, tarp, myggenet, pløkker"),
    "lommelygtesalg":    ("47793", "688",  "pandelampe, lygte, lanterne"),
    "pandelampe":        ("36837", "370",  "pandelampe, lygte, lanterne"),
    "koeletaske":        ("64889", "1289", "drikkedunk, termokrus, bestik"),
    "rygsaeksalg":       ("82647", "1991", "rygsæk, drybag"),
    "haengekoejesalg":   ("72505", "1555", "hængekøje"),
    "ravlygter":         ("111912", "3768", "lanterne, drybag"),
    "vinterbaderen":     ("91579", "2395", "håndklæde, poncho"),
    "danishendurance":   ("116769", "4296", "sokker, uldundertøj"),
    "nordichydrate":     ("117269", "4372", "drikkedunk, vandfilter"),
    "nordicjerky":       ("113974", "4000", "frysetørret, snacks"),
    "zeejuu":            ("32915", "266",  "kikkert, optik, lygter"),
    "jernbede":          ("91250", "2378", "bålfad (til /koeb-shelter)"),
    "topoutdoor":        ("117963", "4436", "bål- og grilludstyr"),
}


def sti(noegle: str, dag: dt.date | None = None) -> str:
    dag = dag or dt.date.today()
    return os.path.join(CACHE, f"{noegle}_{dag:%Y%m%d}.xml.gz")


def nyeste(noegle: str) -> tuple[str, dt.date] | None:
    """Den seneste cachede fil for et feed, uanset alder."""
    if not os.path.isdir(CACHE):
        return None
    fundet = []
    for f in os.listdir(CACHE):
        if f.startswith(f"{noegle}_") and f.endswith(".xml.gz"):
            try:
                d = dt.datetime.strptime(f[len(noegle) + 1:-7], "%Y%m%d").date()
                fundet.append((os.path.join(CACHE, f), d))
            except ValueError:
                pass
    return max(fundet, key=lambda t: t[1]) if fundet else None


def hent(noegle: str) -> tuple[bool, str]:
    banner, feed, _ = FEEDS[noegle]
    maal = sti(noegle)
    if os.path.isfile(maal):
        return True, "allerede hentet i dag"

    url = (f"https://www.partner-ads.com/dk/feed_udlaes.php"
           f"?partnerid={PARTNER_ID}&bannerid={banner}&feedid={feed}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = r.read()
    except Exception as e:
        return False, f"kaldet fejlede: {str(e)[:70]}"

    # Et afvist kald svarer tit 200 med en kort HTML- eller fejlside. At skrive
    # den hen over en god cache ville vaere vaerre end ikke at hente.
    if len(data) < 2000 or b"<produkt" not in data.lower():
        return False, f"svarede {len(data)} bytes uden produkter (kvote brugt?)"

    os.makedirs(CACHE, exist_ok=True)
    with gzip.open(maal, "wb") as fh:
        fh.write(data)
    return True, f"hentet, {len(data)/1024/1024:.1f} MB"


def status() -> None:
    print(f"{'feed':16s} {'cachet':12s} {'stoerrelse':>11s}  skal bruges til")
    for k, (_, _, brug) in FEEDS.items():
        n = nyeste(k)
        if n:
            mb = os.path.getsize(n[0]) / 1024 / 1024
            print(f"  {k:14s} {n[1]:%Y-%m-%d}   {mb:8.1f} MB  {brug}")
        else:
            print(f"  {k:14s} {'-':12s} {'-':>11s}  {brug}")


def main() -> int:
    args = [a for a in sys.argv[1:]]
    if "--status" in args:
        status()
        return 0
    noegler = [a for a in args if a in FEEDS] or list(FEEDS)
    print(f"Henter {len(noegler)} feed(s). Partner-ads tillader ét kald pr. feed pr. doegn.\n")
    ok = 0
    for k in noegler:
        godt, besked = hent(k)
        print(f"  {k:14s} {'OK ' if godt else 'NEJ'} {besked}")
        ok += godt
    print(f"\n{ok}/{len(noegler)} tilgaengelige.")
    if ok < len(noegler):
        print("Feeds der fejlede kan proeves igen i morgen; de oevrige er cachet.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
