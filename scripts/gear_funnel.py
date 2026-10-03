"""
Grej-blokkens tragt: fra shelter-side til købsguide til forhandler.

Blokken ligger på 1.609 shelter-sider og var indtil 2. oktober helt umålt.
Klikket logges nu i internal_events (fuld optælling, anonymt), og det
affiliate-klik der eventuelt følger, kendes på ?fra=shelter i
affiliate_clicks.path.

GA4 bruges bevidst ikke: dens server-vej er bag en samtykkeport, og målt over
28 dage så den 7 affiliate-klik mod 222 i databasen.

Brug:  python3 scripts/gear_funnel.py [--days 28]
"""
import argparse, collections, datetime as dt, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
    if os.path.isfile(p):
        for line in open(p):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)

from supabase import create_client


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=28)
    a = ap.parse_args()
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=a.days)).isoformat()

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    klik = sb.table("internal_events").select("params,path,created_at") \
        .eq("event", "gear_suggestion_click").gte("created_at", since).execute().data
    aff = sb.table("affiliate_clicks").select("path,price_dkk,created_at") \
        .gte("created_at", since).execute().data
    fra_shelter = [r for r in aff if "fra=shelter" in (r["path"] or "")]

    print(f"Grej-blokken, sidste {a.days} dage\n")
    print(f"  klik på blokken          {len(klik):5}")
    print(f"  heraf til affiliate-klik {len(fra_shelter):5}"
          + (f"  ({len(fra_shelter)/len(klik)*100:.0f}%)" if klik else ""))
    print(f"  affiliate-klik i alt     {len(aff):5}"
          + (f"  (tragten står for {len(fra_shelter)/len(aff)*100:.0f}%)" if aff else ""))
    if fra_shelter:
        v = [r["price_dkk"] for r in fra_shelter if r["price_dkk"]]
        if v:
            print(f"  snitpris via tragten     {sum(v)/len(v):5.0f} kr")

    if not klik:
        print("\n  Ingen klik endnu — blokken har først været målt siden 2. oktober 2026.")
        return

    guides = collections.Counter((r["params"] or {}).get("guide_slug", "?") for r in klik)
    print("\n  Hvilken guide bliver klikket:")
    for g, n in guides.most_common(10):
        print(f"    {g[:30]:32}{n:4}")

    grunde = collections.Counter((r["params"] or {}).get("reason", "?") for r in klik)
    print("\n  Hvilken begrundelse virker:")
    for g, n in grunde.most_common(6):
        print(f"    {g[:44]:46}{n:4}")


if __name__ == "__main__":
    main()
