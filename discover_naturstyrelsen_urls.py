#!/usr/bin/env python3
"""
Find alle shelter/sted-URLs fra book.naturstyrelsen.dk ved at køre søgesiden i en browser.
Siden loader listen med JavaScript, så vi bruger Playwright til at vente og udtrække links.

Installation (én gang):
  pip3 install playwright
  python3 -m playwright install chromium

Kør: python3 discover_naturstyrelsen_urls.py

Skriver URLs til naturstyrelsen_urls.txt. Derefter: python3 fetch_naturstyrelsen_from_urls.py
"""
import json
import os
import re
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright er ikke installeret. Kør:")
    print("  pip3 install playwright")
    print("  python3 -m playwright install chromium")
    sys.exit(1)

_script_dir = os.path.dirname(os.path.abspath(__file__))
URLS_FILE = os.path.join(_script_dir, "naturstyrelsen_urls.txt")
BASE = "https://book.naturstyrelsen.dk"

# Søgeside med filter: 3012 = Shelter på primitiv overnatningsplads
SEARCH_URLS = [
    f"{BASE}/soeg/?s1=3012&s2=&s3=&s4=",
    f"{BASE}/soeg/?s1=&s2=&s3=&s4=",
    f"{BASE}/soeg/",
]

# Fanget fra netværk (API kan indeholde sted-IDs eller URLs)
CAPTURED_URLS = []


def discover_urls():
    """Åbn søgesiden, vent på at listen indlæses, udtræk alle /sted/-links fra DOM og evt. netværk."""
    seen = set()

    def on_response(response):
        try:
            url_res = response.url
            if "book.naturstyrelsen.dk" not in url_res:
                return
            ct = response.headers.get("content-type", "")
            if "json" in ct:
                body = response.text()
                if not body or len(body) > 500_000:
                    return
                # Led efter /sted/... i JSON (fx "url": "/sted/..." eller "link": "...")
                for match in re.finditer(r'["\']?(?:url|link|href|path)["\']?\s*:\s*["\']([^"\']*?/sted/[^"\']+)["\']', body):
                    u = match.group(1).strip()
                    if u.startswith("/"):
                        u = BASE + u
                    elif not u.startswith("http"):
                        continue
                    u = u.split("?")[0].rstrip("/") + "/"
                    if u not in seen:
                        seen.add(u)
                        CAPTURED_URLS.append(u)
                # Eller array af objekter med slug/id der kan bygges til URL
                try:
                    data = json.loads(body)
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict):
                                slug = item.get("slug") or item.get("id") or item.get("path") or item.get("url")
                                if slug and "/sted/" in str(slug):
                                    u = (BASE + slug if slug.startswith("/") else BASE + "/sted/" + str(slug)).split("?")[0].rstrip("/") + "/"
                                    if u not in seen:
                                        seen.add(u)
                                link = item.get("link") or item.get("booking_url")
                                if link and "/sted/" in str(link):
                                    u = str(link).split("?")[0].rstrip("/") + "/"
                                    if u not in seen:
                                        seen.add(u)
                except Exception:
                    pass
            elif "html" in ct:
                body = response.text()
                for m in re.finditer(r'href=["\']([^"\']*?/sted/[^"\']+)["\']', body):
                    u = m.group(1).strip()
                    if u.startswith("/"):
                        u = BASE + u
                    u = u.split("?")[0].rstrip("/") + "/"
                    if "book.naturstyrelsen.dk" in u and u not in seen:
                        seen.add(u)
        except Exception:
            pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": 1280, "height": 2000})
            page.set_default_timeout(25000)
            page.on("response", on_response)
            for url in SEARCH_URLS:
                try:
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_timeout(6000)
                    # Klik "Vis på liste" for at få listevisning med links
                    try:
                        link = page.get_by_role("link", name=re.compile(r"Vis på liste", re.I))
                        if link.count() > 0:
                            link.first.click()
                            page.wait_for_timeout(5000)
                    except Exception:
                        pass
                    # Listen indlæses ofte kun A–B først; scroll ned igen og igen så resten loades
                    prev_count = 0
                    stable_rounds = 0
                    for _ in range(30):  # max 30 scroll-runder
                        hrefs = page.eval_on_selector_all(
                            'a[href*="/sted/"]',
                            """nodes => nodes.map(a => {
                                const h = a.getAttribute('href') || (a.href || '');
                                if (!h) return '';
                                return h.startsWith('http') ? h : ('https://book.naturstyrelsen.dk' + (h.startsWith('/') ? h : '/' + h));
                            }).filter(Boolean)""",
                        )
                        for h in hrefs:
                            if not h or "/sted/" not in h:
                                continue
                            u = h.split("?")[0].rstrip("/") + "/"
                            if "book.naturstyrelsen.dk" in u and u not in seen:
                                seen.add(u)
                        count = len(seen)
                        if count == prev_count:
                            stable_rounds += 1
                            if stable_rounds >= 3:
                                break  # ingen nye links efter 3 runder
                        else:
                            stable_rounds = 0
                        prev_count = count
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1500)
                    # Sidste udtrækning (uden ny scroll)
                    hrefs = page.eval_on_selector_all(
                        'a[href*="/sted/"]',
                        """nodes => nodes.map(a => {
                            const h = a.getAttribute('href') || (a.href || '');
                            if (!h) return '';
                            return h.startsWith('http') ? h : ('https://book.naturstyrelsen.dk' + (h.startsWith('/') ? h : '/' + h));
                        }).filter(Boolean)""",
                    )
                    for h in hrefs:
                        if not h or "/sted/" not in h:
                            continue
                        u = h.split("?")[0].rstrip("/") + "/"
                        if "book.naturstyrelsen.dk" in u and u not in seen:
                            seen.add(u)
                except Exception as e:
                    print("  Søg-URL", url[:50], "...", e)
                    continue
        finally:
            browser.close()
    return sorted(seen)


def main():
    print("Henter søgeside(r) med Playwright for at finde alle /sted/-URLs...")
    urls = discover_urls()
    if not urls:
        print("Ingen /sted/-URLs fundet. Prøv at køre scriptet igen eller tjek at book.naturstyrelsen.dk er oppe.")
        return
    with open(URLS_FILE, "w", encoding="utf-8") as f:
        f.write("# Naturstyrelsen sted-URLs (auto-genereret af discover_naturstyrelsen_urls.py)\n")
        for u in urls:
            f.write(u + "\n")
    print(f"Fundet {len(urls)} URLs. Gemt i {URLS_FILE}")
    print("Kør nu: python3 fetch_naturstyrelsen_from_urls.py")


if __name__ == "__main__":
    main()
