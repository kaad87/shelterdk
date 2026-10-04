"""
Booking-tragten: fra klik på Book-knappen til faktisk booking.

Klikket logges i internal_events (fuld optælling, anonymt). GA4 duer ikke til
det: dens server-vej er bag en samtykkeport, og den så 71 klik på 28 dage mod
222 affiliate-klik i databasen for 7 — altså omkring 3% af virkeligheden.

Bookingerne hentes fra shelter_bookings. Forholdet mellem de to er det eneste,
der viser om flowet taber folk mellem knappen og den gennemførte booking.

Bemærk at ikke alle klik KAN blive til en booking her: booking_type
"external" og "naturstyrelsen_fallback" sender brugeren videre til en anden
udbyder, og dem ser vi aldrig udfaldet af. De vises derfor hver for sig.

Brug:  python3 scripts/booking_funnel.py [--days 28]
"""
import argparse, collections, datetime as dt, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
    if os.path.isfile(p):
        for line in open(p):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)

from supabase import create_client

EGNE = {"shelterdk", "multi_unit"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=28)
    a = ap.parse_args()
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=a.days)).isoformat()

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    klik = sb.table("internal_events").select("params,created_at") \
        .eq("event", "book_button_clicked").gte("created_at", since).execute().data

    # Vinduet skal starte ved det FØRSTE målte klik, ikke ved --days. Ellers
    # tælles bookinger fra før målingen begyndte op mod nul klik, og forholdet
    # bliver meningsløst — første kørsel viste "333% af vores egne klik".
    maalt_fra = min((r["created_at"] for r in klik), default=None)
    bookinger = sb.table("shelter_bookings").select("status,created_at,source") \
        .gte("created_at", maalt_fra or since).execute().data

    typer = collections.Counter((r["params"] or {}).get("booking_type", "?") for r in klik)
    egne = sum(n for t, n in typer.items() if t in EGNE)
    eksterne = sum(n for t, n in typer.items() if t not in EGNE)

    print(f"Booking-tragten, sidste {a.days} dage")
    if maalt_fra:
        print(f"  (målt fra {maalt_fra[:16]} — bookinger tælles fra samme tidspunkt)\n")
    else:
        print()
    print(f"  klik på Book-knappen      {len(klik):5}")
    print(f"    heraf vores eget flow   {egne:5}")
    print(f"    heraf videre til andre  {eksterne:5}  (udfald ukendt)")
    print(f"  bookinger oprettet        {len(bookinger):5}")
    # Forholdet siges kun når det kan læses som et forhold. En booking kan
    # komme uden et målt klik — direkte link, mail, gentaget besøg — så over
    # 100% betyder ikke at tragten konverterer over alle forventninger.
    if egne:
        pct = len(bookinger) / egne * 100
        if pct <= 100:
            print(f"    svarer til {pct:.0f}% af klikkene i vores eget flow")
        else:
            print(f"    flere bookinger end målte klik ({pct:.0f}%) — en del kommer")
            print(f"    uden et klik på knappen (direkte link, mail, gentaget besøg)")

    if not klik:
        print("\n  Ingen klik endnu — book-knappen har først været målt siden 3. oktober 2026.")
    else:
        print("\n  Fordelt på type:")
        for t, n in typer.most_common():
            print(f"    {t[:28]:30}{n:4}")
        pos = collections.Counter((r["params"] or {}).get("cta_position", "?") for r in klik)
        print("\n  Hvor på siden:")
        for p_, n in pos.most_common():
            print(f"    {p_[:28]:30}{n:4}")

    if bookinger:
        st = collections.Counter(r["status"] for r in bookinger)
        print("\n  Bookingernes status:")
        for s, n in st.most_common():
            print(f"    {str(s)[:28]:30}{n:4}")


if __name__ == "__main__":
    main()
