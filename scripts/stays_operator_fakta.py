#!/usr/bin/env python3
"""Skriv de fakta operatoererne selv oplyser paa deres EGNE sider.

De 15 naturophold blev importeret fra Booking.com-opslag med kun navn, URL og
koordinat. Billeder, beskrivelser og priser findes kun der, og den kilde er
udelukket. Research af operatoerernes egne sider gav fire traef:

  914 Green Glamping            -> ronhave.eu (Roenhave, Soenderborg)
  918 Luxury Tiny House 2nd Row -> tinyseaside.dk (Loddenhoej)
  919 Tiny Seaside              -> tinyseaside.dk (Kegnaes)
  920 Tiny Seaside Skarrev      -> tinyseaside.dk (Skarrev)

Tiny SeaSides egen side oplyser netop tre anlaeg, Kegnaes, Skarrev og
Loddenhoej, og de tre adresser matcher de tre raekkers koordinater og
stednavne. Derfor kan de tre Booking-opslag knyttes til operatoeren uden gaet.

De oevrige elleve findes ikke under eget navn: resten af soegetraefene er
bookingspejle (tripadvisor, agoda, bedandbreakfast.eu, campanyon), som ikke er
operatoerens ord og derfor ikke en kilde her.

Hvert sted faar kilde-URL og adresse lagt i amenities, saa en senere laeser kan
se hvor paastanden kommer fra. Priser skrives IKKE: ingen af de to operatoerer
oplyser en pris paa deres egen side, og et tal fra et bookingspejl ville vaere
et gaet med to decimaler.

Kor:  python3 -I scripts/stays_operator_fakta.py [--skriv]
"""
import http.client, json, os, sys, urllib.parse
env={}
for l in open("web/.env.local",encoding="utf-8"):
    t=l.strip()
    if t and not t.startswith("#") and "=" in t:
        k,v=t.split("=",1); env[k.strip()]=v.strip().strip('"').strip("'")
host=urllib.parse.urlparse(env["NEXT_PUBLIC_SUPABASE_URL"]).netloc
KEY=env["SUPABASE_SERVICE_ROLE_KEY"]
SKRIV="--skriv" in sys.argv

def kald(m,sti,krop=None):
    c=http.client.HTTPSConnection(host,timeout=60)
    h={"apikey":KEY,"Authorization":"Bearer "+KEY,"Accept":"application/json"}
    if krop is not None: h["Content-Type"]="application/json"
    c.request(m,sti,body=json.dumps(krop) if krop is not None else None,headers=h)
    r=c.getresponse(); b=r.read().decode("utf-8"); c.close()
    if r.status>=300: raise SystemExit("%s %s -> %s %s"%(m,sti,r.status,b[:300]))
    return json.loads(b) if b.strip() else []

RONHAVE="https://ronhave.eu/en/green-glamping/"
TINY="https://www.tinyseaside.dk/en/tiny-seaside/"

PLAN = {
 914: dict(operator_name="Rønhave", capacity=2, kilde=RONHAVE, adresse="Hestehave 20, 6400 Sønderborg",
   short_description=(
     "Luksustelt i Rønhaves gamle æbleplantage ved Sønderborg. Hvert telt har sin egen terrasse "
     "med grill, eget bad med toilet og håndvask, og en stor dobbeltseng. Rønhave oplyser, at en "
     "morgenmadskurv med overvejende lokale varer er inkluderet. Stedet er kun for voksne: man "
     "skal være over 21 år, og der er ikke plads til børn eller hunde.")),
 918: dict(operator_name="Tiny SeaSide ApS", capacity=None, kilde=TINY, adresse="Loddenhøjvej 245, 6200 Aabenraa",
   short_description=(
     "Tiny house i Tiny SeaSides anlæg ved Loddenhøj på Aabenraa Fjord, i anden række fra vandet. "
     "Operatøren oplyser fælles faciliteter som badebro, Tiny Spa, Tiny Gym, bålplads, hyggelounge "
     "med hængekøjer, legeplads og en butik med lokale varer.")),
 919: dict(operator_name="Tiny SeaSide ApS", capacity=None, kilde=TINY, adresse="Østerbyvej 51, 6470 Sydals",
   short_description=(
     "Tiny house på Kegnæs syd for Als, hvor Tiny SeaSide ligger ned til Østersøen. Operatøren "
     "oplyser fælles faciliteter som badebro, Tiny Spa, Tiny Gym, bålplads, hyggelounge med "
     "hængekøjer og legeplads.")),
 920: dict(operator_name="Tiny SeaSide ApS", capacity=None, kilde=TINY, adresse="Skarrevvej 333, 6200 Aabenraa",
   short_description=(
     "Tiny house ved Skarrev på Aabenraa Fjord, hvor husene står ud mod Østersøen. Operatøren "
     "oplyser fælles faciliteter som badebro, Tiny Spa, Tiny Gym, bålplads, hyggelounge med "
     "hængekøjer, legeplads og en butik med lokale specialiteter.")),
}

for sid, p in PLAN.items():
    r = kald("GET","/rest/v1/nature_stays?select=id,name,amenities,operator_name,capacity,short_description&id=eq.%d"%sid)[0]
    am = dict(r["amenities"] or {})
    am["operator_kilde"] = p["kilde"]          # operatoerens egen side
    am["operator_adresse"] = p["adresse"]      # som operatoeren selv skriver den
    am["verificeret"] = "2026-10-31"
    ny = {
      "operator_name": p["operator_name"],
      "short_description": p["short_description"],
      "amenities": am,
      "last_verified_at": "2026-10-31",
    }
    if p["capacity"] is not None: ny["capacity"] = p["capacity"]
    print("%s  %s" % (sid, r["name"][:48]))
    print("     operator: %-18s kapacitet: %s" % (p["operator_name"], p["capacity"] if p["capacity"] else "ikke oplyst"))
    print("     kilde:    %s" % p["kilde"])
    print("     tekst:    %s..." % p["short_description"][:76])
    if SKRIV:
        kald("PATCH","/rest/v1/nature_stays?id=eq.%d"%sid, ny)
print()
print("TOERKOERSEL, intet skrevet" if not SKRIV else "opdaterede %d steder" % len(PLAN))
