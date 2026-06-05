"""
SCOPED udinaturen-billed-scraping — KUN for de 8 nye shelters.
Eksisterende shelters røres ALDRIG (filtreret på NEW_SLUGS).
Bruger source_id (= udinaturen-facilitets-id) til at bygge URL'en.
Kræver ikke Google-billing.
"""
import os, time, requests
from supabase import create_client
from fetch_udinaturen_images import extract_image_urls, _fetch_images_playwright, HEADERS

NEW_SLUGS = [
    "havbade-shelteret-93643",
    "shelterplads-ved-ega-engso-to-sheltere-iv-og-v-10219",
    "aktivitetspladsen-ved-hundslund-hallen-10055",
    "sandgraven-i-tisted-10033",
    "vester-assels-byshelter-86480",
    "skamstrup-mollebakke-11489",
    "knudepunktet-bording-92733",
    "soerne-i-norklit-90254",
]

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
assert url and key, "Mangler URL / SERVICE_ROLE_KEY"
sb = create_client(url, key)

rows = sb.table("shelters").select("id,title,slug,source_id,image_url").in_("slug", NEW_SLUGS).execute().data or []
print(f"Behandler {len(rows)} nye shelters (kun disse).\n")

updated = 0
no_img = 0
for s in rows:
    sid = (str(s.get("source_id") or "")).strip().lower()
    title = s.get("title")
    if not sid:
        print(f"  [SPRING] {title}: ingen source_id"); continue
    facility_url = f"https://udinaturen.dk/facilitet/?id={sid}"
    urls = []
    try:
        resp = requests.get(facility_url, headers=HEADERS, timeout=20)
        if resp.status_code == 200:
            urls = extract_image_urls(resp.text)
        if not urls:
            urls = _fetch_images_playwright(facility_url)  # JS-renderet fallback
    except Exception as e:
        print(f"  [FEJL] {title}: {e}"); continue
    if not urls:
        no_img += 1
        print(f"  [INTET BILLEDE] {title}  ({facility_url})")
        continue
    sb.table("shelters").update({
        "image_url": urls[0],
        "image_urls": urls,
    }).eq("id", s["id"]).execute()
    updated += 1
    print(f"  [OK] {title}: {len(urls)} billede(r) → {urls[0][:70]}")
    time.sleep(0.5)

print("\n" + "=" * 50)
print(f"FÆRDIG (kun {len(NEW_SLUGS)} nye berørt)")
print(f"  Billeder sat: {updated}")
print(f"  Uden billede: {no_img}")
print("=" * 50)
