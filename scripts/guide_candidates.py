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
import collections, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "web", ".env.local")):
    if os.path.isfile(p):
        for line in open(p):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)

from supabase import create_client

MIN_BUYABLE = 5
# Må ikke afvige fra MIN_SURVIVORS i web/lib/guide-health.ts.
MIN_SURVIVORS = 2
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
    # Vinterguiden skal kun foreslå isolerede underlag. Det brede filter
    # foreslog uisolerede skumm-måtter til en guide om vinterbrug.
    "liggeunderlag-til-vinter": r"(?=.*(?:liggeunderlag|sleeping mat|selvoppustelig))"
                               r"(?=.*(?:insulated|isoleret|vinter|extreme|thermal))",
    "liggeunderlag": r"liggeunderlag|selvoppustelig|sleeping mat",
    "sovepose": r"sovepose",
    "sommersovepose": r"sovepose",
    "sovepose-til-vinter": r"sovepose",
    # Børnevarianten må ikke falde tilbage på den brede sovepose-søgning;
    # de andre forhandlere har masser af voksenposer og næsten ingen børne.
    "sovepose-til-boern": r"(?=.*sovepose)(?=.*(?:b[øo]rn|kids|junior|barn))",

    # De 17 guider nedenfor havde intet navnefilter og faldt derfor tilbage på
    # category_mapped, som mangler på 6.722 af feedets 16.772 varer. Resultatet
    # var ubrugelige oplæg, der så ud som om feedet intet havde: tændstål-guiden
    # fik foreslået sporks og stegepander, pandelampe-guiden en væge til en
    # lanterne. Målt med filtrene her har outmore 23 tændstål og 278
    # pandelamper, så koncentrationen var et værktøjsproblem og ikke en
    # begrænsning i feedet.
    "taendstaal": r"t[æa]ndst[åa]l|ildst[åa]l|fire ?steel|firesteel|ferro|"
                  r"opt[æa]nding|tinder|fire starter",
    "pandelampe": r"pandelampe|headlamp|hovedlampe",
    "kompas": r"kompas|compass",
    "hue": r"\bhue\b|beanie|\bcap\b",
    "handsker": r"handske|glove|mitten|luffe",
    "dry-bag": r"dry.?bag|vandt[æa]t pose|pakpose|stuff sack",
    "frysetorret-mad": r"fryset[øo]rret|freeze.?dried|expedition meal",
    "uldundertoj": r"undertr[øo]je|underbukser|merino|base ?layer|uldunder",
    "siddeunderlag": r"siddeunderlag|sit ?pad|siddepude",
    "vandresokker": r"sokker|sock|str[øo]mper",
    "regntoj": r"regnjakke|regnbukser|regnt[øo]j|rain ?jacket|rain ?pant|regns[æa]t|poncho",
    "vandfilter": r"vandfilter|water ?filter|lifestraw|vandrens|purifier|squeeze filter",
    "haengekoje": r"h[æa]ngek[øo]je|hammock",
    "vandrestovler": r"vandrest[øo]vle|vandresko|hiking boot|trekking.?st[øo]vle|hiking shoe",
    "kniv": r"\bkniv\b|\bknife\b|multiv[æa]rkt[øo]j|multi.?tool",
    "campingstol": r"campingstol|klapstol|festivalstol|foldestol|lejrstol|"
                   r"camp chair|camping chair|\bstol\b",
    "stormkoekken": r"stormk[øo]kken|trangia|brænder|br[æa]nder|gasbr[æa]nder|jetboil|"
                    r"primus|gryde|koges[æa]t|cook ?set|cook ?pot",
}
# Udelukker tilbehør og varianter der ikke hører til guiden.
#
# Listerne er vokset, fordi navnefilteret nu søger hele lageret og dermed også
# finder alt det, der blot har guidens ord i navnet. Målt på oplægget foreslog
# drikkedunk-guiden et låg, en bidventil og en brændstofflaske; gamacher-guiden
# halsedisser og cykel-skoovertræk; sovepude-guiden sokker og handsker. Et
# oplæg man ikke kan bruge er lige så ubrugeligt som intet oplæg.
EXCLUDE = {
    # Hængekøjestole ligner campingstole i navnet og er noget helt andet; de
    # kom med da navnefilteret begyndte at søge hele lageret.
    "campingstol": r"bord|table|seng|\bbed\b|cover|taske|pude|hynde|"
                   r"h[æa]ngek[øo]je|hammock|tilbeh[øo]r",
    "telt": r"underlag|footprint|stang|pløk|pegs|reparation|telttæppe|fortelt|tarp|"
            r"hammer|wire|\bbox\b|kasse|survival|overlevelses|glamping|oppustelig|"
            r"tilbeh[øo]r|clips|impr[æa]gnering",
    "sovepude": r"liggeunderlag|sovepose|\bsok|\bsock|handske|glove|betr[æa]k|"
                r"plush|\belf\b|dinosaur|animal|foam pad|eye mask",
    # Alt der har "flaske" i navnet er ikke en drikkedunk: låg, bidventiler,
    # flaskeholdere og brændstofflasker kom alle med.
    "drikkedunk": r"filter|rens|\blid\b|l[åa]g|valve|ventil|sheath|holder|"
                  r"fuel|br[æa]ndstof|tilbeh[øo]r|accessory|betr[æa]k|b[æa]lt|belt",
    # Halsedisser og cykel-skoovertræk hedder også "gaiter" på engelsk.
    "gamacher": r"neck|\bhals|halsedisse|bike|cykel|shoecover|skoovertr[æa]k",
    # Sommerguiden skal ikke foreslå børne- eller vintersoveposer.
    "sommersovepose": r"b[øo]rne|\bkids\b|junior|survival",
    "liggeunderlag-til-vinter": r"siddeunderlag|sidde",
    "tarp": r"clips|stang|stange|\bpole\b|poncho|h[æa]ngek[øo]je|hammock|tilbeh[øo]r",
    # Optænding og tændstål deler guide, men ikke pander og gryder.
    "taendstaal": r"spork|bestik|snack|jug|skillet|\bpan\b|gryde|pot\b|br[æa]nder|"
                  r"lanterne|v[æa]ge|tilbeh[øo]r",
    "pandelampe": r"batteri|\bcell\b|opladning|tilbeh[øo]r|lanterne|v[æa]ge|"
                  r"lommelampe|flashlight",
    "hue": r"\bcap\b.*skrue|h[æa]tte til|d[æa]ksel",
    "handsker": r"ovnhandske|handskerum",
    "vandresokker": r"sutsko|skosnor|indl[æa]gss[åa]l",
    "uldundertoj": r"\bsokker\b|\bsock\b|\bhue\b|handske|t-shirt til hund",
    "siddeunderlag": r"liggeunderlag",
    "haengekoje": r"stativ|monteringss[æa]t|treemount|strop|tilbeh[øo]r|tarp",
    "kniv": r"skede|slibe|whetstone|tilbeh[øo]r|lommelygte",
    "stormkoekken": r"tilbeh[øo]r|rengøring|rens|gasd[åa]se|br[æa]ndstof|fuel|v[æa]ge",
    "vandfilter": r"reservedel|erstatnings|replacement|tilbeh[øo]r",
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
        for r in sb.table("affiliate_products").select("id,product_name,price,in_stock,is_blocked,retailer").in_("id", pids[i:i + 200]).execute().data:
            prods[r["id"]] = r

    out = ["# Oplæg: huller i købsguiderne", "",
           "Guider der kræver opmærksomhed: under %d købbare produkter, eller under %d varer tilbage hvis den største forhandler forsvandt. For hver: nuværende opstilling, hvad der mangler, og kandidater fra feed'et." % (MIN_BUYABLE, MIN_SURVIVORS),
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

        # To grunde til at en guide skal med i oplægget. Den åbenlyse er for få
        # købbare produkter. Den anden er koncentration: en guide med otte
        # varer, der alle ligger hos samme forhandler, ser sund ud og er ét
        # feed-skift fra nul — det var præcis campingstols tilstand ugen før
        # den døde. Uden den anden grund kunne værktøjet ikke bruges til at
        # rette det, som vagtjobbet rapporterer.
        har = collections.Counter(
            p["retailer"] for e in live
            if (p := prods.get(e["affiliate_product_id"])) and p.get("retailer")
        )
        i_alt_live = sum(har.values())
        top_n = har.most_common(1)[0][1] if har else 0
        overlever = i_alt_live - top_n
        for_tynd = len(live) < MIN_BUYABLE
        for_samlet = bool(har) and overlever < MIN_SURVIVORS
        if not for_tynd and not for_samlet:
            continue

        dead = [e for e in mine if e not in live]
        # En koncentreret men fuldtallig guide mangler ikke antal, men nok
        # varer fra ANDRE forhandlere til at den ikke kan gå i nul. Andelen
        # alene er den forkerte målestok: at bringe alle koncentrerede guider
        # under 60% kostede 93 produkter, mens gulvet på to overlevende koster
        # 10 og fjerner netop den tilstand campingstol endte i.
        mangler = max(MIN_BUYABLE - len(live), 0) if for_tynd else (MIN_SURVIVORS - overlever)

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
        # Ved ellers lige kandidater kommer den forhandler, guiden har mindst
        # af, først; derefter backpackerlife (se memory/aftale).
        cands.sort(key=lambda c: (
            c["price"] or 0,
            har.get(c["retailer"], 0),
            0 if c["retailer"] == "backpackerlife" else 1,
        ))
        # Når guidens problem ER koncentration, skal kortlisten vise det der
        # løser det. Uden dette fyldte prisspredningen listen med netop den
        # forhandler, guiden havde for meget af: pandelampe-guiden fik ét
        # alternativ, skønt backpackerlife har 41 pandelamper i feedet.
        if for_samlet and har:
            top_forh = har.most_common(1)[0][0]
            fra_andre = [c for c in cands if c["retailer"] != top_forh]
            if len(fra_andre) >= mangler:
                cands = fra_andre

        step = max(1, len(cands) // 12)
        shortlist = cands[::step][:12]

        # Sørg for at hver forhandler, guiden mangler, er repræsenteret i
        # kortlisten — ellers kan prisspredningen alene udelukke netop den
        # forhandler, der ville fjerne svigtpunktet.
        for forh in sorted({c["retailer"] for c in cands} - {c["retailer"] for c in shortlist}):
            ekstra = next((c for c in cands if c["retailer"] == forh), None)
            if ekstra:
                shortlist.append(ekstra)

        if i_alt_live:
            top, n = har.most_common(1)[0]
            konc = (f"Forhandlere nu: " + ", ".join(f"{k} {v}" for k, v in har.most_common())
                    + (f" — kun **{overlever}** ville overleve uden {top}. "
                       f"Vælg fra en anden forhandler, så guiden ikke kan gå i nul."
                       if overlever < MIN_SURVIVORS else ""))
        else:
            konc = ""

        out += [f"## /bedste/{g['slug']} — {g['title']}", "",
                f"**{len(live)} købbare af {len(mine)}. Mangler {mangler}.**", ""]
        if konc:
            out += [konc, ""]
        out += ["",
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
