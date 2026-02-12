#!/usr/bin/env python3
"""
Geocoding for Book en Shelter: adresse-streng → (lat, lon) via Nominatim (OpenStreetMap).
Gratis, kræver 1 forespørgsel pr. sekund (Nominatim policy).
"""
import re
import time
from typing import Optional

import requests


def extract_address_from_html(html: str) -> Optional[str]:
    """
    Udtræk en dansk adresse fra Book en Shelter HTML.
    Søger efter: Adresse/Placering-labels, eller mønster "vej/gade, postnr by".
    """
    if not html:
        return None
    # 1) Eksplicit label: Adresse:, Placering:, Lokation:
    m = re.search(
        r"(?:Adresse|Placering|Lokation|Address)\s*:?\s*([^\n<]{5,120})",
        html,
        re.I,
    )
    if m:
        s = re.sub(r"\s+", " ", m.group(1)).strip()
        if re.search(r"\d{4}", s):  # indeholder postnr
            return s[:100]
    # 2) "Vejnavn [nr], postnr By" (fx "Nyborgvej 518, 5881 Skårup")
    m = re.search(
        r"[.\s]([A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9\s\-]*(?:vej|gade|alle|strand|plads(?!en|et))\s*\d*)\s*,\s*(\d{4})\s+([A-Za-zÆØÅæøå\s\-]+)",
        html,
        re.I,
    )
    if m:
        street_part = m.group(1).strip()
        # Hvis vi fangede hele sætningen, tag kun sidste vejnavn+nummer (fx "Nyborgvej 518")
        if len(street_part) > 30:
            short = re.search(
                r".*\b([A-Za-zÆØÅæøå]{2,}(?:vej|gade|alle|strand|plads)\s*\d*)\s*$",
                street_part,
                re.I,
            )
            if short:
                street_part = short.group(1).strip()
        s = f"{street_part}, {m.group(2)} {m.group(3).strip()}"
        return s[:100]
    # 3) Kun postnr + by (fx "5881 Skårup")
    m = re.search(r"\b(\d{4})\s+([A-Za-zÆØÅæøå\s\-]{2,40})\b", html)
    if m:
        return f"{m.group(1)} {m.group(2).strip()}"[:80]
    return None

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "ShelterDK/1.0 (bookenshelter geocoding; contact via project)"
_LAST_REQUEST_TIME = 0.0
MIN_INTERVAL = 1.1  # sekunder mellem kald


def _rate_limit():
    global _LAST_REQUEST_TIME
    now = time.monotonic()
    wait = MIN_INTERVAL - (now - _LAST_REQUEST_TIME)
    if wait > 0:
        time.sleep(wait)
    _LAST_REQUEST_TIME = time.monotonic()


def geocode_address(address: str) -> tuple[Optional[float], Optional[float]]:
    """
    Giv en adresse-streng (fx "Nyborgvej 518, 5881 Skårup" eller "5881 Skårup").
    Returnerer (lat, lon) eller (None, None) ved fejl/ingen træf.
    """
    if not address or not address.strip():
        return None, None
    address = address.strip()
    if "danmark" not in address.lower() and "denmark" not in address.lower():
        address = f"{address}, Denmark"
    _rate_limit()
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": address, "format": "json", "limit": 1},
            headers={"User-Agent": USER_AGENT},
            timeout=15,
        )
        if r.status_code != 200:
            return None, None
        data = r.json()
        if not data or not isinstance(data, list):
            return None, None
        hit = data[0]
        lat = hit.get("lat")
        lon = hit.get("lon")
        if lat is None or lon is None:
            return None, None
        lat, lon = float(lat), float(lon)
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return lat, lon
    except Exception:
        pass
    return None, None
