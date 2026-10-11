"""Hvor ligger de næste klik? Tre løftestænger, kvantificeret i klik.

  1. Striking distance: queries på position 6-15. Hvad giver det at flytte
     dem til position 5?
  2. CTR-underskud: sider der får færre klik end deres placeringer berettiger.
     Det er et titel/snippet-problem, ikke et placerings-problem.
  3. Kannibalisering: queries hvor flere af vores egne sider konkurrerer.

VIGTIGT om dimensioner. Det er fristende at regne på "page", fordi den dækker
~100% af klikkene mod query-dimensionens ~34%. Men en sides "position" er et
GENNEMSNIT over alle de queries den rangerer på: en side med gennemsnit 12 har
queries på 3 og på 40 blandet sammen. En CTR-kurve bygget på den dimension er
flad omkring 2-4% hele vejen — ikke fordi CTR er flad, men fordi gennemsnittet
udvisker den. Målt på query-dimensionen, hvor positionen er reel, falder
sitets kurve fra 30% på p1 til 0,7% på p10.

Derfor: alt der afhænger af position regnes på query- eller side+query-
dimensionen. Side-dimensionen bruges kun til at opgøre trafik pr. sidetype,
hvor position ikke indgår. En tidligere udgave blandede de to og overvurderede
CTR-underskuddet med en faktor 3.

  python3 scripts/gsc_potentiale.py [--days 28] [--maal 5]
"""
import argparse
import collections
import datetime as dt
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import gsc_fetch as g  # noqa: E402


def hent(dims, start, end, limit=25000):
    body = {"startDate": start.isoformat(), "endDate": end.isoformat(),
            "dimensions": dims, "rowLimit": limit, "dataState": "final"}
    ud, fra = [], 0
    while True:
        body["startRow"] = fra
        r = g.call("POST", f"/webmasters/v3/sites/{quote(g.prop(), safe='')}/searchAnalytics/query", body)
        rows = r.get("rows", [])
        ud += rows
        if len(rows) < limit:
            break
        fra += limit
    return ud


def ctr_kurve(rows, mindst=300):
    """Sitets egen CTR pr. position, målt hvor positionen er reel.

    Monotont faldende: en kurve hvor p12 ligger over p9 er støj fra en enkelt
    dominerende query, ikke en opdagelse. Huller mellem kendte punkter
    interpoleres — at videreføre sidste kendte værdi fra 0,0 forgiftede
    tidligere hele den nedre halvdel til nul.
    """
    b = collections.defaultdict(lambda: [0, 0])
    for r in rows:
        p = int(round(r["position"]))
        if 1 <= p <= 30:
            b[p][0] += r["clicks"]
            b[p][1] += r["impressions"]
    rå = {p: k / v for p, (k, v) in b.items() if v >= mindst}
    if not rå:
        return {}
    kurve, sidste = {}, None
    for p in range(1, 31):
        if p in rå:
            kurve[p] = min(rå[p], sidste) if sidste is not None else rå[p]
            sidste = kurve[p]
    kendte = sorted(kurve)
    for p in range(kendte[0], kendte[-1] + 1):
        if p not in kurve:
            f = max(k for k in kendte if k < p)
            e = min(k for k in kendte if k > p)
            kurve[p] = kurve[f] + (p - f) / (e - f) * (kurve[e] - kurve[f])
    for p in range(1, kendte[0]):
        kurve[p] = kurve[kendte[0]]
    for p in range(kendte[-1] + 1, 31):
        kurve[p] = kurve[kendte[-1]]
    return kurve


def typ(side):
    s = side.replace("https://shelterdk.dk", "").split("?")[0]
    if s in ("", "/"):
        return "forside"
    for p, navn in (("/bedste", "købsguide"), ("/danmark/", "shelter-detalje"),
                    ("/by/", "by-side"), ("/blog/", "blog"), ("/guides/", "guide"),
                    ("/omraade/", "område"), ("/shelter-booking", "booking"),
                    ("/ruteplanner", "rute"), ("/fakta/", "fakta"),
                    ("/region/", "region"), ("/koeb-shelter", "køb-shelter")):
        if s.startswith(p):
            return navn
    return "andet"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--maal", type=int, default=5, help="positionen vi regner gevinsten til")
    a = ap.parse_args()
    slut = g.latest_final_date()
    start = slut - dt.timedelta(days=a.days - 1)
    print(f"Vindue: {start} – {slut}  ({a.days} dage, dataState=final)\n")

    sider = hent(["page"], start, slut)
    pq = hent(["page", "query"], start, slut)
    klik_alle = sum(r["clicks"] for r in sider)
    klik_pq = sum(r["clicks"] for r in pq)
    print(f"{len(sider)} sider · {klik_alle:,.0f} klik i alt".replace(",", "."))
    print(f"{len(pq)} side+query-par · {klik_pq:,.0f} klik "
          f"({klik_pq / klik_alle * 100:.0f}% dækning — resten er anonymiseret long-tail)"
          .replace(",", "."))

    kurve = ctr_kurve(pq)
    print("\nSitets CTR-kurve (query-niveau): " +
          "  ".join(f"p{p}:{kurve[p]*100:.1f}%" for p in (1, 2, 3, 5, 7, 10, 15, 20)))

    # ---- 0. Trafik pr. sidetype (position indgår ikke, så side-dim er fin) ----
    pr = collections.defaultdict(lambda: [0, 0, 0])
    for r in sider:
        t = typ(r["keys"][0])
        pr[t][0] += r["clicks"]
        pr[t][1] += r["impressions"]
        pr[t][2] += 1
    print(f"\n{'='*74}\n0. TRAFIK PR. SIDETYPE\n{'='*74}")
    print(f"  {'type':18s} {'klik':>7s} {'andel':>7s} {'visn':>9s} {'CTR':>7s} {'sider':>7s}")
    for t, (k, v, n) in sorted(pr.items(), key=lambda x: -x[1][0]):
        print(f"  {t:18s} {k:7.0f} {k/klik_alle*100:6.1f}% {v:9.0f} {k/v*100:6.2f}% {n:7d}")

    # ---- 1. Striking distance ----
    M = a.maal
    kand = [(r["impressions"] * (kurve[M] - kurve[int(round(r["position"]))]), r)
            for r in pq
            if M + 0.5 <= r["position"] <= 15.5 and r["impressions"] >= 40]
    kand = sorted([k for k in kand if k[0] > 0], key=lambda x: -x[0])
    print(f"\n{'='*74}\n1. STRIKING DISTANCE: queries på pos {M}-15 → position {M}\n{'='*74}")
    print(f"  {len(kand)} par · potentiale {sum(x[0] for x in kand):,.0f} klik/{a.days} dage"
          .replace(",", "."))
    pr_t = collections.defaultdict(lambda: [0, 0.0])
    for gev, r in kand:
        t = typ(r["keys"][0])
        pr_t[t][0] += 1
        pr_t[t][1] += gev
    for t, (n, gev) in sorted(pr_t.items(), key=lambda x: -x[1][1]):
        print(f"    {t:18s} {n:4d} par  {gev:7.0f} klik")
    print("\n  top 20:")
    for gev, r in kand[:20]:
        s = r["keys"][0].replace("https://shelterdk.dk", "")
        print(f"    +{gev:5.1f}  pos {r['position']:5.1f}  {r['impressions']:5.0f} visn "
              f"{r['clicks']:3.0f} klik  {r['keys'][1][:34]:34s} → {s[:32]}")

    # ---- 2. CTR-underskud ----
    agg = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
    for r in pq:
        p = int(round(r["position"]))
        if not 1 <= p <= 30:
            continue
        s = r["keys"][0].replace("https://shelterdk.dk", "")
        agg[s][0] += r["clicks"]
        agg[s][1] += kurve[p] * r["impressions"]
        agg[s][2] += r["impressions"]
    ud = sorted([(f - k, k / f, s, k, f, v) for s, (k, f, v) in agg.items() if f >= 5],
                key=lambda x: -x[0])
    print(f"\n{'='*74}\n2. CTR-UNDERSKUD (forventning pr. query, summeret pr. side)\n{'='*74}")
    print(f"  {'side':46s} {'klik':>5s} {'forv':>6s} {'indeks':>7s} {'visn':>7s}")
    for _, idx, s, k, f, v in ud[:15]:
        print(f"  {s[:46]:46s} {k:5.0f} {f:6.1f} {idx:7.2f} {v:7.0f}")
    print("\n  overpræsterer (titlen virker — se hvad de gør):")
    for _, idx, s, k, f, v in sorted(ud, key=lambda x: -x[1])[:8]:
        print(f"  {s[:46]:46s} {k:5.0f} {f:6.1f} {idx:7.2f} {v:7.0f}")

    # ---- 3. Kannibalisering ----
    pr_q = collections.defaultdict(list)
    for r in pq:
        pr_q[r["keys"][1]].append((r["keys"][0].replace("https://shelterdk.dk", ""),
                                   r["impressions"], r["clicks"], r["position"]))
    delte = sorted([(q, s) for q, s in pr_q.items() if len(s) > 1],
                   key=lambda x: -sum(y[1] for y in x[1]))
    print(f"\n{'='*74}\n3. KANNIBALISERING: queries med flere af vores egne sider\n{'='*74}")
    print(f"  {len(delte)} af {len(pr_q)} queries ({len(delte)/len(pr_q)*100:.0f}%)")
    for q, s in delte[:12]:
        s = sorted(s, key=lambda x: -x[1])
        print(f"\n  \"{q}\" — {sum(x[1] for x in s):.0f} visn, {sum(x[2] for x in s):.0f} klik, "
              f"{len(s)} sider")
        for sti, v, k, p in s[:3]:
            print(f"      {v:5.0f} visn {k:3.0f} klik pos {p:5.1f}  {sti[:52]}")


if __name__ == "__main__":
    main()
