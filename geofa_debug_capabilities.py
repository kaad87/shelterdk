#!/usr/bin/env python3
"""
Kør dette for at tjekke hvad GeoFA WFS serveren tilbyder (GetCapabilities).
Udtrækker lag-navne (FeatureType) så vi kan bruge det præcise navn i GetFeature.
Kør: python3 geofa_debug_capabilities.py
"""
import re
import requests

url = "https://geofa.geodanmark.dk/ows/fkg/fkg?service=WFS&version=2.0.0&request=GetCapabilities"
headers = {"User-Agent": "ShelterDK-debug/1.0", "Accept": "application/xml"}

print("Henter GetCapabilities fra GeoFA WFS...")
try:
    r = requests.get(url, headers=headers, timeout=30)
    print(f"Status: {r.status_code}\n")
    if r.status_code != 200:
        print("Svar:", r.text[:500])
    else:
        text = r.text
        # Namespace fra capabilities (vi så: xmlns:fkg="https://geofa.geodanmark.dk")
        ns = re.search(r'xmlns:fkg="([^"]+)"', text)
        if ns:
            print(f"Namespace fkg: {ns.group(1)}")
        # Udtræk FeatureType-navne (fx <wfs:FeatureType><wfs:Name>fkg:t_5800_fac_pkt</wfs:Name>)
        names = re.findall(r"<wfs:Name>([^<]+)</wfs:Name>", text)
        if names:
            print("Tilgængelige lag (FeatureType Name):")
            for n in names:
                print(f"  - {n}")
        else:
            # Alternativ mønster
            names = re.findall(r"<Name>([^<]+)</Name>", text)
            if names:
                print("Lag (Name):")
                for n in names:
                    print(f"  - {n}")
        if not names:
            print("Ingen lag fundet i svar. Første 3000 tegn:")
            print(text[:3000])
except Exception as e:
    print("Fejl:", e)
