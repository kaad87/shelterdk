"""
SCOPED udinaturen-billed-scraping — KUN for de nye shelters i NEW_SLUGS.
Eksisterende shelters røres ALDRIG (filtreret på NEW_SLUGS).
Bruger source_id (= udinaturen-facilitets-id) til at bygge URL'en.
Kræver ikke Google-billing.
"""
import os, time, requests
from supabase import create_client
from fetch_udinaturen_images import extract_image_urls, _fetch_images_playwright, HEADERS

# Opdateret til GeoFA-importen 2026-08-08 (11 nye shelters).
# Forhåndstestet mod udinaturen: alle 11 har billeder via ren HTTP (49 i alt),
# ingen krævede Playwright-fallback.
NEW_SLUGS = [
    "sohoj-telt-og-shelterplads-11910",
    "vorgod-primitive-lejrplads-engtoften-19-6920-videbaek-87087",
    "vorgod-primitive-lejrplads-engtoften-19-6920-videbaek-87091",
    "st-jyndevad-shelterplads-en-del-af-alandet-91501",
    "hevring-shelter-10394",
    "mejerivej-3-gredsted-6771-gredstedbro-87548",
    "to-2-mands-shelter-ved-bjorno-vingard-10238",
    "shelter-ved-abildhede-87309",
    "shelter-i-larsens-skov-86609",
    "granada-skoven-94375",
    "shelter-bogense-havn-10076",
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
