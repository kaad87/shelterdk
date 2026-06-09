"""
enrich_new_shelters_images.py
=============================
SCOPED Google Places-berigelse — kører KUN for de nye shelters angivet i
NEW_SLUGS. Eksisterende shelters røres ALDRIG (alle DB-kald er filtreret på
disse slugs / deres id'er).

Genbruger matchnings-logikken fra fetch_google_places.py (import), men med:
  - service-role-nøgle (så updates kan gennemføres trods RLS)
  - select afgrænset til NEW_SLUGS
Sætter google_place_id + upserter google_places (med photo_references), så
billeder renderes via /api/google-photo.
"""
import os
from datetime import datetime, timezone

# Import genbruger funktioner + konstanter + env-load fra fetch_google_places
import fetch_google_places as fgp
from supabase import create_client

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
# Service-role KRÆVES til writes (RLS). Eksporteres af kalde-kommandoen.
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
assert url and key and api_key, "Mangler URL / SERVICE_ROLE_KEY / GOOGLE_MAPS_API_KEY"

sb = create_client(url, key)

# Hent KUN de nye shelters
rows = (
    sb.table("shelters")
    .select("id,title,slug,location,google_place_id")
    .in_("slug", NEW_SLUGS)
    .execute()
    .data
) or []
print(f"Fundet {len(rows)} af {len(NEW_SLUGS)} nye shelters i DB.\n")

matched = 0
no_match = 0
errors = 0

for row in rows:
    lon, lat = fgp.parse_point(row.get("location"))
    title = (row.get("title") or "").strip()
    if lon is None or lat is None:
        print(f"  [SPRING] {title}: ingen koordinater")
        continue
    try:
        candidates = fgp.nearby_search(api_key, lat, lon, fgp.NEARBY_RADIUS_M)
        cand, score, dist_m = fgp.best_candidate(title, lat, lon, candidates)
        if not cand:
            no_match += 1
            print(f"  [INTET MATCH] {title}")
            continue
        details = fgp.place_details(api_key, cand["place_id"])
        place_id = details["place_id"]

        # Upsert google_places (photo_references → billeder)
        sb.table("google_places").upsert({
            "google_place_id": place_id,
            "name": details.get("name"),
            "lat": details.get("lat"),
            "lng": details.get("lng"),
            "rating": details.get("rating"),
            "user_ratings_total": details.get("user_ratings_total"),
            "photo_references": details.get("photo_references"),
            "raw_json": details.get("raw_json"),
        }, on_conflict="google_place_id").execute()

        # Reviews
        reviews = (details.get("raw_json") or {}).get("reviews") or []
        if reviews:
            rr = []
            for rv in reviews:
                ts = None
                t = rv.get("time")
                if isinstance(t, (int, float)):
                    ts = datetime.fromtimestamp(t, tz=timezone.utc).isoformat()
                rr.append({
                    "google_place_id": place_id,
                    "author_name": rv.get("author_name"),
                    "rating": rv.get("rating"),
                    "text": rv.get("text"),
                    "relative_time_description": rv.get("relative_time_description"),
                    "time": ts,
                    "raw_json": rv,
                })
            sb.table("google_place_reviews").delete().eq("google_place_id", place_id).execute()
            sb.table("google_place_reviews").insert(rr).execute()

        auto = score >= fgp.MIN_SCORE_AUTO_MATCH and (dist_m or 999) <= fgp.MAX_DISTANCE_AUTO_M
        sb.table("shelter_google_match").upsert({
            "shelter_id": row["id"],
            "google_place_id": place_id,
            "match_score": round(score, 4),
            "distance_meters": round(dist_m, 2) if dist_m is not None else None,
            "auto_matched": auto,
        }, on_conflict="shelter_id,google_place_id").execute()

        n_photos = len(details.get("photo_references") or [])
        if auto:
            sb.table("shelters").update({
                "google_place_id": place_id,
                "google_place_name": (details.get("name") or "").strip() or None,
                "google_rating": details.get("rating"),
                "google_user_ratings_total": details.get("user_ratings_total"),
            }).eq("id", row["id"]).execute()
            matched += 1
            print(f"  [MATCH] {title}  (score {score:.2f}, {dist_m:.0f}m, {n_photos} foto)")
        else:
            no_match += 1
            print(f"  [SVAGT MATCH – ikke koblet] {title}  (score {score:.2f}, {dist_m:.0f}m)")
    except Exception as e:
        errors += 1
        print(f"  [FEJL] {title}: {e}")

print("\n" + "=" * 50)
print(f"FÆRDIG (kun {len(NEW_SLUGS)} nye shelters berørt)")
print(f"  Matchet m. Google Places: {matched}")
print(f"  Intet/svagt match:        {no_match}")
print(f"  Fejl:                     {errors}")
print("=" * 50)
