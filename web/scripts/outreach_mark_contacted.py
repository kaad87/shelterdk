#!/usr/bin/env python3
"""
Match the 41 emails the user already contacted manually against shelter
contact fields, then (optionally) mark the matched shelters as contacted
in outreach_review (status='sent').

Read-only by default. Pass --write to perform the upsert.

Matching key: geofa_raw.kontak_ved (the "Kontakt" field the user copied
emails from) PLUS the description text, case-insensitive substring. A
shelter is marked when ANY of the 41 emails appears in either field — so
we never re-contact an owner the user already reached.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

WRITE = "--write" in sys.argv

# ── Load credentials from .env.local ────────────────────────────────────
env = {}
with open(".env.local") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

BASE = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
REST = f"{BASE}/rest/v1"
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}

EMAILS = [
    "adm@svanholmgods.dk", "anja.eberhardt@koege.dk", "ansth@nst.dk",
    "bissenb@kker.dk", "bon@nst.dk", "brsvenner@gmail.dk",
    "fdftommerupst@gmail.com", "flemjen083@gmail.com", "geama@nst.dk",
    "gmathiasen2014@gmail.com", "grindhoj@fdf.dk",
    "hadbjergborgerforening@gmail.com", "hannebavnsgaard@jubii.dk",
    "hans.gyldendal3@gmail.com", "helle@geoparkodsherred.dk",
    "helle@rideturisland.dk", "historiepark9940@outlook.dk", "HOY@nst.dk",
    "info@eventyrskoven.dk", "info@samsoeshelters.dk", "Janni@famellice.dk",
    "jga6622@gmail.com", "jsb.naur@outlook.dk", "kasper.jensen.993@hotmail.com",
    "kimfskj@gmail.com", "kimnielsen@godmail.dk", "lars@jacobzen.dk",
    "lasse.yssing@koege.dk", "legindbjergeaps@gmail.com", "miljo@koege.dk",
    "NSJ@nst.dk", "pkhylander@gmail.com", "randerskommune@randers.dk",
    "sdrhojrup@gmail.com", "shelter@brundby.dk", "shelter@crone.dk",
    "shelter@svogerslevspejderne.dk", "snostrup.sogn@km.dk",
    "svanholmrundt@svanholm.dk", "tommydegn1@gmail.com", "VSY@nst.dk",
]
EMAILS_LC = [e.lower() for e in EMAILS]


def fetch_all_shelters():
    rows = []
    offset = 0
    page = 1000
    select = "id,title,contact,kontak:geofa_raw->>kontak_ved,description"
    while True:
        qs = urllib.parse.urlencode({"select": select, "duplicate_of_shelter_id": "is.null"})
        url = f"{REST}/shelters?{qs}"
        req = urllib.request.Request(url, headers={
            **HEADERS,
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + page - 1}",
        })
        with urllib.request.urlopen(req) as resp:
            batch = json.loads(resp.read())
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return rows


def main():
    shelters = fetch_all_shelters()
    print(f"Fetched {len(shelters)} non-duplicate shelters")

    # email -> set(shelter_id), and shelter_id -> email (first matching)
    per_email = {e: [] for e in EMAILS_LC}
    matched = {}  # shelter_id -> (email, title)
    for s in shelters:
        sid = s["id"]
        blob = ((s.get("contact") or "") + " " + (s.get("kontak") or "") + " "
                + (s.get("description") or "")).lower()
        for e in EMAILS_LC:
            if e in blob:
                per_email[e].append(sid)
                if sid not in matched:
                    matched[sid] = (e, s.get("title") or "")
                break

    no_match = [e for e in EMAILS_LC if not per_email[e]]
    print(f"\nMatched {len(EMAILS_LC) - len(no_match)}/{len(EMAILS_LC)} emails "
          f"-> {len(matched)} unique shelters\n")
    print("Distribution (email = #shelters):")
    for e in sorted(per_email, key=lambda x: -len(per_email[x])):
        if per_email[e]:
            print(f"  {e:42s} {len(per_email[e])}")
    print("\nNo match (need manual review):")
    for e in no_match:
        print(f"  {e}")

    if not WRITE:
        print("\n[read-only] Pass --write to upsert these into outreach_review.")
        return

    # ── Write: upsert status='sent' for each matched shelter ────────────
    now = __import__("datetime").datetime.utcnow().isoformat() + "Z"
    payload = [
        {
            "shelter_id": sid,
            "status": "sent",
            "recipient_email": email,
            "recipient_name": None,
            "notes": "Kontaktet manuelt af Christian inden outreach-vaerktoejet (bulk-markeret)",
            "sent_at": now,
            "reviewed_at": now,
        }
        for sid, (email, _title) in matched.items()
    ]
    url = f"{REST}/outreach_review"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        print(f"\nWrite status: {resp.status}")
    print(f"Upserted {len(payload)} outreach_review rows (status='sent').")


if __name__ == "__main__":
    main()
