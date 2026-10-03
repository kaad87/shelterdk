"""
Google Analytics 4 via service account — uden google-api-python-client.

Samme mønster som gsc_fetch.py: signerer selv et RS256-JWT (PyJWT +
cryptography) og bytter det til et access token, så der ikke skal installeres
Google-biblioteker.

Opsætning (én gang):
  1. Samme service-konto som Search Console kan genbruges
     (client_email i gsc-service-account.json).
  2. Google Cloud Console → APIs & Services → Enable "Google Analytics Data API".
  3. GA4 → Administrator → Ejendomsadgangsstyring → tilføj service-kontoens
     e-mail som "Fremviser" (læseadgang er nok).
  4. Find ejendoms-id'et (et tal, ikke G-XXXXXXX): GA4 → Administrator →
     Ejendomsoplysninger → "EJENDOMS-ID". Sæt i .env:
        GA4_PROPERTY_ID=123456789
        GA4_SERVICE_ACCOUNT_FILE=gsc-service-account.json   # kan deles med GSC

Brug:
  python3 ga4_fetch.py check                         # verificér adgang
  python3 ga4_fetch.py events [--days 28]            # alle events med antal
  python3 ga4_fetch.py event <navn> [--dim <dim>]    # ét event brudt ned
  python3 ga4_fetch.py gear [--days 28]              # grej-blokkens tragt
  python3 ga4_fetch.py pages [--days 28] [--limit 25]
"""
import argparse, collections, datetime as dt, json, os, sys, time

import jwt, requests

ROOT = os.path.dirname(os.path.abspath(__file__))
for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
    if os.path.isfile(p):
        try:
            from dotenv import load_dotenv
            load_dotenv(p)
        except ImportError:
            for line in open(p):
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://analyticsdata.googleapis.com/v1beta"
_token = {"value": None, "exp": 0}


def _creds():
    raw = os.environ.get("GA4_SERVICE_ACCOUNT_JSON")
    path = os.environ.get("GA4_SERVICE_ACCOUNT_FILE") or os.environ.get("GSC_SERVICE_ACCOUNT_FILE")
    if raw:
        return json.loads(raw)
    if path:
        return json.load(open(path if os.path.isabs(path) else os.path.join(ROOT, path)))
    sys.exit("Mangler GA4_SERVICE_ACCOUNT_FILE (eller GSC_SERVICE_ACCOUNT_FILE) i .env")


def access_token():
    if _token["value"] and time.time() < _token["exp"] - 60:
        return _token["value"]
    c = _creds()
    now = int(time.time())
    assertion = jwt.encode(
        {"iss": c["client_email"], "scope": SCOPE, "aud": TOKEN_URL, "iat": now, "exp": now + 3600},
        c["private_key"], algorithm="RS256",
    )
    r = requests.post(TOKEN_URL, data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion,
    }, timeout=20)
    r.raise_for_status()
    _token["value"] = r.json()["access_token"]
    _token["exp"] = now + 3600
    return _token["value"]


def prop():
    pid = (os.environ.get("GA4_PROPERTY_ID") or "").strip()
    if not pid.isdigit():
        sys.exit("GA4_PROPERTY_ID skal være ejendoms-id'et (tal), ikke måle-id'et G-XXXXXXX.\n"
                 "Find det i GA4 → Administrator → Ejendomsoplysninger.")
    return pid


def run_report(dimensions, metrics, days, limit=200, dimension_filter=None, offset_days=0):
    end = dt.date.today() - dt.timedelta(days=offset_days)
    start = end - dt.timedelta(days=days - 1)
    body = {
        "dateRanges": [{"startDate": start.isoformat(), "endDate": end.isoformat()}],
        "dimensions": [{"name": d} for d in dimensions],
        "metrics": [{"name": m} for m in metrics],
        "limit": limit,
    }
    if dimension_filter:
        body["dimensionFilter"] = dimension_filter
    r = requests.post(
        f"{API}/properties/{prop()}:runReport",
        json=body,
        headers={"Authorization": f"Bearer {access_token()}"},
        timeout=60,
    )
    if r.status_code >= 400:
        sys.exit(f"runReport → {r.status_code}\n{r.text[:800]}")
    data = r.json()
    rows = []
    for row in data.get("rows", []):
        rows.append({
            **{d: v["value"] for d, v in zip(dimensions, row.get("dimensionValues", []))},
            **{m: float(v["value"]) for m, v in zip(metrics, row.get("metricValues", []))},
        })
    return rows, start, end


def eq_filter(field, value):
    return {"filter": {"fieldName": field, "stringFilter": {"matchType": "EXACT", "value": value}}}


def cmd_check(a):
    rows, s, e = run_report(["eventName"], ["eventCount"], 7, limit=5)
    print(f"Adgang OK — ejendom {prop()} · {s} til {e}")
    print(f"  {len(rows)} event-typer i de sidste 7 dage")
    for r in rows[:5]:
        print(f"    {r['eventName']:28} {r['eventCount']:.0f}")


def cmd_events(a):
    rows, s, e = run_report(["eventName"], ["eventCount", "totalUsers"], a.days, limit=200)
    rows.sort(key=lambda r: -r["eventCount"])
    print(f"Events {s} til {e}\n")
    print(f"  {'event':34}{'antal':>10}{'brugere':>10}")
    for r in rows:
        print(f"  {r['eventName'][:32]:34}{r['eventCount']:10.0f}{r['totalUsers']:10.0f}")


def cmd_event(a):
    dims = ["eventName"] + ([a.dim] if a.dim else [])
    rows, s, e = run_report(dims, ["eventCount", "totalUsers"], a.days,
                            limit=a.limit, dimension_filter=eq_filter("eventName", a.navn))
    rows.sort(key=lambda r: -r["eventCount"])
    tot = sum(r["eventCount"] for r in rows)
    print(f"«{a.navn}» {s} til {e} · {tot:.0f} i alt\n")
    if not a.dim:
        return
    print(f"  {a.dim[:40]:42}{'antal':>8}{'brugere':>9}")
    for r in rows[:a.limit]:
        print(f"  {str(r.get(a.dim, ''))[:40]:42}{r['eventCount']:8.0f}{r['totalUsers']:9.0f}")


def cmd_gear(a):
    """Tragten fra shelter-side til købsguide.

    Grej-blokken ligger på 1.609 shelter-sider og var den eneste store flade
    uden måling. Klikket findes kun i GA4; affiliate-klikket der eventuelt
    følger, findes i Supabase (affiliate_clicks.path indeholder ?fra=shelter).
    """
    rows, s, e = run_report(["eventName"], ["eventCount", "totalUsers"], a.days,
                            limit=10, dimension_filter=eq_filter("eventName", "gear_suggestion_click"))
    klik = sum(r["eventCount"] for r in rows)
    brugere = sum(r["totalUsers"] for r in rows)
    print(f"Grej-blokken {s} til {e}")
    print(f"  klik på blokken : {klik:.0f} ({brugere:.0f} brugere)")

    sider, _, _ = run_report(["pagePath"], ["screenPageViews"], a.days, limit=1,
                             dimension_filter={"filter": {"fieldName": "pagePath",
                                                          "stringFilter": {"matchType": "BEGINS_WITH",
                                                                           "value": "/danmark/"}}})
    print(f"  (til sammenligning hentes affiliate-siden fra Supabase:")
    print(f"     select count(*) from affiliate_clicks where path like '%fra=shelter%';)")


def cmd_pages(a):
    rows, s, e = run_report(["pagePath"], ["screenPageViews", "totalUsers"], a.days, limit=a.limit)
    rows.sort(key=lambda r: -r["screenPageViews"])
    print(f"Mest viste sider {s} til {e}\n")
    print(f"  {'side':46}{'visninger':>11}{'brugere':>9}")
    for r in rows[:a.limit]:
        print(f"  {r['pagePath'][:44]:46}{r['screenPageViews']:11.0f}{r['totalUsers']:9.0f}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check").set_defaults(fn=cmd_check)

    ev = sub.add_parser("events"); ev.add_argument("--days", type=int, default=28); ev.set_defaults(fn=cmd_events)

    one = sub.add_parser("event")
    one.add_argument("navn")
    one.add_argument("--days", type=int, default=28)
    one.add_argument("--dim", default=None, help="fx pagePath, customEvent:guide_slug")
    one.add_argument("--limit", type=int, default=25)
    one.set_defaults(fn=cmd_event)

    g = sub.add_parser("gear"); g.add_argument("--days", type=int, default=28); g.set_defaults(fn=cmd_gear)

    pg = sub.add_parser("pages"); pg.add_argument("--days", type=int, default=28)
    pg.add_argument("--limit", type=int, default=25); pg.set_defaults(fn=cmd_pages)

    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
