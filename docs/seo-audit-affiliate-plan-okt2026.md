# Gennemgang af den eksterne SEO-audit (affiliate) og plan

Auditten er dateret 27. oktober 2026 og lavet udefra uden adgang til kode,
database, Search Console eller klikdata. Herunder er hver konkret paastand
maalt mod koden og databasen samme dag, derefter de fund auditten ikke kunne
se, og til sidst planen.

Alt maalt 27. oktober 2026.

## 1. Det der holder

| Paastand | Maalt |
|---|---|
| "Testvinder" i strid med metodesiden | `app/(site)/bedste/page.tsx:133` printer "Testvinder:" paa alle 46 hub-kort. Ingen produkter har praedikatet i databasen (0 af 343 entries). `/saadan-vurderer-vi` siger "Vi har ikke et testlab, og vi laver ikke fysiske labtests". Selve guidesiden siger korrekt "Vores foerstevalg". |
| Modstridende foerstevalg | Holder, og det er bredere end sovepose: **9 af 46 guider** navngiver ét produkt i "Hurtigt svar" og et andet i badgen og paa hub-kortet. Tarp, regntoj, sovepose, telt, sovepose-til-vinter, frysetorret-mad, foerstehjaelp, dry-bag, haengekoje. |
| Laekkede interne noter | Holder, og meget bredere: "ikke oplyst i feedet" staar i **56 entries**. "Flyttet hertil" staar i sovepose. |
| aeoeaa-fejl | Holder: 1 guidetekst og 8 entries. Konkret `pakmaal`, `pakmaalet`, `vaegten`, `koebe`, `medfoelgende`, `maaneder`, `baeres`, `baerer`, `hoerer`, `hoejt`, `vaelge`, `foerstevalg`. |
| Meningsloes saetning | Holder: "myggenet eller mumieform" staar i sovepose-guiden. |
| "vores test af" | Holder, bredere: 10 forekomster i `shared/data/blog.ts`, `shared/data/guides.ts` og `/tilbud`. Dertil 6 af 46 `seo_title` der siger "test" (fx "Bedste telt 2026 – test og koebsguide"). Det staar i SERP-snippet'et, altsaa det mest synlige sted af alle. |
| Uensartet shelter-antal | Holder: 1830 raekker i databasen, forsiden skriver 1700, `/koeb-shelter` "over 1.600", `ShelterCTA` "800+". |
| Feed-titler som produktnavne | Holder: "Telt  -  High Peak Nevada 2.1  -  2 personer", "Cocoon Travel Hammock Single,285x150cm,cypress - Hængekøje". |
| Irrelevante varer paa /tilbud | Holder: **4 af 40** (1 Topeak cykellygte under `lygte`, 3 Point Virgule proptraekkere under `kniv`). |
| Partnersiden naevner kun tre | Holder: Backpackerlife, Outdoortid, Outmore. Databasen har aktive varer fra **syv**: outmore, backpackerlife, outdoortid, prooutdoor, outdoornu, outdooricentrum, zeejuu. Plus Soelund Huse og Booking.com. Siden hedder "Vores partnere", saa det er ogsaa et markedsfoeringsretligt hul, ikke kun et SEO-hul. |
| Footeren linker kun til 4 af 46 | Holder: sovepose, liggeunderlag, pandelampe, telt. |
| Forsiden linker til redirects | Holder: **18 links** til `/shelter/<slug>`, som svarer 308 til `/danmark/...`. |
| `/danmark/danmark/ukendt-kommune` i sitemap | Holder, men lille: 1 URL af 3122. |
| Hotlinkede produktbilleder | Holder: 28 billeder paa `/bedste/sovepose`, 22 fra backpackerlife.dk og 6 fra outmore.dk. |
| Pakkelisten linker til ca. 10 guider | Holder: 11 af 46. |

## 2. Det der ikke holder

**"Ensret /danmark/sjaelland og /danmark/sjaelland-og-oeerne."**
Den dobbelte slug er bevidst og dokumenteret i `web/lib/region-slug-redirect.ts`:
region-hub og facet-sider ligger paa den korte slug, kommune- og shelter-sider
paa den lange. Sitemappet udsender kun den korte (maalt: 1 forekomst af
`/danmark/sjaelland`, 0 af den lange). Der er intet at rette.

**"Alle shelter-sider linker til /naturophold."**
Nej. `components/naturophold/NearbyStays.tsx` returnerer `null`, naar der ikke
er publicerede ophold inden for radius. Der er 15 publicerede ophold, saa
modulet vises kun paa shelter-sider taet paa dem. Det ubetingede link til den
tomme side staar paa `/bedste`-hubben, linje 73. Problemet er reelt, men ét
link, ikke 1800.

**"Pakkelisten er en vigtig feeder."**
Den staar for 14 af 1112 affiliate-klik, altsaa 1,3 %. Den er ikke en vigtig
feeder i dag. At udvide dens links er stadig rigtigt, men det er ikke en
prioritet-1-opgave.

**Auditten modsiger sig selv om bredde.**
Side 5 konkluderer: "Mere bredde i samme format giver mest sandsynligt flere
plads 5-9-placeringer, ikke flere klik." Side 7-8 foreslaar derefter cirka 40
nye sider i samme format. Jeg foelger den foerste konklusion.

## 3. Det auditten ikke kunne se

### 3.1 Baal-klyngen er prioritet 1 af den rigtige grund, men den rigtige opgave er en anden

Auditten anbefaler syv nye baal-sider, fordi SERP'en er svag. Maalt paa feedet
findes der 0 produkter, der hedder "baalpande", 0 "grillrist", 0
"snobroedspind" og 0 "perkolator".

Men et bredere opslag viser, at varerne er der: Petromax Cast-iron Campfire
Skillet, Petromax Campfire Bread Skewer, Coghlans Camp Fork, Coghlans Heavy
Duty Camp Grill, UCO Flatpack Grill & Firepit, BioLite Firepit, Grilliput,
Feuerhand bordgrill. Outmore har en raa kategori **`Båludstyr` med 78 varer paa
lager** og en `Bålsted` dertil.

De er alle usynlige paa sitet, fordi `category_mapped` er `null`. Opgaven er
altsaa ikke at skrive syv sider. Det er at kortlaegge to raa kategorier, og saa
er der grundlag for to sider.

### 3.2 28 % af feedet er usynligt

**3512 af 12.744 varer paa lager har ingen kategori.** 3306 af dem er fra
outmore. De 40 stoerste ukortlagte raa kategorier daekker 86 % af hullet:

Med shelter-fit, boer kortlaegges: `Båludstyr` 78, `Krus` 52, `Kop` 19,
`Drikkeflaske` 18, `Tæppe` 18, `Reb` 22, `Bålsted`.

Uden shelter-fit, boer aktivt afvises saa de aldrig kan sive ind paa `/tilbud`
eller i tilbudsblokkene: `Batteri` 344, `Skiudstyr` 263, `Indersål` 31,
`Hjemmesko` 26, `Lynlås` 20, `Skistave` 22, `Hængelås` 15, `Pung` 17,
`Skibriller` 17, `Madkasse` 61.

Det forklarer ogsaa cykellygten og proptraekkerne: de er ikke ukategoriserede,
de er *fejl*kategoriserede, fordi outmores `Lygte` og `Kniv` er kortlagt fladt.

### 3.3 Klikdataene peger et andet sted end auditten

1112 affiliate-klik, 12. juni til 27. oktober 2026:

| Side | Klik | Andel |
|---|---|---|
| /bedste/sovepose | 191 | 17 % |
| /bedste/campingstol | 130 | 12 % |
| /bedste/sovepose-til-vinter | 95 | 9 % |
| /bedste/liggeunderlag | 90 | 8 % |
| /bedste/vandfilter | 64 | 6 % |
| /bedste/telt | 44 | 4 % |
| /tilbud | 41 | 4 % |

Sovegrej samlet (sovepose, sovepose-til-vinter, liggeunderlag,
liggeunderlag-til-vinter, sovepose-til-boern, dunsovepose) er **37 % af alle
klik**. Auditten placerer soevn-varianter som prioritet 2.

**Campingstol er 12 % af alle klik og naevnes ikke én gang i auditten.**

Sidste 45 dage, 355 klik: vandfilter 38, sovepose 38, sovepose-til-vinter 34.
Vinter-sovegrej og vand er det, der tjener lige nu.

`taendstaal`, den eneste baal-naere guide der findes, har 23 klik i alt og 9 i
de sidste 45 dage. Det er svagt belaeg for, at baal-trafik konverterer, og en
grund til at teste klyngen med to sider frem for syv.

**51 % af alle klik falder paa `placement: guide_overview`** (568 af 1112), mod
261 paa `product` og 228 paa `guide_table`. De 9 modstridende "Hurtigt
svar" sidder praecis dér. Det er ikke kun et tillidsproblem, det er det
hoejest konverterende element paa sitet, der modsiger sig selv.

`naturophold_map` har 37 klik. Booking.com-modulet tjener penge, mens
landingssiden `/naturophold` er tom og noindex.

`referrer_host` er tom i 1088 af 1112 klik, saa jeg kan ikke bekraefte, hvor
meget af trafikken der kommer fra Google. Auditens placeringer er ét
ikke-personaliseret oejebliksbillede fra én dag og boer ikke baeres som facit.

### 3.4 Shelter-vinklen mangler dér hvor pengene er

`sovepose-til-vinter` naevner ordet "shelter" **0 gange** og er sitets
tredjestoerste tjener. `liggeunderlag` naevner det 1 gang, 90 klik.
`campingstol` 2 gange, 130 klik.

Auditten vil loese shelter-intent med nye sider. For de stoerste tjenere er det
den forkerte vej: `/bedste/sovepose-til-shelter` ville konkurrere med
`/bedste/sovepose`, som er sitets stoerste indtaegtskilde, og
selvkannibalisering er allerede et kendt problem her. Vinklen skal ind i de
sider, der findes. Nye sider kun dér, hvor der ikke er en side at skaerpe
(`forhaeng til shelter`).

### 3.5 Feed-daekning for auditens forslag

Maalt paa varer paa lager og distinkte brands. En guide kraever realistisk 8
varer fra mindst 3 brands.

Kan bygges nu: termoflaske (78/9), termokrus (95/5), koeleboks (59/9),
lagenpose (72/6), tipi-lavvu (62/4), solcellepanel (25/4), vanddunk (15/7),
pandelampe til boern (8/3).

Kan ikke bygges: termokande (3 varer, og auditten gjorde den til prioritet 2),
sommersovepose (0, og derfor staar guiden stadig som udkast), dobbelt sovepose
(0), hundesovepose (0), liggeunderlag til hund (0), hundesele (0),
outdoor-ur (0), skumunderlag (3), bivuaksaek (2).

Hele hund-klyngen, som auditten giver prioritet 2, har nul produkter hos de
nuvaerende forhandlere. Den er en forhandler-opgave, ikke en indholdsopgave.

## 4. Plan

Raekkefoelgen foelger: ret det der skader tilliden paa de sider der tjener,
gоer det usynlige feed synligt, og udvid foerst derefter.

### Fase 1: tillid og selvmodsigelser (foerst, ca. 1 dag)

1. **Én kilde til foerstevalget.** `app/(site)/bedste/[slug]/page.tsx:102`
   vaelger hoejeste score, mens `resolveAwards` og `vaelgVinder` foretraekker
   den med topspraedikatet. Lad siden bruge `vaelgVinder`, saa svarkapsel, badge,
   hub-kort og `llms.txt` ikke kan blive uenige igen. Retter 9 guider paa én
   gang, og det er det element der baerer halvdelen af klikkene.
2. **Fjern "Testvinder:" fra hub-kortene.** Erstat med "Vores foerstevalg:".
3. **Fjern "test"-paastande:** 10 forekomster i `shared/data/`, og 6 `seo_title`
   der siger "test". Ordet skal vaek alle steder, hvor metodesiden siger, at vi
   ikke tester.
4. **Fjern de laekkede feed-noter:** 56 entries med "ikke oplyst i feedet" og
   "Flyttet hertil" i sovepose. Enten udfyld oplysningen eller lad linjen vaere.
5. **Ret aeoeaa i 1 guidetekst og 8 entries**, og den meningsloese
   myggenet-saetning.
6. **Ensret shelter-antallet.** Ét tal fra databasen, afrundet ét sted, brugt
   alle steder. Fjerner 1700 mod 1.600 mod 800+.
7. **Opdatér partnersiden med alle syv forhandlere** plus Soelund Huse og
   Booking.com. Det er ogsaa et compliance-hul, ikke kun et tillidshul.

### Fase 2: gоer feedet synligt (ca. 1 dag, stoerste loeftestang)

8. **Kortlæg `Båludstyr` og `Bålsted`** (78 varer) til en ny `baaludstyr`-kategori,
   og tilfoej baal-regler i `web/lib/kategori-fra-navn.ts`.
9. **Afvis stoejen aktivt:** `Batteri`, `Skiudstyr`, `Indersål`, `Hjemmesko`,
   `Lynlås`, `Skistave`, `Hængelås`, `Pung`, `Skibriller`, `Madkasse`. En
   eksplicit afvisning er bedre end et manglende svar, fordi
   `kategoriFraNavn` ellers kan gaette paa dem senere.
10. **Kortlæg `Krus`, `Kop`, `Drikkeflaske`, `Tæppe`, `Reb`** (129 varer).
11. **Ret `lygte` og `kniv`**, saa cykellygter og proptraekkere ikke lander dér.
12. **Flyt stoejfilteret fra `GuideDeals` ind i `getTopDeals`**, saa `/tilbud`
    faar den samme beskyttelse som tilbudsblokkene i guiderne. Det er hullet i
    mit eget arbejde fra i forgaars: filteret virker i guiderne, men `/tilbud`
    er ubeskyttet, og det er 4 % af klikkene.
13. Koer `scripts/afstem-kategorier.ts` bagefter, saa de gemte vaerdier er enige
    med koden uden at vente paa den natlige synk.

### Fase 3: Q4, tidskritisk (foer 27. november)

14. **Black Friday-side.** Den kan bygges af det feed, der nu er kortlagt, og
    skal vaere indekseret i god tid. Begge store konkurrenter har en.
15. **Julegaveguide under 200, 500 og 1000 kr.** Samme datagrundlag, tre
    prisfiltre.
16. **Kuratér `/tilbud`** faerdigt, nu hvor filteret ligger i `getTopDeals`.

### Fase 4: shelter-vinkel i de sider der tjener (ca. 2 dage)

17. **`sovepose-til-vinter`** (95 klik, 0 omtaler af shelter): en H2 om aaben
    front, fugt og kulde fra jorden i et shelter, og en skaerpet `seo_title`.
18. **Samme for `liggeunderlag`** (90 klik) **og `campingstol`** (130 klik).
19. **`sovepose`** har allerede 4 omtaler. Her er opgaven titel og
    indledning, ikke mere tekst.
20. **Ingen `/bedste/sovepose-til-shelter`.** Den ville konkurrere med sitets
    stoerste indtaegtskilde.
21. **`forhaeng til shelter`** er den ene nye shelter-intent-side, der er
    forsvarlig: der findes ingen side at skaerpe, og Soelund Huse er allerede
    partner.

### Fase 5: nye sider, kun hvor feedet baerer dem (ca. 1 uge)

I denne raekkefoelge, fordi det er den raekkefoelge klikdataene og feedet
peger paa:

22. **`lagenpose`** som egen side (72 varer, 6 brands). Den ligger i dag inde i
    `sovepude`, og sovegrej er 37 % af klikkene.
23. **`baaludstyr`** (78 varer efter fase 2), linket fra
    `/shelter-med-baalplads` og `/baalhytte`, som allerede findes.
24. **`termokrus` og `termoflaske`** (95 og 78 varer). Ikke termokande: 3 varer.
25. **`koeleboks`** (59 varer, 9 brands).
26. **`tipi og lavvu`** (62 varer), som hoerer til `koeb-shelter`-klyngen med
    hoej ordrevaerdi.
27. **`solcellepanel`** (25 varer), som auditten med rette fremhaever: ingen
    danske outdoor-affiliates i top 7, og hoej ordrevaerdi.

Ikke paa listen, selvom auditten foreslaar dem: hund-klyngen, outdoor-ur,
termokande, sommersovepose, dobbelt sovepose, skumunderlag, bivuaksaek. De har
nul eller naesten nul varer. De bliver foerst mulige med en ny forhandler.

### Fase 6: teknik og struktur (lоebende, smaa opgaver)

28. **Ret de 18 forside-links** til at pege direkte paa `/danmark/...` i stedet
    for 308-redirect.
29. **Udvid footeren** fra 4 til de guider der baerer trafikken, og udvid
    pakkelisten fra 11 til de relevante.
30. **`/naturophold`:** Booking.com-modulet tjener 37 klik, men landingssiden er
    tom. Byg den foerste guide af de 15 publicerede ophold, eller fjern linket
    fra `/bedste` indtil den er der.
31. **Fjern `/danmark/danmark/ukendt-kommune`** fra sitemappet, eller giv de
    shelters en rigtig kommune. Det er 1 URL, saa det er ikke vigtigt.
32. **Hotlinkede produktbilleder:** auditten anbefaler selv-hosting. Det skal
    afvejes mod, at projektet allerede har et egress-overforbrug paa Supabase.
    Lav det kun, hvis billederne faktisk fejler, ellers er cachen i
    `/_next/image` god nok.

### Fase 7: forhandlere (parallelt, laengste gennemloebstid)

33. **Ansoeg Outnorth via Awin.** Det er den eneste anbefaling i auditten, der
    aabner for de brands, der mangler, og den har en ansoegningstid, saa den
    skal startes nu og ikke til sidst.
34. **Byggemarkeder til `koeb-shelter`-klyngen.** Hoej ordrevaerdi, og
    konkurrenterne i top 7 er rene saelgere.
35. **Hund-klyngen kraever en forhandler**, ikke indhold.

### Det jeg ikke kan validere

Placeringerne. Auditten har ét ikke-personaliseret oejebliksbillede fra én dag,
afbrudt af CAPTCHA efter cirka 40 soegninger. Der er ingen soegevolumen i den.
`referrer_host` er tom i 98 % af klikkene, saa jeg kan heller ikke se det
indefra. Foer fase 5 boer Search Console kobles paa, saa de nye sider vaelges
paa faktiske visninger og CTR frem for paa et skaermbillede af en SERP.

## Hvad jeg anbefaler at starte med

Fase 1 og 2. De retter noget maalbart i stykker paa de sider, der tjener 37 %
af pengene, de kraever ingen nye forhandlere og intet nyt indhold, og fase 2
goer 28 % af feedet synligt, hvilket er en forudsaetning for naesten alt andet
i auditten. Fase 3 er tidskritisk og skal startes senest midt i november.
