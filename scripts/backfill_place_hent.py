#!/usr/bin/env python3
"""Henter stednavne for shelters uden place. Skriver kun til en fil.

Delt i to trin med vilje. Det eksisterende backfill_kommune_from_geo.py
--refresh-place laver de samme ~560 Nominatim-kald i tørkørsel som i den
rigtige kørsel, saa en gennemgang foer skrivning koster API'et det dobbelte.
Her hentes én gang, resultatet gemmes, og trin to skriver fra filen.

Respekterer Nominatims ene kald i sekundet.

    python3 scripts/backfill_place_hent.py        # henter til /tmp/place_fund.json
"""
import json, os, re, sys, time, urllib.parse, urllib.request

UA = "shelterdk-place-backfill/1.0 (+https://shelterdk.dk)"
UD = "/tmp/place_fund.json"
# Raekkefoelgen er praecisionen: en landsby er et bedre stednavn end en bydel,
# og en bydel bedre end kommunen.
FELTER = ("village", "town", "city", "hamlet", "suburb", "locality")


def hent(lat, lon):
    q = urllib.parse.urlencode({
        "lat": lat, "lon": lon, "format": "json", "zoom": "14", "addressdetails": "1",
    })
    req = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/reverse?{q}", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
    except Exception as e:
        return None, str(e)[:60]
    a = d.get("address", {})
    for f in FELTER:
        v = (a.get(f) or "").strip()
        if v:
            return {"place": v, "felt": f, "fuld": d.get("display_name", "")[:70]}, None
    return None, "intet stednavn i svaret"


def main():
    rows = json.load(open("/tmp/mangler_place.json", encoding="utf-8"))
    print(f"{len(rows)} shelters uden place. Ca. {len(rows)*1.1/60:.0f} minutter.\n")
    fund, fejl = [], []
    for i, s in enumerate(rows, 1):
        m = re.match(r"POINT\(([-\d.]+) ([-\d.]+)\)", s["location"] or "")
        if not m:
            fejl.append({**s, "grund": "ulæselig location"}); continue
        lon, lat = float(m.group(1)), float(m.group(2))
        r, grund = hent(lat, lon)
        if r:
            # Er stednavnet bare kommunen igen, er det ingen oplysning.
            if r["place"].strip().lower() == (s["kommune"] or "").strip().lower():
                fejl.append({**s, "grund": f"stednavn = kommune ({r['place']})"})
            else:
                fund.append({**s, **r})
        else:
            fejl.append({**s, "grund": grund})
        if i % 50 == 0 or i == len(rows):
            print(f"  {i}/{len(rows)} · fundet {len(fund)} · sprunget over {len(fejl)}")
        if i < len(rows):
            time.sleep(1.1)
    json.dump({"fund": fund, "fejl": fejl}, open(UD, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"\nGemt i {UD}: {len(fund)} stednavne, {len(fejl)} sprunget over.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
