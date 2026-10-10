"""Kommer folk ind på guiderne udefra, eller finder vi dem selv derhen?

Affiliate-indtægten kommer næsten udelukkende fra /bedste/-siderne, men de
henter kun en brøkdel af sitets søgetrafik. Enten skal guiderne rangere
bedre, eller shelter-trafikken skal kanaliseres derhen. Forholdet mellem
indgange og visninger afgør hvilken af de to der overhovedet virker i dag:
er visninger ≈ indgange, går ingen derhen indefra, og de interne links er
uudnyttede snarere end udnyttede.

  python3 scripts/ga4_rejse.py [--days 28]
"""
import argparse
import collections
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ga4_fetch as ga  # noqa: E402


def gruppe(sti):
    if sti == "/":
        return "forside"
    for præfix, navn in (("/bedste", "købsguider"), ("/guides", "guides"),
                         ("/by/", "by-sider"), ("/danmark", "geo-sider"),
                         ("/omraade", "områder"), ("/shelter/", "shelter-detalje"),
                         ("/shelter-med", "samlesider"), ("/ruteplanner", "ruteplanner"),
                         ("/koeb-shelter", "køb-shelter"), ("/fri-teltning", "fri teltning")):
        if sti.startswith(præfix):
            return navn
    return "øvrigt"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=28)
    a = ap.parse_args()

    # GA4 har ingen "entrances"-metrik. Indgange måles som sessioner opgjort
    # på landingssiden, så visninger og indgange skal hentes i to rapporter
    # og lægges sammen pr. gruppe bagefter.
    rows, s, e = ga.run_report(
        ["pagePath"], ["screenPageViews", "userEngagementDuration"], a.days, limit=2000)
    land, _, _ = ga.run_report(
        ["landingPagePlusQueryString"], ["sessions"], a.days, limit=2000)

    agg = collections.defaultdict(lambda: collections.Counter())
    for r in rows:
        d = agg[gruppe(r["pagePath"])]
        d["visn"] += r["screenPageViews"]
        d["tid"] += r["userEngagementDuration"]
        d["sider"] += 1
    for r in land:
        sti = r["landingPagePlusQueryString"].split("?")[0] or "/"
        agg[gruppe(sti)]["ind"] += r["sessions"]

    print(f"Sidegrupper {s} til {e}\n")
    print(f"  {'gruppe':17}{'visninger':>10}{'indgange':>10}{'indefra':>9}"
          f"{'sek/visn':>10}{'sider':>7}")
    tv = sum(d["visn"] for d in agg.values())
    for navn, d in sorted(agg.items(), key=lambda kv: -kv[1]["visn"]):
        indefra = (d["visn"] - d["ind"]) / d["visn"] * 100 if d["visn"] else 0
        print(f"  {navn:17}{d['visn']:10.0f}{d['ind']:10.0f}{indefra:8.0f}%"
              f"{d['tid']/d['visn'] if d['visn'] else 0:10.0f}{d['sider']:7d}")
    print(f"  {'i alt':17}{tv:10.0f}")

    g = agg["købsguider"]
    print(f"\n  Købsguider: {g['visn']:.0f} visninger, heraf {g['visn']-g['ind']:.0f} "
          f"({(g['visn']-g['ind'])/g['visn']*100:.0f}%) nået indefra")

    # Hvor kommer sessionerne fra — og hvor engagerede er de
    kan, _, _ = ga.run_report(["sessionDefaultChannelGroup"],
                              ["sessions", "engagedSessions", "screenPageViews"], a.days, limit=20)
    print(f"\n  Kanaler")
    print(f"    {'kanal':22}{'sessioner':>10}{'engagerede':>11}{'sider/session':>14}")
    for r in sorted(kan, key=lambda r: -r["sessions"]):
        print(f"    {r['sessionDefaultChannelGroup'][:20]:22}{r['sessions']:10.0f}"
              f"{r['engagedSessions']/r['sessions']*100 if r['sessions'] else 0:10.0f}%"
              f"{r['screenPageViews']/r['sessions'] if r['sessions'] else 0:14.2f}")

    enh, _, _ = ga.run_report(["deviceCategory"],
                              ["sessions", "engagedSessions", "screenPageViews"], a.days, limit=10)
    print(f"\n  Enheder")
    for r in sorted(enh, key=lambda r: -r["sessions"]):
        print(f"    {r['deviceCategory']:22}{r['sessions']:10.0f}"
              f"{r['engagedSessions']/r['sessions']*100 if r['sessions'] else 0:10.0f}%"
              f"{r['screenPageViews']/r['sessions'] if r['sessions'] else 0:14.2f}")


if __name__ == "__main__":
    main()
