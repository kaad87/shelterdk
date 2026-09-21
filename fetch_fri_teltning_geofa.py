"""
Henter Naturstyrelsens/kommunernes "Fri teltning"-områder fra GeoFA
(t_5801_fac_fl, facil_ty_k = 3071) og skriver to statiske filer:

  web/public/data/fri-teltning.json        GeoJSON, forenklet geometri (kortet)
  web/public/data/fri-teltning-index.json  liste uden geometri (siden + sitemap)

Statisk JSON frem for DB: data ændrer sig sjældent, siden er ISR-bygget, og det
holder Supabase-egress på nul for en side der kan blive stor i sæson.
Kommunenavn slås op via DAWA (kommunekode → navn); region via kommune_to_landsdel
og kanoniseres til DB'ens fire regionsnavne (samme princip som importen).

Brug:  python3 fetch_fri_teltning_geofa.py
"""
import html, json, os, re, sys, unicodedata
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backfill_region_from_kommune import kommune_to_landsdel

GEOFA = "https://geofa.geodanmark.dk/api/v2/sql/fkg"
DAWA = "https://api.dataforsyningen.dk/kommuner?struktur=mini"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web", "public", "data")
# ~20 m ved 56°N. Rå polygoner er 5-10 MB; kortet behøver ikke skovbryn på meterniveau.
SIMPLIFY_DEG = 0.0002

REGION_KANONISK = {"Sjælland": "Sjælland og Øerne", "Fyn og Øerne": "Fyn"}


def slugify(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = s.replace("æ", "ae").replace("ø", "oe").replace("å", "aa")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def clean_name(s):
    """'Fri teltning i Alheden Skov' / 'Gludsted Plantage, Fri teltning' → stednavnet."""
    raw = s.strip()
    n = re.sub(r"^\s*fri(t)?\s+teltning(s\s*område|somr\.?)?\s*(i|-|:|,)?\s*", "", raw, flags=re.I)
    n = re.sub(r"\s*[,(-]?\s*fri(t)?\s+teltning(s\s*område|somr\.?|\s*omr\.?|\s*område)?\s*\)?\s*$", "", n, flags=re.I)
    return n.strip(" ,-") or raw


def clean_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>|</p>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def main():
    kommuner = {int(k["kode"]): k["navn"] for k in requests.get(DAWA, timeout=30).json()}

    q = f"""
      SELECT objekt_id, trim(navn) AS navn, lang_beskr, trim(beskrivels) AS beskrivels,
             trim(ansvar_org) AS ansvar_org, trim(kontak_ved) AS kontakt, trim(link) AS link,
             beliggenhedskommune AS kommunekode, vandhane, betaling, book,
             round((ST_Area(ST_Transform(geometri,25832))/10000)::numeric,1) AS ha,
             ST_Y(ST_Transform(ST_Centroid(geometri),4326)) AS lat, ST_X(ST_Transform(ST_Centroid(geometri),4326)) AS lng,
             ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_Transform(geometri,4326),{SIMPLIFY_DEG}),5) AS geom
      FROM fkg.t_5801_fac_fl
      WHERE facil_ty_k = 3071 AND statuskode = 3 AND off_kode = 1
      ORDER BY navn
    """
    r = requests.get(GEOFA, params={"q": q, "srs": "4326"}, timeout=120)
    r.raise_for_status()
    feats = r.json()["features"]

    index, geo, seen = [], [], {}
    for f in feats:
        p = f["properties"]
        navn = clean_name(p["navn"] or "")
        kk = int(p["kommunekode"]) if p.get("kommunekode") else None
        kommune = kommuner.get(kk)
        region = kommune_to_landsdel(kommune) if kommune else None
        region = REGION_KANONISK.get(region, region) if region else None
        base = slugify(navn) or p["objekt_id"][:8]
        slug = base
        n = 2
        while slug in seen:
            slug = f"{base}-{n}"; n += 1
        seen[slug] = True
        beskr = clean_html(p.get("lang_beskr")) or (p.get("beskrivels") or "").strip()
        row = {
            "id": p["objekt_id"],
            "slug": slug,
            "name": navn,
            "kommune": kommune,
            "kommunekode": kk,
            "region": region,
            "org": p.get("ansvar_org") or None,
            "contact": p.get("kontakt") or None,
            "link": (p.get("link") or None) or None,
            "ha": float(p["ha"]) if p.get("ha") is not None else None,
            "lat": round(p["lat"], 5),
            "lng": round(p["lng"], 5),
            "water": (p.get("vandhane") or "").strip() == "Ja",
            "description": beskr or None,
        }
        index.append(row)
        geo.append({"type": "Feature", "properties": {"slug": slug, "name": navn, "kommune": kommune, "ha": row["ha"]},
                    "geometry": json.loads(p["geom"])})

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "fri-teltning-index.json"), "w") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "fri-teltning.json"), "w") as fh:
        json.dump({"type": "FeatureCollection", "features": geo}, fh, ensure_ascii=False, separators=(",", ":"))

    regions = {}
    for row in index:
        regions[row["region"]] = regions.get(row["region"], 0) + 1
    print(f"{len(index)} områder · {sum(r['ha'] or 0 for r in index):,.0f} ha · regioner {regions}")
    print(f"  uden kommune: {sum(1 for r in index if not r['kommune'])} · uden beskrivelse: {sum(1 for r in index if not r['description'])}")
    for fn in ("fri-teltning-index.json", "fri-teltning.json"):
        print(f"  {fn}: {os.path.getsize(os.path.join(OUT_DIR, fn))/1024:.0f} KB")


if __name__ == "__main__":
    main()
