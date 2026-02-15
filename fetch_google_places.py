#!/usr/bin/env python3
"""
Hent Google Places-data (rating, anmeldelser, billeder) og match til shelters.

For hver shelter med koordinater: Nearby Search omkring (lat, lon), vælg bedste
kandidat (navn + afstand), hent Place Details, gem i google_places og
shelter_google_match, opdater shelters med google_place_id, google_rating,
google_user_ratings_total.

Kræver: .env med NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY og
        GOOGLE_MAPS_API_KEY (eller GOOGLE_PLACES_API_KEY).
Kør: python3 fetch_google_places.py [--refresh]
     --refresh: genhent også for shelters der allerede har google_place_id

Efter kørsel kan du udfylde shelters.image_url fra Google-billeder (når GeoFA mangler/er defekt):
     python3 backfill_image_from_google_places.py [--dry-run] [--force]
"""
import argparse
import math
import os
import re
import time

import requests
from datetime import datetime, timezone

_script_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_script_dir, ".env")
try:
    from dotenv import load_dotenv
    load_dotenv(_env_path)
except ImportError:
    pass
if os.path.isfile(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

# Google Places: 1 req/s for at undgå rate limit
REQUEST_DELAY_S = 1.0
NEARBY_RADIUS_M = 250
MIN_SCORE_AUTO_MATCH = 0.55
MAX_DISTANCE_AUTO_M = 300


def parse_point(location_str):
    """Udtræk lon, lat fra PostGIS POINT-streng eller None."""
    if not location_str or not isinstance(location_str, str):
        return None, None
    m = re.match(r"POINT\s*\(\s*([\d.e+-]+)\s+([\d.e+-]+)\s*\)", location_str, re.I)
    if not m:
        return None, None
    try:
        return float(m.group(1)), float(m.group(2))
    except (TypeError, ValueError):
        return None, None


def haversine_m(lon1, lat1, lon2, lat2):
    """Afstand i meter mellem to punkter (WGS84)."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def name_similarity(a: str, b: str) -> float:
    """0–1 lighed mellem to strenge (case-insensitive)."""
    if not a or not b:
        return 0.0
    a, b = a.lower().strip(), b.lower().strip()
    if a == b:
        return 1.0
    from difflib import SequenceMatcher
    return SequenceMatcher(None, a, b).ratio()


def nearby_search(api_key: str, lat: float, lon: float, radius_m: int = 250):
    """Returnerer liste af {place_id, name, lat, lng} fra Nearby Search."""
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{lat},{lon}",
        "radius": radius_m,
        "keyword": "shelter",
        "key": api_key,
    }
    time.sleep(REQUEST_DELAY_S)
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise RuntimeError(f"Google Nearby Search: {data.get('status')} – {data.get('error_message', '')}")
    results = []
    for r in data.get("results") or []:
        loc = r.get("geometry", {}).get("location") or {}
        results.append({
            "place_id": r.get("place_id"),
            "name": (r.get("name") or "").strip(),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
        })
    return results


def place_details(api_key: str, place_id: str):
    """Hent Place Details. Returnerer dict med place_id, name, lat, lng, rating, user_ratings_total, photos, raw_json."""
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    fields = "place_id,name,geometry,rating,user_ratings_total,reviews,photos,url,website"
    # language=da + reviews_no_translations=true: anmeldelser i originalsprog (fx dansk),
    # ikke oversat til engelsk. Uden disse returnerer API ofte engelske oversættelser.
    params = {
        "place_id": place_id,
        "fields": fields,
        "key": api_key,
        "language": "da",
        "reviews_no_translations": "true",
    }
    time.sleep(REQUEST_DELAY_S)
    resp = requests.get(url, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "OK":
        raise RuntimeError(f"Google Place Details: {data.get('status')} – {data.get('error_message', '')}")
    result = data.get("result") or {}
    loc = result.get("geometry", {}).get("location") or {}
    photos = result.get("photos") or []
    photo_refs = [p.get("photo_reference") for p in photos if p.get("photo_reference")]
    return {
        "place_id": result.get("place_id"),
        "name": (result.get("name") or "").strip(),
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "rating": result.get("rating"),
        "user_ratings_total": result.get("user_ratings_total"),
        "photo_references": photo_refs[:10] if photo_refs else None,
        "raw_json": result,
    }


def best_candidate(shelter_title: str, shelter_lat: float, shelter_lon: float, candidates: list):
    """
    Vælg bedste kandidat fra Nearby Search-resultater.
    Returnerer (candidate_dict, score, distance_m) eller (None, 0, None) hvis ingen.
    """
    best = None
    best_score = 0.0
    best_dist = None
    for c in candidates:
        if not c.get("place_id"):
            continue
        c_lat, c_lng = c.get("lat"), c.get("lng")
        if c_lat is None or c_lng is None:
            continue
        dist = haversine_m(shelter_lon, shelter_lat, c_lng, c_lat)
        name_sim = name_similarity(shelter_title, c.get("name") or "")
        # distance_score: 1 ved 0 m, 0 ved MAX_DISTANCE_AUTO_M m
        dist_score = max(0.0, 1.0 - dist / MAX_DISTANCE_AUTO_M)
        score = 0.6 * name_sim + 0.4 * dist_score
        if best is None or score > best_score:
            best = c
            best_score = score
            best_dist = dist
    return best, best_score, best_dist


def main():
    parser = argparse.ArgumentParser(description="Hent Google Places og match til shelters")
    parser.add_argument("--refresh", action="store_true", help="Genhent også for shelters der allerede har google_place_id")
    args = parser.parse_args()

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("GOOGLE_PLACES_API_KEY")
    if not url or not key:
        print("Mangler NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env")
        return
    if not api_key:
        print("Mangler GOOGLE_MAPS_API_KEY (eller GOOGLE_PLACES_API_KEY) i .env")
        return

    from supabase import create_client
    supabase = create_client(url, key)

    # Shelters med koordinater; evt. udelad dem der allerede har match
    # Paginer (Supabase default = max 1000 rækker)
    select_cols = "id,title,location,google_place_id"
    BATCH = 1000
    all_rows = []
    offset = 0
    while True:
        r = supabase.table("shelters").select(select_cols).range(offset, offset + BATCH - 1).execute()
        rows = r.data or []
        all_rows.extend(rows)
        if len(rows) < BATCH:
            break
        offset += BATCH

    shelters = []
    for row in all_rows:
        lon, lat = parse_point(row.get("location"))
        if lon is None or lat is None:
            continue
        if not args.refresh and (row.get("google_place_id") or "").strip():
            continue
        shelters.append({
            "id": row["id"],
            "title": (row.get("title") or "").strip(),
            "lat": lat,
            "lon": lon,
        })

    if not shelters:
        print("Ingen shelters at matche (alle har koordinater og evt. allerede google_place_id). Brug --refresh for at genhente.")
        return

    print(f"Matcher {len(shelters)} shelters mod Google Places (radius {NEARBY_RADIUS_M} m)...")

    matched = 0
    updated_places = 0
    errors = 0
    for i, s in enumerate(shelters):
        try:
            candidates = nearby_search(api_key, s["lat"], s["lon"], NEARBY_RADIUS_M)
            cand, score, dist_m = best_candidate(s["title"], s["lat"], s["lon"], candidates)
            if not cand:
                continue
            details = place_details(api_key, cand["place_id"])
            place_id = details["place_id"]
            # Upsert google_places
            row_place = {
                "google_place_id": place_id,
                "name": details.get("name"),
                "lat": details.get("lat"),
                "lng": details.get("lng"),
                "rating": details.get("rating"),
                "user_ratings_total": details.get("user_ratings_total"),
                "photo_references": details.get("photo_references"),
                "raw_json": details.get("raw_json"),
            }
            supabase.table("google_places").upsert(row_place, on_conflict="google_place_id").execute()
            updated_places += 1
            # Gem flade anmeldelser i google_place_reviews (en række per review)
            reviews = (details.get("raw_json") or {}).get("reviews") or []
            if reviews:
                rows_reviews = []
                for rv in reviews:
                    ts = None
                    t_val = rv.get("time")
                    if isinstance(t_val, (int, float)):
                        ts = datetime.fromtimestamp(t_val, tz=timezone.utc).isoformat()
                    rows_reviews.append(
                        {
                            "google_place_id": place_id,
                            "author_name": rv.get("author_name"),
                            "rating": rv.get("rating"),
                            "text": rv.get("text"),
                            "relative_time_description": rv.get("relative_time_description"),
                            "time": ts,
                            "raw_json": rv,
                        }
                    )
                # Erstat eksisterende anmeldelser for dette sted
                supabase.table("google_place_reviews").delete().eq("google_place_id", place_id).execute()
                supabase.table("google_place_reviews").insert(rows_reviews).execute()
            # Match per shelter/place: upsert så kørsel kan gentages uden duplicate key-fejl
            auto = score >= MIN_SCORE_AUTO_MATCH and (dist_m or 999) <= MAX_DISTANCE_AUTO_M
            match_row = {
                "shelter_id": s["id"],
                "google_place_id": place_id,
                "match_score": round(score, 4),
                "distance_meters": round(dist_m, 2) if dist_m is not None else None,
                "auto_matched": auto,
            }
            supabase.table("shelter_google_match").upsert(
                match_row,
                on_conflict="shelter_id,google_place_id",
            ).execute()
            # Opdater shelter kun ved troværdig match – undgå at knytte fx "Ejer Bavnehøj" til "Møgelhøj shelter"
            place_name = (details.get("name") or "").strip() or None
            if auto:
                supabase.table("shelters").update({
                    "google_place_id": place_id,
                    "google_place_name": place_name,
                    "google_rating": details.get("rating"),
                    "google_user_ratings_total": details.get("user_ratings_total"),
                }).eq("id", s["id"]).execute()
                matched += 1
            else:
                supabase.table("shelters").update({
                    "google_place_id": None,
                    "google_place_name": None,
                    "google_rating": None,
                    "google_user_ratings_total": None,
                }).eq("id", s["id"]).execute()
            if (i + 1) % 10 == 0:
                print(f"  {i + 1}/{len(shelters)} – {matched} matchet")
        except Exception as e:
            errors += 1
            print(f"  Fejl for {s.get('title', s['id'])}: {e}")

    print(f"Færdig. {matched} shelters matchet, {updated_places} Google Places opdateret, {errors} fejl.")


if __name__ == "__main__":
    main()
