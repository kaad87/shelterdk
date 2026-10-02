"""
Google Search Console via service account — uden google-api-python-client.
Signerer selv et RS256-JWT (PyJWT + cryptography) og bytter det til et access
token, så scriptet kun kræver de pakker der allerede ligger i miljøet.

Opsætning (én gang):
  1. Google Cloud Console → IAM → Service Accounts → opret konto, download JSON-nøgle.
  2. APIs & Services → Enable "Google Search Console API".
  3. Search Console → shelterdk.dk → Indstillinger → Brugere → tilføj service-
     kontoens e-mail (client_email i JSON'en) med "Fuld"-adgang.
  4. Læg nøglen som ./gsc-service-account.json (git-ignoreret) og sæt i .env:
        GSC_SERVICE_ACCOUNT_FILE=gsc-service-account.json
        GSC_PROPERTY=sc-domain:shelterdk.dk

Brug:
  python3 gsc_fetch.py sites                       # verificér adgang
  python3 gsc_fetch.py query [--days 28] [--dim page|query|page,query] [--filter-page /danmark/] [--limit 50]
  python3 gsc_fetch.py inspect <url> [<url> ...]   # indekseringsstatus (URL Inspection API)
  python3 gsc_fetch.py sitemaps
  python3 gsc_fetch.py report [--days 28]        # CTR pr. position + spørgsmåls-andel
"""
import argparse, collections, datetime as dt, json, os, re, sys, time

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
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

SCOPE = "https://www.googleapis.com/auth/webmasters"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API = "https://searchconsole.googleapis.com"
_token = {"value": None, "exp": 0}


def _creds():
    raw = os.environ.get("GSC_SERVICE_ACCOUNT_JSON")
    path = os.environ.get("GSC_SERVICE_ACCOUNT_FILE")
    if raw:
        return json.loads(raw)
    if path:
        return json.load(open(os.path.join(ROOT, path) if not os.path.isabs(path) else path))
    sys.exit("Mangler GSC_SERVICE_ACCOUNT_FILE (eller GSC_SERVICE_ACCOUNT_JSON) i .env")


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


def call(method, path, body=None, params=None):
    r = requests.request(method, API + path, params=params, json=body,
                         headers={"Authorization": f"Bearer {access_token()}"}, timeout=60)
    if r.status_code >= 400:
        sys.exit(f"{method} {path} → {r.status_code}\n{r.text[:800]}")
    return r.json() if r.text else {}


def prop():
    return os.environ.get("GSC_PROPERTY", "sc-domain:shelterdk.dk")


def cmd_sites(_):
    sites = call("GET", "/webmasters/v3/sites").get("siteEntry", [])
    if not sites:
        print("Ingen properties — service-kontoen er ikke tilføjet som bruger i Search Console.")
        return
    for s in sites:
        print(f"  {s['siteUrl']:40} {s['permissionLevel']}")


def cmd_sitemaps(_):
    from urllib.parse import quote
    for s in call("GET", f"/webmasters/v3/sites/{quote(prop(), safe='')}/sitemaps").get("sitemap", []):
        n = sum(int(c.get("submitted", 0)) for c in s.get("contents", []))
        i = sum(int(c.get("indexed", 0)) for c in s.get("contents", []))
        print(f"  {s['path']}\n      indsendt {s.get('lastSubmitted','?')[:10]}  læst {s.get('lastDownloaded','?')[:10]}  "
              f"urls {n}  fejl {s.get('errors',0)}  advarsler {s.get('warnings',0)}")


def cmd_query(a):
    from urllib.parse import quote
    end = dt.date.today() - dt.timedelta(days=2)  # GSC har ~2 dages forsinkelse
    start = end - dt.timedelta(days=a.days - 1)
    dims = [d.strip() for d in a.dim.split(",")]
    body = {"startDate": start.isoformat(), "endDate": end.isoformat(),
            "dimensions": dims, "rowLimit": a.limit, "dataState": "final"}
    if a.filter_page:
        body["dimensionFilterGroups"] = [{"filters": [
            {"dimension": "page", "operator": "contains", "expression": a.filter_page}]}]
    rows = call("POST", f"/webmasters/v3/sites/{quote(prop(), safe='')}/searchAnalytics/query", body).get("rows", [])
    print(f"{prop()}  {start} → {end}  dims={dims}  ({len(rows)} rækker)\n")
    if a.json:
        print(json.dumps(rows, ensure_ascii=False, indent=1)); return
    w = 70
    print(f"  {'nøgle':{w}} {'klik':>6} {'visn':>7} {'CTR':>6} {'pos':>5}")
    for r in rows:
        key = " | ".join(k.replace("https://shelterdk.dk", "") for k in r["keys"])[:w]
        print(f"  {key:{w}} {r['clicks']:6.0f} {r['impressions']:7.0f} {r['ctr']*100:5.1f}% {r['position']:5.1f}")
    tc = sum(r["clicks"] for r in rows); ti = sum(r["impressions"] for r in rows)
    print(f"\n  sum (viste rækker): {tc:.0f} klik · {ti:.0f} visninger · CTR {tc/ti*100 if ti else 0:.1f}%")


def cmd_inspect(a):
    for u in a.urls:
        if u.startswith("/"):
            u = "https://shelterdk.dk" + u
        res = call("POST", "/v1/urlInspection/index:inspect",
                   {"inspectionUrl": u, "siteUrl": prop(), "languageCode": "da"})
        ix = res.get("inspectionResult", {}).get("indexStatusResult", {})
        print(f"  {u.replace('https://shelterdk.dk','')}")
        print(f"      verdict {ix.get('verdict','?'):8} {ix.get('coverageState','?')}")
        print(f"      crawlet {str(ix.get('lastCrawlTime','aldrig'))[:10]}  canonical(google) "
              f"{str(ix.get('googleCanonical','–')).replace('https://shelterdk.dk','')}  robots {ix.get('robotsTxtState','?')}")
        time.sleep(0.3)  # kvote: 2000/dag, 600/min


QUESTION_RE = re.compile(
    r"^(hvad|hvor|hvordan|hvornår|hvilke|hvilken|kan man|må man|er der|skal man|hvem|hvorfor|findes der)\b",
    re.I,
)
POS_BUCKETS = [(1, 2.5, "1-2"), (2.5, 4.5, "3-4"), (4.5, 7.5, "5-7"), (7.5, 10.5, "8-10"),
               (10.5, 14.5, "11-14"), (14.5, 20.5, "15-20"), (20.5, 1e9, "21+")]


def _bucket(pos):
    for lo, hi, label in POS_BUCKETS:
        if lo <= pos < hi:
            return label
    return "21+"


def cmd_report(a):
    """Ugentlig status på de to ting vi styrer efter: CTR pr. position og AI-synlighed.

    CTR pr. position siger om svaret gives i resultatsiden frem for hos os —
    et fald ved uændret position er signalet. Spørgsmåls-queries vises separat,
    fordi de konverterer markant dårligere end andre på samme plads.
    """
    from urllib.parse import quote as _q
    P = _q(prop(), safe="")
    end = dt.date.today() - dt.timedelta(days=2)

    def window(days, offset=0):
        e = end - dt.timedelta(days=offset)
        s = e - dt.timedelta(days=days - 1)
        rows = call("POST", f"/webmasters/v3/sites/{P}/searchAnalytics/query",
                    {"startDate": s.isoformat(), "endDate": e.isoformat(),
                     "dimensions": ["query"], "rowLimit": 25000, "dataState": "final"}).get("rows", [])
        return rows, s, e

    cur, s1, e1 = window(a.days)
    prev, s2, e2 = window(a.days, a.days)

    def agg(rows, pred=None):
        out = collections.defaultdict(lambda: [0, 0])
        for r in rows:
            if pred and not pred(r["keys"][0]):
                continue
            b = _bucket(r["position"])
            out[b][0] += r["clicks"]
            out[b][1] += r["impressions"]
        return out

    def line(d, label):
        cells = []
        for _, _, b in POS_BUCKETS:
            c, i = d[b]
            cells.append(f"{(c / i * 100 if i else 0):6.2f}%")
        return f"  {label:14}" + "".join(cells)

    tc, ti = sum(r["clicks"] for r in cur), sum(r["impressions"] for r in cur)
    pc, pi = sum(r["clicks"] for r in prev), sum(r["impressions"] for r in prev)
    print(f"ShelterDK — {a.days} dage\n")
    print(f"  nu   {s1}–{e1}: {tc:6.0f} klik · {ti:8.0f} visn · CTR {tc / ti * 100:.2f}%")
    print(f"  før  {s2}–{e2}: {pc:6.0f} klik · {pi:8.0f} visn · CTR {pc / pi * 100:.2f}%\n")

    header = "  " + " " * 14 + "".join(f"{b:>7}" for _, _, b in POS_BUCKETS)
    print("CTR pr. position")
    print(header)
    print(line(agg(cur), "nu"))
    print(line(agg(prev), "før"))
    print(line(agg(cur, lambda q: QUESTION_RE.match(q)), "spørgsmål nu"))
    print(line(agg(cur, lambda q: not QUESTION_RE.match(q)), "øvrige nu"))

    qs = [r for r in cur if QUESTION_RE.match(r["keys"][0])]
    qi = sum(r["impressions"] for r in qs)
    qc = sum(r["clicks"] for r in qs)
    print(f"\n  spørgsmåls-queries: {len(qs)} · {qi:.0f} visn ({qi / ti * 100:.1f}% af alle) · {qc:.0f} klik")

    rows = call("POST", f"/webmasters/v3/sites/{P}/searchAnalytics/query",
                {"startDate": s1.isoformat(), "endDate": e1.isoformat(),
                 "dimensions": ["searchAppearance"], "rowLimit": 25, "dataState": "final"}).get("rows", [])
    if rows:
        print("\nRich results")
        for r in rows:
            print(f"  {r['keys'][0]:22} {r['clicks']:5.0f} klik · {r['impressions']:7.0f} visn · CTR {r['ctr'] * 100:.1f}%")
    print("\nAI-henviste klik tælles i affiliate_clicks (utm_source) — se scripts/ai_referrals.py")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("sites").set_defaults(fn=cmd_sites)
    sub.add_parser("sitemaps").set_defaults(fn=cmd_sitemaps)
    q = sub.add_parser("query")
    q.add_argument("--days", type=int, default=28)
    q.add_argument("--dim", default="page")
    q.add_argument("--filter-page", default=None)
    q.add_argument("--limit", type=int, default=50)
    q.add_argument("--json", action="store_true")
    q.set_defaults(fn=cmd_query)
    rep = sub.add_parser("report")
    rep.add_argument("--days", type=int, default=28)
    rep.set_defaults(fn=cmd_report)
    i = sub.add_parser("inspect")
    i.add_argument("urls", nargs="+")
    i.set_defaults(fn=cmd_inspect)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
