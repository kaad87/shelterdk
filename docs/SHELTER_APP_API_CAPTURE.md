# Fange Shelter-appens API (Napps)

Shelter-appen (dk.shelter.app) har ingen offentlig hjemmeside med data, og udvikleren svarer ikke. For at få adgang til deres shelter-data kan du **fange appens netværkstrafik** når den henter data – så finder du API-URL’er og kan kalde dem fra et script.

Denne guide bruger **mitmproxy** på din computer og en **Android-telefon eller -emulator** (Android er nemmest; iOS kræver certifikat på enhed og kan blive blokeret af appen).

---

## 1. Installer mitmproxy

På Mac (Homebrew):

```bash
brew install mitmproxy
```

Eller med pip:

```bash
pip3 install mitmproxy
```

---

## 2. Start proxy på computeren

Kør i en terminal:

```bash
mitmproxy --listen-port 8080
```

**Hvis du får "command not found":** pip har installeret scriptet i din bruger-mappe, men den mappe er ikke i PATH. Prøv én af disse:

```bash
# Find hvor mitmproxy ligger (Mac, bruger-installation)
~/Library/Python/3.9/bin/mitmproxy --listen-port 8080
# eller 3.10, 3.11 osv. afhængigt af din pip-version:
~/Library/Python/3.10/bin/mitmproxy --listen-port 8080
```

Find den rigtige mappe med:

```bash
ls ~/Library/Python/*/bin/mitmproxy 2>/dev/null
```

Kør den fulde sti den viser. **Bemærk:** `python3 -m mitmproxy` virker ofte ikke, fordi systemets `python3` (fx Xcode Command Line Tools) ikke har mitmproxy installeret – pip har typisk installeret det til en anden Python (bruger-mappen ovenfor). Brug derfor den fulde sti til `mitmproxy`-scriptet.

Alternativt: **mitmweb** (web-interface i browser) startes på samme måde med `mitmweb` i stedet for `mitmproxy`; derefter åbn http://127.0.0.1:8081 i browseren.

Lad vinduet stå åbent. Notér din computers **lokale IP** (fx `192.168.1.10`) – du finder den med `ifconfig` (Mac/Linux) eller `ipconfig` (Windows). Telefonen skal bruge denne IP og port 8080 som proxy.

---

## 3. Sæt Android til at bruge proxyen

- **Fysisk telefon:**  
  Indstillinger → Netværk og internet → Wi‑Fi → langt tryk på dit netværk → Rediger / Avanceret → Proxy: Manuelt → Værtsnavn: din computers IP, Port: `8080` → Gem.

- **Emulator (Android Studio):**  
  I emulatoren: Indstillinger → Proxy, sæt samme IP og port. Eller start emulatoren med `-http-proxy http://10.0.2.2:8080` (10.0.2.2 er emulatorens adresse til host-pc).

---

## 4. Installér mitmproxy’s certifikat på Android

1. På telefonen: Åbn **Chrome** (eller anden browser) og gå til: **http://mitm.it**
2. Vælg **Android** og download certifikatet.
3. Installér det (Android vil typisk bede om at du giver det et navn og gemmer det under “Bruger-legitimationsoplysninger” eller “Trusted credentials” afhængigt af version).

Uden dette kan du ikke læse HTTPS-trafik (de fleste API’er bruger HTTPS).

---

## 5. Brug Shelter-appen

Åbn **Shelter**-appen på telefonen. Gør ting der henter data:

- Åbn kortet og lad shelters indlæse
- Zoom ind/ud så flere områder loades
- Åbn 2–3 enkelte shelters (detaljer, evt. billeder)

I **mitmproxy**-vinduet på computeren vil du nu se alle HTTP(S)-anmodninger. Scroll eller søg efter:

- URL’er der indeholder fx **api**, **shelter**, **place**, **geo**, **v1**, **graphql**
- Svar med **JSON** (Content-Type: application/json)
- Domæner der ikke er google/facebook/analytics (fx `shelterapp.dk`, `napps`, eller et cloud-domæne de bruger)

---

## 6. Find de relevante kald

I mitmproxy:

- Tryk **Enter** på en anmodning for at se detaljer.
- Tryk **m** for at vælge “Save body” og gemme svar som fil (fx `shelter_list.json`).
- Notér den fulde **URL** (inkl. evt. query-parametre) og **Headers** (fx `Authorization`, `X-API-Key`) – dem skal du bruge i et script.

Typisk vil der være ét kald der henter en **liste** af shelters (kort/data) og evt. kald til **detaljer** per shelter (id i URL eller body).

---

## 7. Hvis der ingen trafik vises eller alt er “unknown”

- **Appen bruger måske certificate pinning:** Så afviser den mitmproxy’s certifikat, og du ser ikke (eller kun brudte) HTTPS-kald. I så fald kan man prøve ældre versioner af appen (APK fra f.eks. APKMirror) der muligvis ikke pinner, eller værktøjer som Frida – det er mere avanceret.
- **Tjek at proxy og certifikat er korrekt:** Besøg https://example.com i telefons browser – du bør se anmodningen i mitmproxy. Hvis ikke, gennemgå proxy-IP, port og certifikat.

---

## 8. Når du har URL + evt. headers

Send/indsæt her:

- Den **fulde URL** (fx `https://api.example.com/v1/shelters?bbox=...`)
- Evt. **headers** der ser ud til at være nødvendige (Authorization, API-key, User-Agent)
- Et **eksempel på svar** (paste af JSON eller den gemte fil)

Så kan der laves et lille Python-script der kalder samme API og gemmer resultater (fx i `shelterdk` eller direkte i din database), tilsvarende de andre datakilder i projektet.

---

## Kort oversigt

| Trin | Handling |
|------|----------|
| 1 | Installér mitmproxy på pc |
| 2 | Start `mitmproxy --listen-port 8080` |
| 3 | Sæt Android Wi‑Fi/emulator til proxy: pc’s IP, port 8080 |
| 4 | Gå til http://mitm.it på telefonen, download og installer certifikat |
| 5 | Åbn Shelter-appen, lad kort og detaljer loade |
| 6 | I mitmproxy: find API-URL’er og gem et eksempel på JSON-svar |
| 7 | Del URL + headers + eksempel-svar, så der kan laves et fetch-script |
