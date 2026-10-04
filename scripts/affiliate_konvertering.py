"""
Konvertering pr. købsguide — på en nævner der kan stoles på.

GA4 kan ikke bruges her. Målt over 28 dage fik /bedste-siderne 0,65
GA4-visninger pr. Google-klik, altså færre visninger end klik. Alle andre
sidetyper lå mellem 1,5 og 4,8. Forskellen er samtykkeløse pings plus
annonceblokering af googletagmanager.com, som rammer hårdest netop hos dem der
søger på grej. Regnet på GA4-tal kom /bedste/vandresokker ud på 250% konvertering.

Både tælleren (affiliate_clicks) og nævneren (internal_events.guide_view) går
gennem /api/track på samme oprindelse. Den vej slipper igennem: affiliate-klik
står 191 i Supabase mod 7 i GA4 over samme periode.

Brug:  python3 scripts/affiliate_konvertering.py [--days 28]
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=28)
    a = ap.parse_args()
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=a.days)).isoformat()

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    visninger = sb.table("internal_events").select("params,created_at") \
        .eq("event", "guide_view").gte("created_at", since).execute().data
    klik = sb.table("affiliate_clicks").select("path,price_dkk,placement,created_at") \
        .gte("created_at", since).execute().data

    if not visninger:
        print("Ingen guide_view endnu — målingen begyndte 4. oktober 2026.")
        return

    # Vinduet starter ved første målte visning, ellers tælles klik op mod en
    # nævner der ikke fandtes endnu.
    maalt_fra = min(r["created_at"] for r in visninger)
    klik = [k for k in klik if k["created_at"] >= maalt_fra]

    v = collections.Counter((r["params"] or {}).get("guide_slug", "?") for r in visninger)
    k = collections.Counter()
    for r in klik:
        p = (r["path"] or "").split("?")[0]
        if p.startswith("/bedste/"):
            k[p[len("/bedste/"):]] += 1

    print(f"Konvertering pr. guide (målt fra {maalt_fra[:16]})\n")
    print(f"  {'guide':28}{'visn':>7}{'klik':>7}{'konv':>8}")
    raekker = [(slug, v[slug], k.get(slug, 0)) for slug in v]
    for slug, nv, nk in sorted(raekker, key=lambda x: -x[1]):
        pct = nk / nv * 100 if nv else 0
        print(f"  {slug[:26]:28}{nv:7}{nk:7}{pct:7.0f}%")

    tv, tk = sum(v.values()), sum(k.get(s, 0) for s in v)
    print(f"\n  {'i alt':28}{tv:7}{tk:7}{(tk/tv*100 if tv else 0):7.0f}%")

    fra_shelter = sum(1 for r in visninger if (r["params"] or {}).get("fra") == "shelter")
    if fra_shelter:
        print(f"\n  heraf fra grej-blokken på shelter-siderne: {fra_shelter}")


if __name__ == "__main__":
    main()
