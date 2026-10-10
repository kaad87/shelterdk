"""Hvor ligger de næste klik på købsguiderne — og skal de hentes med
placering eller med titel?

De to problemer ser ens ud i en klik-rapport og har modsatte løsninger:
en side på plads 15 med normal CTR mangler autoritet; en side på plads 8
med en tredjedel af normal CTR mangler en titel folk vil klikke på.

Forventningen bygges derfor på sitets egen CTR betinget af BÅDE placering
og søgningens type. Uden typen bliver diagnosen forkert: et bart produktord
("tændstål") har omkring en tredjedel af CTR'en for en kommerciel søgning
("bedste tændstål") på samme plads, så en side der tilfældigvis rammer
mest bare produktord ser ud som en titelfejl uden at være det.

  python3 scripts/gsc_guide_potentiale.py [--days 28] [--maal 6]
"""
import argparse
import collections
import datetime as dt
import os
import re
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import gsc_fetch as g  # noqa: E402

PRÆFIX = "https://shelterdk.dk"
KOMMERCIEL = re.compile(
    r"\bbedst|\btest\b|\bk[øo]b\b|\bpris|anbefal|hvilken|hvilket|sammenlign|\btop ?\d")
BÅND = [(1, 4.5, "1-4"), (4.5, 8.5, "5-8"), (8.5, 12.5, "9-12"), (12.5, 20.5, "13-20"),
        (20.5, 1e9, "21+")]


def hent(dims, s, e, filter_page=None, limit=25000):
    body = {"startDate": s.isoformat(), "endDate": e.isoformat(), "dimensions": dims,
            "rowLimit": limit, "dataState": "final"}
    if filter_page:
        body["dimensionFilterGroups"] = [{"filters": [
            {"dimension": "page", "operator": "contains", "expression": filter_page}]}]
    return g.call("POST", f"/webmasters/v3/sites/{quote(g.prop(), safe='')}/searchAnalytics/query",
                  body).get("rows", [])


def søgetype(q):
    if KOMMERCIEL.search(q.lower()):
        return "kommerciel"
    return "bredt" if len(q.split()) == 1 else "øvrigt"


def bånd(pos):
    for lo, hi, navn in BÅND:
        if lo <= pos < hi:
            return navn
    return "21+"


def byg_kurve(rows):
    """CTR pr. (søgetype, positionsbånd), med fald-tilbage når en celle er tynd.

    Celler under 400 visninger falder tilbage til båndets samlede CTR, så en
    enkelt heldig søgning ikke bliver norm for en hel gruppe.
    """
    celle = collections.defaultdict(lambda: [0.0, 0.0])
    kun_bånd = collections.defaultdict(lambda: [0.0, 0.0])
    for r in rows:
        t, b = søgetype(r["keys"][0]), bånd(r["position"])
        for mål in (celle[(t, b)], kun_bånd[b]):
            mål[0] += r["clicks"]
            mål[1] += r["impressions"]

    def ctr(t, b):
        c, i = celle[(t, b)]
        if i >= 400:
            return c / i
        c, i = kun_bånd[b]
        return c / i if i else 0.0

    return ctr, celle, kun_bånd


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=56)
    ap.add_argument("--maal", default="5-8", choices=[b[2] for b in BÅND])
    ap.add_argument("--min-visn", type=int, default=150)
    a = ap.parse_args()

    end = g.latest_final_date()
    s = end - dt.timedelta(days=a.days - 1)
    rows = hent(["query", "page"], s, end, "/bedste/")
    ctr, celle, kun_bånd = byg_kurve(rows)

    print(f"Købsguider — {s} → {end} ({a.days} dage)\n")
    print("  Sitets CTR pr. søgetype og placering")
    print(f"    {'søgetype':12}" + "".join(f"{b[2]:>16}" for b in BÅND))
    for t in ("kommerciel", "bredt", "øvrigt"):
        ud = []
        for _, _, b in BÅND:
            c, i = celle[(t, b)]
            ud.append(f"{c/i*100:5.1f}% {int(i):>6}" if i else f"{'–':>12}")
        print(f"    {t:12}" + "".join(f"{x:>16}" for x in ud))

    # Forventede klik pr. side = summen af hver søgnings egen forventning.
    pr_side = collections.defaultdict(lambda: {"k": 0.0, "v": 0.0, "f": 0.0, "m": 0.0,
                                               "pv": 0.0, "bred": 0.0})
    for r in rows:
        q, u = r["keys"]
        d = pr_side[u]
        d["k"] += r["clicks"]
        d["v"] += r["impressions"]
        d["f"] += r["impressions"] * ctr(søgetype(q), bånd(r["position"]))
        d["m"] += r["impressions"] * ctr(søgetype(q), a.maal)
        d["pv"] += r["impressions"] * r["position"]
        if søgetype(q) == "bredt":
            d["bred"] += r["impressions"]

    rk = []
    for u, d in pr_side.items():
        if d["v"] < a.min_visn:
            continue
        idx = d["k"] / d["f"] if d["f"] else 0
        gevinst = max(0.0, d["m"] - d["k"])
        rk.append((gevinst, u, d, idx))
    rk.sort(reverse=True)

    print(f"\n  Potentiale hvis siden nåede plads {a.maal} — forventning pr. søgning")
    print(f"    {'side':34} {'visn':>6} {'klik':>5} {'forv':>6} {'idx':>5} {'pos':>5} "
          f"{'bredt':>6} {'+klik':>6}  diagnose")
    for gev, u, d, idx in rk[:20]:
        pos = d["pv"] / d["v"]
        diag = ("titel/snippet" if idx < 0.6 else
                "placering" if pos > 8.5 else "fin")
        print(f"    {u.replace(PRÆFIX,''):34} {d['v']:6.0f} {d['k']:5.0f} {d['f']:6.1f} "
              f"{idx:5.2f} {pos:5.1f} {d['bred']/d['v']*100:5.0f}% {gev:6.1f}  {diag}")

    tk = sum(x[2]["k"] for x in rk)
    tv = sum(x[2]["v"] for x in rk)
    print(f"\n  {len(rk)} sider over {a.min_visn} visninger: {tk:.0f} klik af {tv:.0f} visninger")
    print(f"  samlet potentiale ved plads {a.maal}: +{sum(x[0] for x in rk):.0f} klik "
          f"pr. {a.days} dage")
    # Et indeks på 0 betyder intet, hvis der kun var forventet ét klik: nul ud
    # af ét er almindeligt uheld. Kræv derfor at forventningen er stor nok til
    # at et nul faktisk er usandsynligt, før siden kaldes en titelfejl.
    t = [x for x in rk if x[3] < 0.6 and x[2]["f"] >= 3]
    svag = [x for x in rk if x[3] < 0.6 and x[2]["f"] < 3]
    print(f"  ægte titel-sager (idx < 0,6 og mindst 3 forventede klik): {len(t)} sider, "
          f"{sum(x[2]['v'] for x in t):.0f} visninger")
    for _, u, d, idx in t:
        print(f"    {u.replace(PRÆFIX,''):34} idx {idx:.2f} · {d['k']:.0f} klik hvor "
              f"{d['f']:.1f} var forventet · {d['bred']/d['v']*100:.0f}% bredt")
    if svag:
        print(f"  for tynde til en dom ({len(svag)}): "
              + ", ".join(u.replace(PRÆFIX, "") for _, u, _, _ in svag))


if __name__ == "__main__":
    main()
