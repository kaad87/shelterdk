#!/usr/bin/env python3
"""Create nature_stays rows from pasted Booking links plus a point.

The workflow this serves: you have found places on Booking and want them on the
map. A Booking address gives us the canonical URL, the property name and the
affiliate link. It does NOT give coordinates, and we do not fetch anything from
Booking, so the point has to come with it.

Input is a block of text, one place per line, liberal about order and format:

    https://www.booking.com/hotel/dk/shelter-i-sansehave.en-gb.html  55.924147, 12.296374
    55.9241,12.2964 https://www.booking.com/hotel/dk/x.da.html | glamping | 1200
    https://www.booking.com/hotel/dk/y.html https://www.google.com/maps/@55.9,12.2,15z

Anything after the URL and the point, separated by | , is read as type and then
price per night. Both optional; type defaults to DEFAULT_TYPE.

    python3 scripts/booking_stays_add.py steder.txt           # dry run
    python3 scripts/booking_stays_add.py steder.txt --apply   # write
    pbpaste | python3 scripts/booking_stays_add.py -          # straight from the clipboard

Rows are created with status='draft'. Nothing shows anywhere until it is
published in admin, which is also where text and images are added.
"""
from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from collections import Counter

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from paid_stays_import import client, ryd_booking_url, slugify  # noqa: E402

# Their Booking examples are all single rental shelters, which is what this
# type was made for. Override per line when it is something else.
DEFAULT_TYPE = "luksus_shelter"

# Denmark's rough extent, including Bornholm. Used to catch swapped pairs.
DK = (54.4, 57.9, 7.8, 15.3)


def i_danmark(lat: float, lng: float) -> bool:
    return DK[0] <= lat <= DK[1] and DK[2] <= lng <= DK[3]


def laes_punkt(tekst: str) -> tuple[float, float, bool] | None:
    """Find a coordinate pair in free text. Returns (lat, lng, swapped)."""
    # A Google Maps address: /@lat,lng,zoom or !3dlat!4dlng
    m = re.search(r"[@/](-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)", tekst) \
        or re.search(r"!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)", tekst)
    if not m:
        # A bare pair. A decimal point is required in both, so "2, 3" in a
        # note is not read as a place; the number of decimals is not, because
        # Google gives seven but a person may type two.
        m = re.search(r"(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)", tekst)
    if not m:
        return None
    a, b = float(m.group(1)), float(m.group(2))
    if abs(a) > 90 or (not i_danmark(a, b) and i_danmark(b, a)):
        return b, a, True
    return a, b, False


def navn_fra_slug(slug: str) -> str:
    """Mirrors navnFraSlug in web/lib/booking-url.ts."""
    ord_ = [o for o in slug.split("-") if o]
    if not ord_:
        return ""
    paen = [o.upper() if len(o) <= 4 and not re.search(r"[aeiouyæøå]", o, re.I) else o.lower()
            for o in ord_]
    f = paen[0]
    return " ".join([f if f.isupper() else f[0].upper() + f[1:], *paen[1:]])


def booking_slug(url: str) -> str | None:
    m = re.search(r"/hotel/[a-z]{2}/([^/?]+?)\.(?:[a-z]{2}(?:-[a-z]{2})?\.)?html", url, re.I)
    return m.group(1) if m else None


def laes_linje(linje: str) -> dict | None:
    """One line to one row, or a reason it could not be read."""
    linje = linje.strip()
    if not linje or linje.startswith("#"):
        return None

    url_m = re.search(r"https?://(?:www\.|secure\.)?booking\.com/\S+", linje)
    cj_m = re.search(r"https?://\S*/click-\d+-\d+\?\S+", linje)
    raa = url_m.group(0) if url_m else (cj_m.group(0) if cj_m else None)
    if not raa:
        return {"fejl": "ingen Booking-adresse", "linje": linje}

    kanonisk = ryd_booking_url(raa)
    slug = booking_slug(kanonisk)
    if not slug:
        return {"fejl": "kunne ikke laese property-slug", "linje": linje}

    # The point must not be looked for inside the Booking URL itself: its slug
    # can contain digits that look like a pair.
    rest = linje.replace(raa, " ")
    punkt = laes_punkt(rest)
    if not punkt:
        return {"fejl": "ingen koordinater paa linjen", "linje": linje, "slug": slug}
    lat, lng, byttet = punkt

    felter = [d.strip() for d in rest.split("|")[1:]]
    type_ = felter[0] if felter and felter[0] else DEFAULT_TYPE
    pris = None
    if len(felter) > 1 and felter[1]:
        p = re.search(r"\d+", felter[1])
        pris = int(p.group(0)) if p else None

    return {
        "slug": slugify(navn_fra_slug(slug)),
        "booking_slug": slug,
        "name": navn_fra_slug(slug),
        "type": type_,
        "location": f"POINT({lng} {lat})",
        "booking_url": kanonisk,
        "link_source": "booking_com",
        "price_from": pris,
        "status": "draft",
        "amenities": {"kilde": "booking.com (manuelt)", "booking_slug": slug},
        "_byttet": byttet,
        "_udenfor": not i_danmark(lat, lng),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("fil", help="tekstfil med én linje pr. sted, eller - for stdin")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    tekst = sys.stdin.read() if a.fil == "-" else open(a.fil, encoding="utf-8").read()
    laest = [laes_linje(l) for l in tekst.splitlines()]
    raekker = [r for r in laest if r and "fejl" not in r]
    fejl = [r for r in laest if r and "fejl" in r]

    sb = client()
    findes = set()
    start = 0
    while True:
        b = sb.table("nature_stays").select("slug").range(start, start + 999).execute().data
        if not b:
            break
        findes.update(x["slug"] for x in b)
        start += 1000
        if len(b) < 1000:
            break

    nye, dubletter = [], []
    for r in raekker:
        (dubletter if r["slug"] in findes else nye).append(r)

    print("=" * 66)
    print("BOOKING-STEDER" + ("" if a.apply else "  (TOERKOERSEL)"))
    print("=" * 66)
    print(f"  Linjer laest                    {len([l for l in tekst.splitlines() if l.strip()]):6d}")
    print(f"  Klar til indsaettelse           {len(nye):6d}")
    print(f"  Findes allerede                 {len(dubletter):6d}")
    print(f"  Kunne ikke laeses               {len(fejl):6d}")
    if nye:
        print("\n  Bliver oprettet:")
        for r in nye:
            flag = ""
            if r.pop("_byttet"):
                flag += "  [koordinater byttet om]"
            if r.pop("_udenfor"):
                flag += "  [uden for Danmark]"
            print(f"    {r['name'][:38]:38s} {r['type']:16s} {r['location']}{flag}")
    for r in dubletter:
        r.pop("_byttet", None)
        r.pop("_udenfor", None)
        print(f"    findes: {r['name']}")
    if fejl:
        print("\n  Kunne ikke laeses:")
        for r in fejl:
            print(f"    {r['fejl']}: {r['linje'][:70]}")

    if not a.apply:
        print("\n  Intet skrevet. Koer med --apply.")
        return 0
    if not nye:
        print("\n  Intet nyt at skrive.")
        return 0

    res = sb.table("nature_stays").insert(nye).execute()
    print(f"\n  {len(res.data or [])} oprettet som draft.")
    print("  De vises ingen steder, foer status saettes til published i admin,")
    print("  som ogsaa er hvor tekst og billeder tilfoejes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
