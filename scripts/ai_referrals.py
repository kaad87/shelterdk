"""
AI-synlighed målt på vores egne data: klik der kommer fra en AI-assistent.

ChatGPT, Copilot og Perplexity hænger deres egen utm_source på links, de sender
videre. Den parameter følger med ind i `affiliate_clicks.path`, så vi kan tælle
dem uden ekstra analytics. Det er den eneste direkte måling vi har af, om vi
bliver citeret — Search Console viser ikke AI Overviews separat.

Brug:  python3 scripts/ai_referrals.py [--days 90]
"""
import argparse, collections, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
    if os.path.isfile(p):
        for line in open(p):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)

from supabase import create_client

ASSISTENTER = [
    ("ChatGPT", r"chatgpt"),
    ("Copilot", r"copilot"),
    ("Perplexity", r"perplexity"),
    ("Gemini", r"gemini|bard"),
    ("Claude", r"claude\.ai"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90)
    a = ap.parse_args()

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    import datetime as dt
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=a.days)).isoformat()
    rows = sb.table("affiliate_clicks").select("created_at,path,product_name,price_dkk").gte("created_at", since).execute().data

    per_kilde = collections.Counter()
    per_side = collections.Counter()
    maaned = collections.Counter()
    ialt = len(rows)
    for r in rows:
        path = r["path"] or ""
        for navn, pat in ASSISTENTER:
            if re.search(pat, path, re.I):
                per_kilde[navn] += 1
                per_side[path.split("?")[0]] += 1
                maaned[(navn, r["created_at"][:7])] += 1
                break

    ai = sum(per_kilde.values())
    print(f"Sidste {a.days} dage: {ialt} affiliate-klik i alt, heraf {ai} fra en AI-assistent "
          f"({ai / ialt * 100 if ialt else 0:.1f}%)\n")
    if not ai:
        print("  Ingen AI-henviste klik i perioden.")
        return
    print("Kilde")
    for navn, n in per_kilde.most_common():
        print(f"  {navn:12} {n:4}")
    print("\nSide")
    for side, n in per_side.most_common(12):
        print(f"  {side[:46]:46} {n:4}")
    print("\nPr. måned")
    for (navn, m), n in sorted(maaned.items(), key=lambda x: x[0][1]):
        print(f"  {m}  {navn:12} {n:3}")


if __name__ == "__main__":
    main()
