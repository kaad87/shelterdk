"""
Oplæg til at fylde huller i købsguiderne.

Skriver koebsguide-oplaeg.md: én sektion pr. guide med for få købbare produkter,
med nuværende opstilling, hvilke prædikater der mangler, og kandidater fra
feed'et — med produkt-id, pris, tilbud og forhandlerens egen beskrivelse.

Beskrivelsen er forhandlerens, ikke vores: den er råmateriale til at skrive
noten, ikke noget der kan kopieres direkte ind. Feed'et har ingen specs
(vægt, temperatur, mål), så de påstande skal komme fra dig.

Brug:  python3 scripts/guide_candidates.py            # skriv oplæg
       python3 scripts/guide_candidates.py --apply valg.json   # opret entries
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
    if os.path.isfile(p):
        for line in open(p):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)

from supabase import create_client

MIN_BUYABLE = 5
OUT = os.path.join(ROOT, "koebsguide-oplaeg.md")

# Kategorierne i feed'et er brede ("beklædning" rummer alt fra huer til gamacher),
# så hver guide har et navne-filter. Uden det foreslår vi sokker til tarp-guiden.
NAME_FILTER = {
    "drikkedunk": r"drikkedunk|drikkeflaske|flaske|bottle",
    "tarp": r"\btarp\b",
    "campingstol": r"stol\b|chair",
    "myggenet": r"myggenet|myggeslør|moskito|mosquito|insektnet",
    "sovepude": r"pude|pillow|lagenpose|liner",
    "telt": r"\btelt\b|tent",
    "gamacher": r"gamache|gaiter",
    "liggeunderlag-til-vinter": r"liggeunderlag|selvoppustelig|sleeping mat",
    "liggeunderlag": r"liggeunderlag|selvoppustelig|sleeping mat",
    "sovepose": r"sovepose",
    "sommersovepose": r"sovepose",
    "sovepose-til-vinter": r"sovepose",
    "sovepose-til-boern": r"sovepose",
}
# Udelukker tilbehør og varianter der ikke hører til guiden.
EXCLUDE = {
    # Hængekøjestole ligner campingstole i navnet og er noget helt andet; de
    # kom med da navnefilteret begyndte at søge hele lageret.
    "campingstol": r"bord|table|seng|\bbed\b|cover|taske|pude|hynde|"
                   r"h[æa]ngek[øo]je|hammock|tilbeh[øo]r",
    "telt": r"underlag|footprint|stang|pløk|pegs|reparation|telttæppe|fortelt|tarp",
    "sovepude": r"liggeunderlag|sovepose",
    "drikkedunk": r"filter|rens",
}


def navn(c):
    """Feed'et gentager ofte mærket i produktnavnet — undgå "Easy Camp Easy Camp …"."""
    n = (c["product_name"] or "").strip()
    b = (c["brand"] or "").strip()
    return n if not b or n.lower().startswith(b.lower()) else f"{b} {n}"


def desc(c):
    d = re.sub(r"\[kad_youtube[^\]]*\]", "", (c["description"] or ""))
    return re.sub(r"\s+", " ", d).strip()


def money(n):
    return f"{n:,.0f}".replace(",", ".") if n is not None else "—"


def main():
    apply_file = None
    if "--apply" in sys.argv:
        apply_file = sys.argv[sys.argv.index("--apply") + 1]

    sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    if apply_file:
        return apply_choices(sb, apply_file)

    guides = sb.table("buying_guides").select("id,slug,title,product_categories").execute().data
    entries = sb.table("buying_guide_entries").select("guide_id,rank,award_label,score,affiliate_product_id").execute().data
    pids = [e["affiliate_product_id"] for e in entries]
    prods = {}
    for i in range(0, len(pids), 200):
        for r in sb.table("affiliate_products").select("id,product_name,price,in_stock,is_blocked").in_("id", pids[i:i + 200]).execute().data:
            prods[r["id"]] = r

    out = ["# Oplæg: huller i købsguiderne", "",
           "Guider med under %d købbare produkter. For hver: nuværende opstilling, hvad der mangler, og kandidater fra feed'et." % MIN_BUYABLE,
           "",
           "Kolonnen **id** er `affiliate_product_id` — den skal du bruge i valg.json.",
           "Forhandler: `backpackerlife` foretrækkes ved ellers lige kandidater.",
           "Feed'et har **ingen specs** (vægt, temperatur, mål). Beskrivelsen er forhandlerens egen tekst og er råmateriale, ikke noget der kan bruges ordret.",
           ""]

    # Hele det købbare lager, hentet én gang. Supabase sender højst 1.000
    # rækker pr. kald, så uden sideopdeling ser man kun toppen af feed'et.
    lager, off = [], 0
    while True:
        side = sb.table("affiliate_products").select(
            "id,brand,product_name,price,price_original,retailer,description,category_mapped"
        ).eq("in_stock", True).eq("is_blocked", False).range(off, off + 999).execute().data
        lager += side
        if len(side) < 1000:
            break
        off += 1000
    print(f"{len(lager)} købbare produkter i feed'et")

    plan = {}
    for g in sorted(guides, key=lambda x: x["slug"]):
        mine = [e for e in entries if e["guide_id"] == g["id"]]
        live = [e for e in mine if (p := prods.get(e["affiliate_product_id"])) and p["in_stock"] and not p["is_blocked"]]
        if len(live) >= MIN_BUYABLE:
            continue
        dead = [e for e in mine if e not in live]
        mangler = MIN_BUYABLE - len(live)

        used = {e["affiliate_product_id"] for e in mine}
        keep = NAME_FILTER.get(g["slug"])
        drop = EXCLUDE.get(g["slug"])
        kats = set(g["product_categories"] or [])

        # Kategorien må ikke være en port. 6.722 af feed'ets 16.766 produkter
        # har slet ingen category_mapped, og nogle er direkte forkerte — tre
        # Treklife-stole står som "gave". Da campingstol-guiden kun hentede
        # kandidater via kategori, fandt den seks stole til 850-3.149 kr og
        # ingen af de syv under 700 kr, som er netop det prisleje guiden er
        # bygget til. Navnefilteret søger derfor hele lageret, og kategorien
        # bruges kun hvor guiden ikke har et navnefilter.
        cands = [
            c for c in lager
            if c["id"] not in used
            and (re.search(keep, c["product_name"] or "", re.I) if keep
                 else c.get("category_mapped") in kats)
            and not (drop and re.search(drop, c["product_name"] or "", re.I))
        ]
        # Spred over prisklasser: billigst, dyrest og jævnt fordelt derimellem.
        # Backpackerlife foretrækkes i kuraterede lister (se memory/aftale), så
        # ved ellers lige kandidater står de først.
        cands.sort(key=lambda c: (c["price"] or 0, 0 if c["retailer"] == "backpackerlife" else 1))
        step = max(1, len(cands) // 12)
        shortlist = cands[::step][:12]

        out += [f"## /bedste/{g['slug']} — {g['title']}", "",
                f"**{len(live)} købbare af {len(mine)}. Mangler {mangler}.**", "",
                "Nu på siden:", ""]
        for e in sorted(mine, key=lambda x: x["rank"]):
            p = prods.get(e["affiliate_product_id"], {})
            status = "" if p.get("in_stock") and not p.get("is_blocked") else " — **UDSOLGT**"
            out.append(f"- `{e['award_label'] or '(intet prædikat)'}` · {p.get('product_name','?')} · {money(p.get('price'))} kr · {e['score']}/10{status}")
        out += ["", f"Kandidater ({len(cands)} relevante i feed'et, {len(shortlist)} vist fordelt på pris):", "",
                "| id | produkt | pris | før | forhandler |", "|---|---|---|---|---|"]
        for c in shortlist:
            sale = money(c["price_original"]) if c["price_original"] and c["price_original"] > c["price"] else ""
            out.append(f"| `{c['id']}` | {navn(c)} | {money(c['price'])} kr | {sale} | {c['retailer']} |")
        beskrivelser = [(c, desc(c)) for c in shortlist if desc(c)]
        if beskrivelser:
            out += ["", "<details><summary>Forhandlerens beskrivelser (råmateriale)</summary>", ""]
            for c, d in beskrivelser:
                out.append(f"- **{navn(c)}**: {d[:320]}")
            out += ["", "</details>", ""]
        else:
            out += ["", "_Ingen af kandidaterne har beskrivelse i feed'et — produktnavn og pris er alt vi ved._", ""]

        plan[g["slug"]] = [{"produkt_id": "", "praedikat": "", "score": None, "bedst_til": "", "note": "", "plus": [], "minus": []} for _ in range(mangler)]

    open(OUT, "w").write("\n".join(out))
    skel = os.path.join(ROOT, "koebsguide-valg.eksempel.json")
    json.dump(plan, open(skel, "w"), ensure_ascii=False, indent=2)
    print(f"Skrevet {OUT} ({len(plan)} guider)")
    print(f"Skabelon til dine valg: {skel}")
    print("Udfyld den og kør:  python3 scripts/guide_candidates.py --apply koebsguide-valg.json")


def apply_choices(sb, path):
    """Opretter entries ud fra din udfyldte JSON. Springer tomme poster over."""
    plan = json.load(open(path))
    added = 0
    for slug, rows in plan.items():
        g = sb.table("buying_guides").select("id").eq("slug", slug).single().execute().data
        existing = sb.table("buying_guide_entries").select("rank").eq("guide_id", g["id"]).execute().data
        next_rank = max((e["rank"] for e in existing), default=-1) + 1
        for r in rows:
            if not r.get("produkt_id"):
                continue
            p = sb.table("affiliate_products").select("id,in_stock,is_blocked").eq("id", r["produkt_id"]).execute().data
            if not p:
                print(f"  [SPRING] {slug}: produkt {r['produkt_id']} findes ikke"); continue
            if not p[0]["in_stock"] or p[0]["is_blocked"]:
                print(f"  [SPRING] {slug}: {r['produkt_id']} er udsolgt/blokeret"); continue
            sb.table("buying_guide_entries").insert({
                "guide_id": g["id"], "affiliate_product_id": r["produkt_id"], "rank": next_rank,
                "award_label": r.get("praedikat") or None, "score": r.get("score"),
                "best_for": r.get("bedst_til") or None, "editorial_note": r.get("note") or None,
                "pros": r.get("plus") or None, "cons": r.get("minus") or None,
            }).execute()
            next_rank += 1; added += 1
            print(f"  [OK] {slug}: {r['produkt_id']} som '{r.get('praedikat') or 'uden prædikat'}'")
        sb.table("buying_guides").update({"last_reviewed_at": __import__("datetime").date.today().isoformat()}).eq("id", g["id"]).execute()
    print(f"\n{added} entries oprettet. Husk at revalidere:")
    print('  curl -X POST https://shelterdk.dk/api/revalidate -H "x-admin-secret: $ADMIN_SECRET" \\')
    print("""    -H "Content-Type: application/json" -d '{"paths":["/bedste/<slug>"]}'""")


if __name__ == "__main__":
    main()
