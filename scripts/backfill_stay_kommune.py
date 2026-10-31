#!/usr/bin/env python3
"""Udfyld nature_stays.kommune, .region og .place ud fra location.

De 15 steder blev importeret med koordinater, men uden kommune, region eller
stednavn. StayCard viser netop "<place>, <region>", saa et sted uden dem siger
ingenting om hvor i landet det ligger.

Kommune og stednavn kommer fra Nominatim reverse (zoom=14), samme kilde og
samme brugspolitik som scripts/backfill-municipality.js: identificerbar
User-Agent og mindst et sekund mellem kaldene.

Region udledes IKKE af Nominatim. Nominatim svarer "Region Midtjylland", mens
sitet bruger en landsdels-inddeling (Jylland, Fyn, Sjaelland og Oeerne,
Bornholm). Kortlaegningen kommer derfor fra shelters-tabellen, hvor de 1830
eksisterende raekker allerede baerer den inddeling, du selv har valgt.

Kor:  python3 -I scripts/backfill_stay_kommune.py [--skriv]
      Uden --skriv vises kun hvad der ville blive aendret.
"""
import http.client
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

NOMINATIM = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "shelterdk-backfill/1.0 (https://shelterdk.dk)"
DELAY_S = 1.1
# region="Danmark" staar paa 65 shelters og er en kendt faldgrube: den betyder
# "ukendt landsdel" og maa ikke smitte af paa nye raekker.
UBRUGELIG_REGION = {"Danmark", ""}


def hent_env(sti: str) -> dict:
    ud = {}
    with open(sti, encoding="utf-8") as f:
        for linje in f:
            t = linje.strip()
            if not t or t.startswith("#") or "=" not in t:
                continue
            k, v = t.split("=", 1)
            ud[k.strip()] = v.strip().strip('"').strip("'")
    return ud


class Db:
    def __init__(self, url: str, key: str):
        self.host = urllib.parse.urlparse(url).netloc
        self.key = key

    def _kald(self, metode: str, sti: str, krop=None):
        c = http.client.HTTPSConnection(self.host, timeout=90)
        h = {"apikey": self.key, "Authorization": "Bearer " + self.key, "Accept": "application/json"}
        if krop is not None:
            h["Content-Type"] = "application/json"
        c.request(metode, sti, body=json.dumps(krop) if krop is not None else None, headers=h)
        r = c.getresponse()
        b = r.read().decode("utf-8")
        c.close()
        if r.status >= 300:
            raise SystemExit("%s %s -> %s %s" % (metode, sti, r.status, b[:300]))
        return json.loads(b) if b.strip() else []

    def hent_alle(self, sti: str):
        ud = []
        fra = 0
        while True:
            c = http.client.HTTPSConnection(self.host, timeout=90)
            c.request("GET", sti, headers={
                "apikey": self.key, "Authorization": "Bearer " + self.key,
                "Accept": "application/json", "Range": "%d-%d" % (fra, fra + 999),
            })
            r = c.getresponse()
            d = json.loads(r.read().decode("utf-8"))
            c.close()
            ud += d
            if len(d) < 1000:
                return ud
            fra += 1000

    def patch(self, sti: str, krop: dict):
        return self._kald("PATCH", sti, krop)


def punkt(wkt: str):
    """'POINT(lng lat)' -> (lng, lat)."""
    if not wkt:
        return None
    t = wkt.strip().upper()
    if not t.startswith("POINT"):
        return None
    try:
        lng, lat = t[t.index("(") + 1:t.index(")")].split()
        return float(lng), float(lat)
    except Exception:
        return None


def reverse(lng: float, lat: float):
    u = "%s?lat=%s&lon=%s&format=jsonv2&addressdetails=1&zoom=14&accept-language=da" % (
        NOMINATIM, urllib.parse.quote(str(lat)), urllib.parse.quote(str(lng)))
    req = urllib.request.Request(u, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.loads(r.read().decode("utf-8"))
    a = d.get("address") or {}
    kommune = a.get("municipality") or a.get("city") or a.get("county")
    if isinstance(kommune, str):
        # Nominatim svarer "Hedensted Kommune"; tabellen baerer bare navnet.
        kommune = kommune.strip()
        if kommune.lower().endswith(" kommune"):
            kommune = kommune[: -len(" kommune")].strip()
    # Stednavnet: den mindste bebyggelse der er oplyst.
    sted = next((a[k] for k in ("village", "town", "hamlet", "suburb", "city") if a.get(k)), None)
    return kommune or None, (sted.strip() if isinstance(sted, str) else None)


def main() -> None:
    skriv = "--skriv" in sys.argv
    rod = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = hent_env(os.path.join(rod, "web", ".env.local"))
    db = Db(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])

    # Kommune -> landsdel, laest af dine egne shelters.
    pr = defaultdict(Counter)
    for s in db.hent_alle("/rest/v1/shelters?select=municipality,region"):
        k, r = (s.get("municipality") or "").strip(), (s.get("region") or "").strip()
        if k and r not in UBRUGELIG_REGION:
            pr[k][r] += 1
    kommune_region = {k: c.most_common(1)[0][0] for k, c in pr.items()}
    print("kortlaegning fra shelters: %d kommuner" % len(kommune_region))

    steder = db.hent_alle(
        "/rest/v1/nature_stays?select=id,slug,name,location,kommune,region,place&order=id.asc")
    mangler = [s for s in steder if not (s["kommune"] and s["region"] and s["place"])]
    print("steder i alt: %d   mangler kommune/region/sted: %d" % (len(steder), len(mangler)))
    print()

    rettet = sprunget = 0
    for i, s in enumerate(mangler):
        p = punkt(s["location"])
        if not p:
            print("  %-4s %-34s INGEN KOORDINAT" % (s["id"], s["name"][:34]))
            sprunget += 1
            continue
        if i:
            time.sleep(DELAY_S)  # Nominatims brugspolitik: maks. ét kald i sekundet.
        try:
            kommune, sted = reverse(*p)
        except Exception as e:
            print("  %-4s %-34s OPSLAG FEJLEDE: %s" % (s["id"], s["name"][:34], e))
            sprunget += 1
            continue
        region = kommune_region.get(kommune) if kommune else None
        ny = {}
        if kommune and not s["kommune"]:
            ny["kommune"] = kommune
        if region and not s["region"]:
            ny["region"] = region
        if sted and not s["place"]:
            ny["place"] = sted
        print("  %-4s %-34s %-16s %-18s %s" % (
            s["id"], s["name"][:34], kommune or "?", region or "? (ukendt kommune)", sted or "?"))
        if not ny:
            sprunget += 1
            continue
        if skriv:
            db.patch("/rest/v1/nature_stays?id=eq.%d" % s["id"], ny)
            rettet += 1

    print()
    print("TOERKOERSEL, intet skrevet" if not skriv else "opdaterede %d steder" % rettet)
    if sprunget:
        print("sprunget over: %d" % sprunget)


main()
