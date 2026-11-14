# Oplæg: de 11 varer uden produktfoto

Skrevet 14. november 2026 ud fra guide-health-monitorens melding samme morgen.

## Hvad det i virkeligheden er

Alle 11 varer er fra **backpackerlife**, og ingen af dem er tilfældige. Målt på
hele deres sortiment:

| billed-URL | varer | levende | døde |
|---|---|---|---|
| **med** mellemrum | 79 | 0 | **79** |
| **uden** mellemrum (stikprøve) | 100 | **100** | 0 |
| outmore (stikprøve) | 60 | 60 | 0 |
| outdoortid (stikprøve) | 60 | 60 | 0 |

WordPress saniterer filnavne ved upload og gemmer aldrig en fil med mellemrum i
navnet, så de URL'er har **aldrig eksisteret**. Backpackerlifes feed bygger dem
ud af varens titel i stedet for at skrive den rigtige vedhæftning. Jeg har
prøvet at gætte det rigtige filnavn (mellemrum fjernet, erstattet af
bindestreger, af understregninger) — alle 404. Der er intet at gætte på.

Reglen er nu kode i `web/lib/affiliate-billede.ts`, så `ProduktBillede` viser
reserven med det samme og monitoren fanger det uden netværksopslag.

**Det her oplæg løser derfor ikke problemet, kun de 11 synlige tilfælde.** Så
længe guiderne læner sig 42 til 100 procent op ad backpackerlife, rammer det
nogle andre varer næste gang deres feed genereres. Den varige løsning er at
fortælle backpackerlife det; de taber selv salg på varer uden foto.

## Det e-mailen ikke nævnte

**Fire af de elleve er guidens "Vores valg"**, altså sidens primære anbefaling:
`bestik`, `campingstol`, `gamacher` og `telt`. Det er netop den vare, der står
uden foto, og et produktfoto er et købssignal.

## Forslag, guide for guide

Alle foreslåede varer er tjekket enkeltvis med en rigtig GET: på lager, ikke
blokeret, og billedet svarer 200. Backpackerlife er prioriteret hvor de har en
brugbar vare, så din præference for dem holdes — de to undtagelser (`bestik` og
`pandelampe`) er der, hvor backpackerlife slet ikke har en brugbar vare.

### 1. vandresokker · rank 2 · "Bedst til prisen" — den nemme

| | |
|---|---|
| Ud | Vandresokker Highlander Crusader **Sort**, 79 kr |
| Ind | Vandresokker Highlander Crusader **Grøn**, 79 kr, backpackerlife |

Samme vare, anden farve. Pris, mærke og prædikat holder uændret, og teksten
nævner den ikke ved navn. Ingen redaktionelle følger overhovedet.

### 2. vandrestav · rank 1 · "Bedst til prisen"

| | |
|---|---|
| Ud | Vandrestave Highlander Mull, 249 kr |
| Ind | Vandrestave **Highlander Tiree**, 249 kr, backpackerlife |
| Alternativ | Treklife EVA Light, 199 kr |

Samme mærke, samme pris, så prædikatet holder. Teksten nævner den ikke.

### 3. liggeunderlag-til-vinter · rank 4 · "Bedste premium"

| | |
|---|---|
| Ud | Liggeunderlag Klymit Insulated V Ultralite SL, 1.199 kr |
| Ind | Liggeunderlag **Klymit Insulated Static V Luxe SL**, 1.199 kr, backpackerlife |

Samme mærke, samme pris, stadig isoleret, altså stadig en vinterbane. Teksten
nævner den ikke.

### 4. telt · rank 0 · **"Vores valg"**

| | |
|---|---|
| Ud | Telt High Peak Nevada 2.1, 2 personer, 599 kr |
| Ind | Telt **High Peak Narvik**, 2 personer, 599 kr, backpackerlife |
| Alternativ | High Peak Sparrow 2, 2 personer, 629 kr |

Samme mærke, samme størrelse, samme pris. Teksten nævner ikke modellen.
Bemærk at feedets billede til den døde vare i forvejen pegede på et
**4.1/4-personers** telt, altså et forkert foto for en 2-personers model.

### 5. letvaegtstelt · rank 4 · "Bedste ultralette"

| | |
|---|---|
| Ud | Telt Nordisk Lofoten 2 ULW, 2 personer, 7.499 kr |
| Ind | Telt **Nordisk Telemark 2 LW**, 2 personer, 5.399 kr, backpackerlife |

Samme mærke og stadig i ultralet-banen. Prisen falder 2.100 kr, hvilket faktisk
klæder en guide hvis øvrige varer ligger på 495 til 1.399 kr; Lofoten stak langt
ud. Teksten nævner den ikke.

### 6. bestik · rank 0 · **"Vores valg"**

| | |
|---|---|
| Ud | Spork Light My Fire Original BIO, 29 kr, backpackerlife |
| Ind | **Light My Fire Spork Original BIO**, 35 kr, **outmore** |

Nøjagtig samme produkt hos en anden butik, bare 6 kr dyrere. Brødtekstens afsnit
"Spork eller sæt" holder ord for ord. Det er den eneste af de elleve hvor den
samme vare findes et andet sted med et levende billede.

Bemærk at outmore kun fører den i farver (rockyred, hazyblue, mustyyellow,
dustypink, mistypurple), så varenavnet på kortet kommer til at nævne en farve.

### 7. dry-bag · rank 4 · "Bedste med kompression"

| | |
|---|---|
| Ud | Dry bag med kompression, Sea to Summit Evac, 8 liter, 199 kr |
| Ind | **Dry bag med kompressionstropper, Sea to Summit Evac, 5 liter**, 299 kr, backpackerlife |

Samme serie, så prædikatet og brødtekstens afsnit "Kompression: spar plads"
(som nævner Sea to Summit Evac ved navn) holder begge. Men **det er 5 liter mod
8, og 100 kr dyrere**. Guidens "Vores valg" er i forvejen en 8-liters, så
størrelsesspringet ned gør den mindre overlappende. Sig til hvis du hellere vil
have en af de større Evac Heavy (449, 495 eller 599 kr).

### 8. pandelampe · rank 9 · "Bedste til børn"

| | |
|---|---|
| Ud | Pandelampe til børn, Black Diamond Wiz, 149 kr, backpackerlife |
| Ind | **LEDLenser KIDLED2 Pandelampe til børn, Grøn**, 199 kr, **outmore** |
| Alternativ | PETZL TIKKID børnesikret, Blå, 229 kr, outmore |

Backpackerlife har **ingen** børnepandelampe med et levende billede, så den her
må skifte butik hvis prædikatet skal blive stående.

Jeg foreslår den **grønne** frem for den lilla, selv om den lilla er 39 kr
billigere (159,95 kr). Feedet fører KIDLED2 i lilla og grøn, og TIKKID i blå og
en der hedder "Pink **pige** pandelampe". En guide der anbefaler "bedste til
børn" bør ikke lande på en farve der læser som et køn. Vil du hellere have den
billigste, er den lilla tjekket og har også et levende billede.

### 9. campingstol · rank 0 · **"Vores valg"** — kræver tekstændring

| | |
|---|---|
| Ud | Stol Treklife **Low-back** UL Chair, 229 kr |
| Ind | Stol Treklife **High-back** UL Chair, 279 kr, backpackerlife |

Brødteksten siger i dag:

> "Her ligger Treklifes UL-serie: Low-Back på 1.030 gram og Luxe med fuldt
> ryglæn på 1.850 gram."
> "Skal stolen bæres, er **Treklife Low-Back UL** guidens førstevalg: 1.030 gram
> og 449 kr."

**To ting skal rettes uanset hvad du vælger.** Teksten udpeger Low-Back som
førstevalg ved navn, og den skriver **449 kr** om en vare der står til **229 kr**
i feedet. Den prisfejl står der allerede i dag og har intet med billedet at gøre.

Vægten på 1.030 gram gælder Low-Back, ikke High-back, og feedet har ingen specs,
så vægten på den nye skal findes hos producenten før den må skrives.

### 10. gamacher · rank 0 · **"Vores valg"** — flyt prædikatet i stedet

| | |
|---|---|
| Ud | Gaiters Black Diamond Frontpoint GTX V2, Sort, 399 kr |
| Ind | **ingen ny vare. Flyt "Vores valg" til Montane Cetus Gaiter**, 599 kr, som allerede står på siden |

Der findes ikke én brugbar erstatning: alle fem kandidater i kategorien er
Vaude **cykel**-gamacher, altså et andet produkt. Guiden har i forvejen syv
varer, så den mangler ikke bredde, kun et førstevalg med et foto.

Brødteksten siger:

> "Til de fleste: **Black Diamond Frontpoint GTX** — vandtæt, holdbar og alsidig
> til våd vandring og vinter."

Den sætning skal skrives om til den nye favorit, ellers anbefaler teksten en
vare der ikke er på siden. Monitorens `staleBrands`-tjek vil melde det.

### 11. dunsovepose · rank 5 · "Letteste" — jeg har ikke et forsvarligt forslag

| | |
|---|---|
| Ud | Dunsovepose Nordisk Phantom 220 Left-Zip XL, 2.399 kr |
| Ind | **kan ikke afgøres af feedet** |

Prædikatet er "Letteste". Feedet har ingen vægtangivelser, så jeg kan ikke
udpege en afløser uden at slå vægten op hos producenten for hver kandidat.
Nærmeste i pris er Sea to Summit Trek -1 (2.199 til 2.299 kr) og Nordisk Freja
-5 XL (2.199 kr), men **ingen af dem er dokumenteret lettere** end resten af
opstillingen, og et "Letteste" uden dækning er en usand påstand på siden.

To forsvarlige veje:

1. Du oplyser vægten på to-tre kandidater, så vælger jeg den letteste.
2. Prædikatet fjernes, og varen udgår uden erstatning. Guiden har stadig syv
   varer, hvilket er over grænsen på fem.

## Sådan sættes det i værk

`scripts/guide_candidates.py --apply` **tilføjer kun** varer. Den fjerner ikke
den gamle, og den kan ikke flytte et prædikat. Så for hver guide er der tre
skridt, ikke ét:

1. Opret den nye entry (via `--apply` eller i admin).
2. **Slet den gamle entry** — ellers står begge på siden, og den uden foto
   beholder sit prædikat.
3. Ret brødteksten på `campingstol` og `gamacher`, og prisen på `campingstol`.

Derefter revalider de ændrede sider:

```bash
curl -X POST https://shelterdk.dk/api/revalidate -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{"paths":["/bedste/vandresokker","/bedste/vandrestav","/bedste/liggeunderlag-til-vinter","/bedste/telt","/bedste/letvaegtstelt","/bedste/bestik","/bedste/dry-bag","/bedste/pandelampe","/bedste/campingstol","/bedste/gamacher"]}'
```
