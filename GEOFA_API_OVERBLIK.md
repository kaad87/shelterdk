# GeoFA API – overblik over felter og import

GeoFA WFS laget **Facilitet punkt** (`fkg:fkg.t_5800_fac_pkt`) returnerer mange felter. Her er hvad der findes i APIet og hvad import-scriptet bruger i dag.

---

## Hvad importeres i dag (shelters-tabellen)

| Databasefelt | Kommer fra GeoFA-felt | Bemærkning |
|--------------|------------------------|------------|
| **title** | `navn` | Eller "Shelter, [kommune]" / "Shelter (objekt_id)" hvis navn mangler |
| **slug** | Genereret ud fra title + koordinat | Unikt URL-venligt id |
| **description** | `beskrivels`, `d_k_beskr`, `lang_beskr` | Kort/lang beskrivelse |
| **location** | Geometri (koordinater) | POINT(lon lat) |
| **region** | – | Fast "Danmark" |
| **toilet** | Afledt af tekst i beskrivelse | flush / mulch / none / unknown |
| **access** | – | Fast "public" |
| **mode** | – | Fast "first_come" |
| **source_id** | `objekt_id` (eller feature.id) | GeoFA’s unikke id |
| **verified** | – | Fast true |

Kun objekter med **`facil_ty` = "Shelter"** importeres.

---

## Alle felter i APIet – med eller uden i import

### ✅ Bruges i importen

| GeoFA-felt | Brug |
|------------|------|
| **navn** | → title |
| **beskrivels**, **d_k_beskr**, **lang_beskr** | → description (og toilet-afledning) |
| **objekt_id** | → source_id (og titel-fallback) |
| **beliggenhedskommune** | Titel-fallback når navn mangler |
| **facil_ty** | Filtrering (kun "Shelter") |
| Geometri (coordinates) | → location |

### ❌ Ligger i APIet men er **ikke** med i importen

| GeoFA-felt | Indhold (kort) |
|------------|-----------------|
| **adr_id** | Adresse-id |
| **ansva_v** | Ansvarsform (fx "Kommune", "Staten") |
| **ansva_v_k** | Kode for ansvarsform |
| **ansvar_org** | Ansvarlig organisation (fx "Rebild Kommune", "Naturstyrelsen") |
| **antal_pl** | Antal pladser |
| **bemand** | Bemandet (ja/nej) |
| **bemand_k** | Kode |
| **betaling** | Betaling (fx "Nej") |
| **betaling_k** | Kode |
| **book** | Booking (ja/nej) |
| **book_k** | Kode |
| **bookinglink** | URL til booking |
| **bruger_id** | Bruger der har oprettet/redigeret |
| **cvf_vejkode** | Vejkode |
| **cvr_kode** | CVR-nummer |
| **cvr_navn** | Virksomhedsnavn (fx kommune) |
| **d_k_beskr** | Dansk kort beskrivelse |
| **d_l_beskr** | Dansk lang beskrivelse |
| **doegnaab** | Døgnåben (ja/nej) |
| **doegnaab_k** | Kode |
| **facil_ty_k** | Facilitetstype-kode (fx 3012 for Shelter) |
| **filmlink**, **filmlink1**–**3** | Links til film/video |
| **folde_link**, **foldelink1**–**3** | Links til foldere |
| **folder** | Mappe (fx "Shelter") |
| **folder_k** | Kode |
| **foto_link**, **foto_link1**–**3** | Links til fotos |
| **geofafoto**, **geofafoto1**–**3** | GeoFA-fotoreferencer |
| **handicap** | Handicaptilgængelighed |
| **handicap_k** | Kode |
| **husnr** | Husnummer |
| **kommunekode** | Kommunens kode |
| **kontak_ved** | Kontakt (e-mail, telefon) |
| **kvalitet** | Kvalitet (fx "Ukendt") |
| **kvalitet_k** | Kode |
| **kvalitetstjekket** | Om kvalitet er tjekket |
| **link**, **link1**–**3** | Generelle links |
| **navn_d** | Navn (tyske?) |
| **navn_uk** | Navn (engelsk?) |
| **noegle** | Nøgle |
| **note** | Noter |
| **off_kode** | Offentlighedskode |
| **offentlig** | Fx "Synlig for alle" |
| **oprettet** | Oprettelsestidspunkt (ISO-dato) |
| **oprindelse** | Fx "FOT / Tekniske kort", "Felt-/markbesøg" |
| **oprindkode** | Kode |
| **postnr** | Postnummer |
| **postnr_by** | Postnummer og by |
| **saeson** | Sæson (åben/lukket) |
| **saeson_bem** | Sæsonbemærkning |
| **saeson_k** | Kode |
| **saeson_sl** | Sæson slut |
| **saeson_st** | Sæson start |
| **status** | Fx "Gældende / Vedtaget" |
| **statuskode** | Kode |
| **systid_fra** | Systemtid fra (seneste ændring) |
| **temakode** | Temakode (5800 = facilitet punkt) |
| **temanavn** | Temanavn |
| **tilgaeng_beskriv** | Tilgængelighedsbeskrivelse |
| **tilgaeng_opl** | Tilgængelighed (struktureret, fx parkering, belægning) |
| **uk_k_beskr** | Engelsk kort beskrivelse |
| **uk_l_beskr** | Engelsk lang beskrivelse |
| **vandhane** | Vandhane (ja/nej) |
| **vandhane_k** | Kode |
| **vejkode** | Vejkode |
| **vejnavn** | Vejnavn |
| **versions_id** | Versions-id |

---

## Hvad du evt. kan tilføje til importen

Hvis du vil udvide `shelters`-tabellen eller en anden tabel, er disse felter særligt relevante for shelters:

- **antal_pl** – antal pladser
- **bookinglink** – link til booking
- **kontak_ved** – kontakt (e-mail, tlf.)
- **ansvar_org** – ejer/ansvarlig (kommune, styrelse)
- **doegnaab** – om stedet er døgnåbent
- **saeson** / **saeson_bem** – sæson/lukketider
- **handicap** – handicapvenlig
- **foto_link** / **geofafoto** – billeder
- **link** / **link1**–**3** – eksterne links
- **oprettet** / **systid_fra** – oprettet/sidst opdateret
- **vejnavn**, **postnr_by** – adresse

For at bruge dem skal du enten tilføje kolonner i `shelters` (og opdatere `import_shelters.py`) eller gemme rå GeoFA-data i en separat tabel.
