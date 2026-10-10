"""Hvorfor faldt klikkene? Del faldet op i efterspørgsel, placering og CTR.

Et samlet klikfald siger ikke, om vi har mistet placeringer, om sæsonen er
ovre, eller om Google er begyndt at besvare spørgsmålene selv. De tre har
hver sin modforanstaltning, så de skal skilles ad før man handler.

Metoden er en kohorte: kun queries der findes i BEGGE vinduer tælles med i
dekomponeringen, så ændringer i query-sammensætningen ikke forklædes som
CTR-fald. Nye og tabte queries rapporteres separat.

  demand   = (visn_nu − visn_før) · ctr_før
  position = visn_nu · (forventet_ctr(pos_nu) − forventet_ctr(pos_før))
  serp     = resten — samme query, samme placering, færre klik

Forventet CTR kommer fra sitets egen kurve i før-vinduet, ikke en
branchetabel: vores CTR pr. position afhænger af vores egne titler.

ADVARSEL om dækning: GSC udelader anonymiserede long-tail-queries, så
dimensionen "query" dækker kun en tredjedel af sitets klik. Standarden er
derfor "page", som dækker dem alle. Scriptet printer dækningen, så en
konklusion aldrig hviler på en delmængde uden at det står der.

  python3 scripts/gsc_dekomponering.py [--days 28] [--dim page|query] [--top 15]
"""
import argparse
import collections
import datetime as dt
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import gsc_fetch as g  # noqa: E402


def hent(dims, start, end, limit=25000, filters=None):
    body = {"startDate": start.isoformat(), "endDate": end.isoformat(),
            "dimensions": dims, "rowLimit": limit, "dataState": "final"}
    if filters:
        body["dimensionFilterGroups"] = [{"filters": filters}]
    return g.call("POST", f"/webmasters/v3/sites/{quote(g.prop(), safe='')}/searchAnalytics/query",
                  body).get("rows", [])


def ctr_kurve(rows):
    """CTR pr. heltalsposition, udglattet med nabobånd så tynde positioner
    ikke får en tilfældig kurve."""
    bin_ = collections.defaultdict(lambda: [0.0, 0.0])
    for r in rows:
        p = min(60, max(1, int(round(r["position"]))))
        bin_[p][0] += r["clicks"]
        bin_[p][1] += r["impressions"]

    def ved(p):
        p = min(60, max(1, int(round(p))))
        c = i = 0.0
        for q in range(p - 1, p + 2):          # ±1 position som udglatning
            if q in bin_:
                c += bin_[q][0]
                i += bin_[q][1]
        return c / i if i > 200 else None

    kendt = {p: ved(p) for p in range(1, 61)}
    # Fyld huller med nærmeste kendte værdi, så kurven er monoton-ish defineret.
    sidste = 0.0
    for p in range(1, 61):
        if kendt[p] is None:
            kendt[p] = sidste
        else:
            sidste = kendt[p]
    return lambda pos: kendt[min(60, max(1, int(round(pos))))]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--dim", default="page", choices=["page", "query"])
    ap.add_argument("--top", type=int, default=15)
    a = ap.parse_args()

    end = g.latest_final_date()
    s1 = end - dt.timedelta(days=a.days - 1)
    e2 = s1 - dt.timedelta(days=1)
    s2 = e2 - dt.timedelta(days=a.days - 1)

    nu = hent([a.dim], s1, end)
    før = hent([a.dim], s2, e2)
    f = ctr_kurve(før)

    # Sitets sande totaler kommer fra dato-dimensionen; den er ikke
    # anonymitetsfiltreret. Uden den ved man ikke hvor stor en del af
    # virkeligheden tallene nedenfor beskriver.
    d_nu = hent(["date"], s1, end, limit=1000)
    d_før = hent(["date"], s2, e2, limit=1000)
    sand_nu = sum(r["clicks"] for r in d_nu)
    sand_før = sum(r["clicks"] for r in d_før)

    N = {r["keys"][0]: r for r in nu}
    F = {r["keys"][0]: r for r in før}
    fælles = set(N) & set(F)

    kn = sum(r["clicks"] for r in nu)
    kf = sum(r["clicks"] for r in før)

    print(f"Klikdekomponering — {a.days} dage, dim={a.dim}")
    print(f"  nu    {s1} → {end}")
    print(f"  før   {s2} → {e2}\n")
    print(f"  sitet i alt   {sand_før:.0f} → {sand_nu:.0f} klik "
          f"({(sand_nu / sand_før - 1) * 100:+.1f}%)")
    print(f"  dækket her    {kf:.0f} → {kn:.0f} klik "
          f"({kn / sand_nu * 100:.0f}% af sitets klik)\n")

    nye = sum(N[q]["clicks"] for q in set(N) - set(F))
    tabte = sum(F[q]["clicks"] for q in set(F) - set(N))

    d_dem = d_pos = d_serp = 0.0
    bidrag = []
    for q in fælles:
        n, p = N[q], F[q]
        ctr_f = p["clicks"] / p["impressions"] if p["impressions"] else 0.0
        ctr_n = n["clicks"] / n["impressions"] if n["impressions"] else 0.0
        dem = (n["impressions"] - p["impressions"]) * ctr_f
        pos = n["impressions"] * (f(n["position"]) - f(p["position"]))
        serp = (n["clicks"] - p["clicks"]) - dem - pos
        d_dem += dem
        d_pos += pos
        d_serp += serp
        bidrag.append((n["clicks"] - p["clicks"], q, p, n, dem, pos, serp))

    samlet = d_dem + d_pos + d_serp + nye - tabte
    print("  Faldet fordelt")
    for navn, v in (("efterspørgsel", d_dem), ("placering", d_pos),
                    ("CTR / SERP", d_serp), ("nye queries", nye), ("tabte queries", -tabte)):
        andel = v / (kn - kf) * 100 if kn != kf else 0
        print(f"    {navn:16} {v:+8.0f} klik  ({andel:5.1f}% af ændringen)")
    print(f"    {'= i alt':16} {samlet:+8.0f} klik   (faktisk {kn - kf:+.0f})\n")

    print(f"  queries: {len(F)} før → {len(N)} nu · {len(fælles)} fælles · "
          f"{len(set(N) - set(F))} nye · {len(set(F) - set(N))} tabte\n")

    bidrag.sort(key=lambda t: t[0])
    print(f"  Største tab blandt fælles queries")
    print(f"    {'query':40} {'klik':>11} {'pos':>11} {'årsag'}")
    for d, q, p, n, dem, pos, serp in bidrag[:a.top]:
        if d >= 0:
            break
        årsag = max((("efterspørgsel", dem), ("placering", pos), ("serp", serp)),
                    key=lambda t: -t[1])[0]
        print(f"    {q[:40]:40} {p['clicks']:4.0f}→{n['clicks']:<4.0f} "
              f"{p['position']:5.1f}→{n['position']:<5.1f} {årsag}")

    print(f"\n  Største stigninger")
    for d, q, p, n, dem, pos, serp in reversed(bidrag[-a.top:]):
        if d <= 0:
            break
        print(f"    {q[:40]:40} {p['clicks']:4.0f}→{n['clicks']:<4.0f} "
              f"{p['position']:5.1f}→{n['position']:<5.1f}")


if __name__ == "__main__":
    main()
