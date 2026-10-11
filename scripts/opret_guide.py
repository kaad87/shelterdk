"""Opretter en ny købsguide fra en JSON-fil — indhold, FAQ og produkter i ét.

Findes fordi en ny guide ellers skal sættes sammen i hånden over to tabeller,
og fordi en guide uden produkter eller uden topprædikat er en side, der ser
tom ud for brugeren og usund ud i vagtjobbet.

Scriptet nægter derfor at oprette en guide der:
  · peger på produkter der ikke kan købes
  · mangler et topprædikat (resolveAwards kan ikke uddele et, hvis alle
    entries har et prædikat — det skete for tarp, telt og drikkedunk)
  · har en parent_slug der ikke findes

Brug:  python3 scripts/opret_guide.py nye-guider.json [--dry-run]
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
    if os.path.isfile(p):
        for line in open(p):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)

from supabase import create_client

TOP = re.compile(r"^(?:vores valg|bedst i test|testvinder|redaktionens valg)$", re.I)
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HUB = os.path.join(ROOT, "web", "lib", "buying-guides-hub.ts")


def hub_kategorier():
    """Kategorier der har en navngiven gruppe på /bedste.

    Læses ud af HUB_GROUPS i TypeScript-filen frem for at gentages her, så de
    to lister ikke kan komme ud af trit. Står en guides kategori ikke i en
    gruppe, lander den i hub-sidens "Andet" — synligt som en navnløs sektion,
    og usynligt som manglende søskende-links, fordi relatedGuides kun finder
    søskende inden for gruppen. Det skete for powerbank, håndklæde og
    førstehjælp, og det var først synligt da hub-siden blev læst efter.
    """
    try:
        kilde = open(HUB, encoding="utf-8").read()
    except OSError:
        return None
    blok = re.search(r"HUB_GROUPS[^=]*=\s*\[(.*?)\n\];", kilde, re.S)
    if not blok:
        return None
    return {k for k in re.findall(r'"([a-z0-9_-]+)"', blok.group(1))}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fil")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"],
                       os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    plan = json.load(open(a.fil))
    eks = sb.table("buying_guides").select("slug,category").execute().data
    findes = {g["slug"] for g in eks}
    kat_for = {g["slug"]: g["category"] for g in eks}

    for slug, g in plan.items():
        print(f"\n=== {slug}")
        fejl = []
        if not SLUG.match(slug):
            fejl.append(f"slug '{slug}' må kun være små bogstaver, tal og bindestreger")
        if slug in findes:
            fejl.append(f"guiden findes allerede")
        if g.get("parent_slug") and g["parent_slug"] not in findes:
            fejl.append(f"parent_slug '{g['parent_slug']}' findes ikke")

        # category er NOT NULL i basen. Undersider arver forælderens værdi —
        # alle fire sovepose-guider står som category "sovepose" — så den
        # udledes, hvis den ikke er sat, frem for at vælte indsættelsen
        # halvvejs igennem.
        kat = g.get("category") or kat_for.get(g.get("parent_slug") or "")
        if not kat:
            fejl.append("category mangler og kan ikke udledes af parent_slug")
        else:
            kendte = hub_kategorier()
            if kendte is None:
                print("  [ADVARSEL] kunne ikke læse HUB_GROUPS — springer gruppe-tjek over")
            elif kat not in kendte:
                fejl.append(f"category '{kat}' har ingen gruppe i HUB_GROUPS — "
                            f"guiden ville havne i hub-sidens 'Andet' uden søskende-links")

        entries = g.get("entries", [])
        if not entries:
            fejl.append("ingen produkter")
        if not any(TOP.match((e.get("praedikat") or "").strip()) for e in entries):
            fejl.append("intet topprædikat — siden kan ikke vise et førstevalg")
        if len({(e.get("praedikat") or "").lower() for e in entries}) != len(entries):
            fejl.append("to produkter har samme prædikat")

        for e in entries:
            pid = e.get("produkt_id")
            p = sb.table("affiliate_products").select("product_name,price,in_stock,is_blocked") \
                .eq("id", pid).execute().data
            if not p:
                fejl.append(f"produkt {pid} findes ikke")
            elif not p[0]["in_stock"] or p[0]["is_blocked"]:
                fejl.append(f"produkt {pid} kan ikke købes")

        if fejl:
            for f in fejl:
                print(f"  [AFVIST] {f}")
            continue

        print(f"  {len(entries)} produkter · body_md {len(g.get('body_md') or '')} tegn · "
              f"{len(g.get('faq') or [])} FAQ")
        if a.dry_run:
            print("  [DRY-RUN] intet oprettet")
            continue

        rad = sb.table("buying_guides").insert({
            "slug": slug,
            "title": g["title"],
            "category": kat,
            "seo_title": g.get("seo_title"),
            "seo_description": g.get("seo_description"),
            "intro": g.get("intro"),
            "body_md": g.get("body_md"),
            "faq": g.get("faq"),
            "sources": g.get("sources"),
            "author": g.get("author", "ShelterDK Redaktionen"),
            "parent_slug": g.get("parent_slug"),
            "product_categories": g.get("product_categories"),
            "status": "published",
            "last_reviewed_at": __import__("datetime").date.today().isoformat(),
        }).execute().data[0]

        for rank, e in enumerate(entries):
            sb.table("buying_guide_entries").insert({
                "guide_id": rad["id"],
                "affiliate_product_id": e["produkt_id"],
                "rank": rank,
                "award_label": e.get("praedikat") or None,
                "score": e.get("score"),
                "best_for": e.get("bedst_til") or None,
                "editorial_note": e.get("note") or None,
                "pros": e.get("plus") or None,
                "cons": e.get("minus") or None,
            }).execute()
        print(f"  [OK] oprettet som /bedste/{slug} med {len(entries)} produkter")

    print("\nHusk at revalidere /bedste og de nye sider via /api/revalidate.")


if __name__ == "__main__":
    main()
