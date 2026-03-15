export type GuideCategory =
  | "Pakkeliste"
  | "Regler"
  | "Begynder"
  | "Mad"
  | "Vinter"
  | "Udstyr";

export const GUIDE_CATEGORIES: GuideCategory[] = [
  "Pakkeliste",
  "Regler",
  "Begynder",
  "Mad",
  "Vinter",
  "Udstyr",
];

export interface Guide {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: GuideCategory;
  faq?: { question: string; answer: string }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "pakkeliste-til-sheltertur",
    title: "Pakkeliste til sheltertur – den komplette tjekliste",
    excerpt:
      "Den store pakkeliste til sheltertur: sovegrej, tøj, mad, køkken, sikkerhed og små detaljer – så du ikke glemmer noget, før du tager afsted.",
    coverImage:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop",
    category: "Pakkeliste",
    content: `
## 1. Sovegrej – det allervigtigste

Hvis du kun skal huske én ting, er det **sovegrej**. Uden god søvn bliver alt andet surt.

Pak mindst:

- **Sovepose** der passer til årstiden (tjek comfort-temperaturen)
- **Liggeunderlag** – gerne oppusteligt + evt. skumunderlag under til kulde
- Evt. **pude** eller et sammenrullet trøje

Overvej også:

- Lagenpose eller indersovepose (nemmere at vaske)
- Tarp eller lille telt, hvis du er i tvivl om hvor tæt shelteret er

![Sovepose og liggeunderlag klar til en nat i shelteret](https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&q=80&auto=format&fit=crop)

## 2. Tøj – lag på lag

Vejret kan skifte hurtigt. Brug lag-på-lag, så du kan justere undervejs.

Pak fx:

- Uld eller syntetisk **undertøj**
- 1–2 trøjer (fx fleece eller uld)
- Vind- og vandtæt jakke
- Ekstra sokker (gerne uld) og undertøj
- Hue, handsker og halstørklæde uden for sommersæsonen

Til børn er det bedre at have **ét lag for meget** end ét for lidt – især om aftenen ved bålet. Læs også vores artikel om [shelter med børn](/blog/shelter-med-boern) for flere familietips.

## 3. Mad og køkken

Gør det simpelt – så du kan hygge dig, i stedet for at stå med et avanceret køkkenprojekt.

Grundlæggende køkken:

- Trangia eller lille gasbrænder
- Brændstof / gas + tændstikker/tændstål
- 1 gryde og evt. 1 pande
- Krus, tallerken og bestik pr. person
- Skarp kniv og lille skærebræt

Madidéer til shelter:

- One-pot pasta eller gryderet
- Pølser og grønt på pande
- Havregrød til morgenmad
- Snobrød eller pandekager til hygge

Husk også:

- **Vand** (hvis der ikke er vand ved shelteret)
- Skraldeposer – alt du tager med ud, skal med hjem igen

## 4. Hygiejne og komfort

Det behøver ikke være luksus – men lidt komfort gør turen markant bedre.

Pak fx:

- Tandbørste, tandpasta og evt. lille håndklæde
- Håndsprit eller vådservietter
- Toiletrulle i vandtæt pose
- Lille førstehjælpskit (plaster, sportstape, smertestillende, vabelplastre)

## 5. Lys, strøm og sikkerhed

Det bliver **mørkt** i skoven – også selvom du er tæt på byen.

Husk:

- Pandelygte til alle + ekstra batterier
- Powerbank til telefon
- Kort eller offline kort på mobilen

Tænk også over sikkerhed:

- Fortæl nogen, hvor I skal hen, og hvornår I er hjemme igen
- Hav styr på vejrudsigten, før I tager afsted

![Pandelygte og udstyr pakket klar til sheltertur](https://images.unsplash.com/photo-1532339142463-fd0a8979791a?w=1200&q=80&auto=format&fit=crop)

## 6. Små ting der gør turen ekstra god

Det er ofte de små ting, man bliver gladest for:

- Siddemåtte eller lille foldestol
- Spil eller kort til aftenen
- En god bog eller notesbog
- Skumfiduser, chokolade eller anden lille luksus

Med denne pakkeliste er du dækket ind til de fleste shelterture – både med venner, kæreste og familie. Har du brug for mere inspiration til udstyr, så tjek vores [udstyrguide for begyndere](/blog/udstyr-guide-begyndere).

Hvis du vil dykke endnu mere ned i forberedelserne, kan du læse guiden [Shelter for begyndere – sådan får du en god første tur](/guides/shelter-for-begyndere-forste-tur) og vores tips til [Mad over bål – nem shelter-mad til hele turen](/guides/mad-over-bal-nem-shelter-mad). Begynder du at planlægge ture i de koldere måneder, er [Overnatning i shelter om vinteren – sådan gør du](/guides/overnatning-i-shelter-om-vinteren) et godt supplement til denne pakkeliste. Find din næste shelterplads via [Søg shelters](/soeg).
    `.trim(),
    faq: [
      {
        question: "Hvad skal man have med på en sheltertur?",
        answer:
          "De vigtigste ting er sovepose, liggeunderlag, varmt tøj i lag, mad og drikke, pandelygte og en god skraldepose. Se den fulde pakkeliste ovenfor for en komplet tjekliste.",
      },
      {
        question: "Skal man have sovepose med i et shelter?",
        answer:
          "Ja, altid. Shelters har ingen dyner eller madrasser – du skal selv medbringe sovepose og liggeunderlag. Vælg en sovepose, der passer til årstiden.",
      },
      {
        question: "Hvad spiser man nemmest på sheltertur?",
        answer:
          "Pølser, one-pot pasta, havregrød og snobrød er klassikere, der er nemme at tilberede over bål eller gasblus. Læs mere i vores guide til shelter-mad.",
      },
    ],
  },
  {
    slug: "regler-for-shelter-og-teltning-i-danmark",
    title: "Regler for shelter og teltning i Danmark",
    excerpt:
      "Få styr på de vigtigste regler for shelters og teltning i Danmark: hvor længe du må blive, om du må drikke alkohol, og hvem der har førsteret til pladsen.",
    coverImage:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80&auto=format&fit=crop",
    category: "Regler",
    content: `
## Hvor længe må man blive på et shelter?

Reglerne kan variere alt efter, hvem der ejer eller forvalter området (Naturstyrelsen, kommune, privat). Som hovedregel gælder:

- På **Naturstyrelsens primitive overnatningspladser** er det ofte tilladt at blive op til **2 nætter** samme sted.
- På **fri teltning-områder** (uden faste shelters) må du typisk overnatte **én nat** samme sted.

Tjek altid:

- Beskrivelsen på sheltersiden
- Evt. skiltning på pladsen
- [Naturstyrelsens hjemmeside](https://naturstyrelsen.dk/) eller kommunens side, hvis du er i tvivl

Du kan også finde overnatningspladser på [Ud i Naturen](https://udinaturen.dk/), som samler mange af landets shelters og lejrpladser.

![Skiltning ved en primitiv overnatningsplads i skoven](https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80&auto=format&fit=crop)

## Må man drikke alkohol ved shelteret?

Der findes sjældent en specifik lov mod at drikke alkohol ved et shelter – men:

- Du skal følge **almindelige ordensregler**
- Du må ikke være til gene for andre gæster eller naboer
- Åbenlys støj og fest er sjældent populært

På nogle kommunale eller private pladser kan der være **særlige regler** – respekter dem, hvis de er skiltet eller nævnt i beskrivelsen. Læs mere om god opførsel i vores artikel om [shelter-etikette](/blog/shelter-etiquette).

## Hvem har førsteret til shelteret?

Her er udgangspunktet:

- Mange shelters er **først-til-mølle** – den der kommer først, må bruge pladsen.
- På **bookbare shelters** har den, der har booket, naturligvis førsteret i det tidsrum, der er reserveret.

Det er god stil at:

- Spørg venligt, om der er plads til flere, hvis nogen allerede er der
- Vær åben for at dele shelteret, når det ikke er eksklusivt booket

## Hvor må man slå telt op?

I Danmark må du **ikke** bare slå telt op hvor som helst.

Du må bl.a.:

- Telte på udvalgte **fri teltning-områder** (se [Naturstyrelsens kort](https://naturstyrelsen.dk/))
- Telte på **primitive overnatningspladser**, hvor det er angivet

Du må ikke:

- Telte på private marker, skove eller strande uden tilladelse
- Overnatte i klitter og sårbare naturområder

![Telt ved en shelterplads i dansk natur](https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop)

## Generelle naturregler du skal kende

- Tag altid dit affald med – også madrester og cigaretskod
- Respekter eventuelle **bålforbud**
- Parker kun, hvor det er tilladt
- Lad dyrelivet være i fred, og hold hund i snor hvor det kræves

Hvis du følger disse grundregler, kan du roligt nyde din tur uden at være i konflikt med lovgivning eller lokale regler.

Vil du have hjælp til at vælge selve pladsen, kan du kombinere denne guide med [Shelter for begyndere – sådan får du en god første tur](/guides/shelter-for-begyndere-forste-tur) og vores store [Pakkeliste til sheltertur – den komplette tjekliste](/guides/pakkeliste-til-sheltertur). Du kan altid starte din søgning efter konkrete pladser på [Søg shelters](/soeg), hvor du kan filtrere efter område, faciliteter og booking.
    `.trim(),
    faq: [
      {
        question: "Hvor længe må man overnatte i et shelter i Danmark?",
        answer:
          "På Naturstyrelsens primitive overnatningspladser må du som regel blive op til 2 nætter samme sted. Ved fri teltning-områder er det typisk kun 1 nat. Tjek altid skiltning og pladsens beskrivelse.",
      },
      {
        question: "Skal man booke et shelter på forhånd?",
        answer:
          "Det afhænger af pladsen. Nogle shelters er først-til-mølle, mens andre kan eller skal bookes. Tjek den enkelte plads på ShelterDK eller via Ud i Naturen for at se, om booking er mulig.",
      },
      {
        question: "Må man tænde bål ved et shelter?",
        answer:
          "Du må som regel tænde bål på de dertil indrettede bålpladser ved shelteret. Tjek dog altid for eventuelle bålforbud, som kan gælde i tørre perioder – også uden for sommeren.",
      },
    ],
  },
  {
    slug: "shelter-for-begyndere-forste-tur",
    title: "Shelter for begyndere – sådan får du en god første tur",
    excerpt:
      "Ny i shelters? Her får du en enkel introduktion til valg af plads, grej, mad og gode vaner, så din første tur bliver en succes.",
    coverImage:
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1200&q=80&auto=format&fit=crop",
    category: "Begynder",
    content: `
## Start simpelt – vælg en nem plads

Til din første sheltertur er det en god idé at vælge:

- En plads **tæt på parkering**
- Med **toilet** og gerne **vand**
- Evt. en bookbar plads, så du ved, at I har shelteret

Brug filtrene på ShelterDK til at [finde en plads, der passer](/soeg). Du kan også udforske shelters og lejrpladser via [Ud i Naturen](https://udinaturen.dk/).

![Et shelter i skoven klar til overnatning](https://images.unsplash.com/photo-1476041800959-2f6bb412c8ce?w=1200&q=80&auto=format&fit=crop)

## Hold varmen – især om natten

De fleste bliver overraskede over, hvor koldt det kan føles – også om sommeren.

- Brug lag-på-lag tøj (uld inderst)
- Hav tørre sokker kun til natten
- Sørg for, at du ligger isoleret fra jorden (godt liggeunderlag)

Hvis du fryser:

- Spis lidt og drik noget varmt
- Lav et par små øvelser (armstrækninger/squats) før du kravler i posen

Er du nysgerrig på vinterovernatning, kan du læse [Overnatning i shelter om vinteren](/guides/overnatning-i-shelter-om-vinteren).

## Mad, der ikke kan gå galt

Som begynder er det smart at vælge mad, der er svært at ødelægge:

- Pølser + brød + grønt
- One-pot pasta med fx tomatsauce og grøntsager
- Havregrød med toppings til morgenmad

Gem de avancerede bålretter til senere – første tur handler mest om oplevelsen.

## Gode vaner fra starten

Hvis du allerede på første tur øver dig i gode vaner, bliver alt nemmere fremover:

- Pak skrald sammen løbende
- Læg ting tilbage på samme sted i tasken
- Aftal, hvem der gør hvad (bål, mad, opvask)

Læs om god shelteropførsel i vores artikel om [shelter-etikette](/blog/shelter-etiquette), og tjek [reglerne for shelter og teltning](/guides/regler-for-shelter-og-teltning-i-danmark), inden du tager afsted.

![Bålplads ved et shelter med udsigt over naturen](https://images.unsplash.com/photo-1475483768296-6163e08872a1?w=1200&q=80&auto=format&fit=crop)

Så bliver shelterlivet hurtigt let og naturligt.

Når du er klar til næste skridt, kan du bruge vores [Pakkeliste til sheltertur – den komplette tjekliste](/guides/pakkeliste-til-sheltertur) som fast reference og hente madinspiration i [Mad over bål – nem shelter-mad til hele turen](/guides/mad-over-bal-nem-shelter-mad). Du finder konkrete pladser og områder ved at bruge kort og filtre på [Søg shelters](/soeg).
    `.trim(),
    faq: [
      {
        question: "Hvad koster det at overnatte i et shelter?",
        answer:
          "De fleste shelters i Danmark er gratis at bruge. Nogle bookbare shelters kan have et mindre gebyr. Tjek den enkelte plads for detaljer.",
      },
      {
        question: "Er shelters i Danmark åbne hele året?",
        answer:
          "Ja, de fleste shelters er tilgængelige året rundt. Husk dog, at faciliteterne kan være begrænsede om vinteren – fx kan vand være lukket.",
      },
      {
        question: "Kan man tage børn med på sheltertur?",
        answer:
          "Absolut! Vælg en plads tæt på parkering med toilet og gerne bålplads. Start med én nat og pak ekstra varmt tøj. Læs vores artikel om shelter med børn for flere tips.",
      },
    ],
  },
  {
    slug: "mad-over-bal-nem-shelter-mad",
    title: "Mad over bål – nem shelter-mad til hele turen",
    excerpt:
      "Idéer til nem og lækker mad over bål: snobrød, one-pot gryderetter, morgenmad og søde sager til aftenhyggen.",
    coverImage:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80&auto=format&fit=crop",
    category: "Mad",
    content: `
## Basisudstyr til mad over bål

Du behøver ikke et helt udekøkken for at lave god mad over bål. Som regel rækker:

- Bålrist eller trefod (hvis det findes på pladsen)
- 1–2 solide gryder/pander
- Tang eller grillhandske

Husk at tjekke, om der er **bålplads** og om der er **bålforbud** i området. Aktuelle bålforbud kan ses på [Naturstyrelsens hjemmeside](https://naturstyrelsen.dk/).

![Mad over bål i en gryde ved shelterplads](https://images.unsplash.com/photo-1510672981848-a1c4f1cb5ccf?w=1200&q=80&auto=format&fit=crop)

## Snobrød – klassikeren

En simpel snobrødsdej:

- 500 g hvedemel
- 1 tsk salt
- 1 spsk sukker
- 25 g gær eller 1 pose tørgær
- Ca. 3 dl lunkent vand

Lad dejen hæve i en skål eller pose. Sno tynde pølser af dej om en pind, og bag over gløder – ikke direkte i flammer.

## One-pot gryderetter

One-pot betyder, at **alt laves i én gryde**:

- Steg løg og evt. kød
- Tilsæt grøntsager og krydderier
- Hæld vand/bouillon og pasta/ris i

Fordele:

- Færre ting at vaske op
- Du kan let justere mængde og krydderi

## Morgenmad på bål

Enkle idéer:

- Havregrød med æble, kanel og nødder
- Røræg i pande
- Brød ristet på rist med ost

![Morgenmad med kaffe og havregrød ved bålet](https://images.unsplash.com/photo-1517824806704-9040b037703b?w=1200&q=80&auto=format&fit=crop)

## Søde sager til sidst

Når gløderne er perfekte:

- Bag æbler fyldt med rosiner og kanel i folie
- Lun pandekager eller pandekage-mix
- Rist skumfiduser og lav små "s'mores" med kiks og chokolade

Hold det simpelt – det vigtigste er, at I hygger jer omkring bålet. Planlægger du en tur i forår eller sommer, kan du kombinere med vores tips til [shelter i forår og sommer](/blog/shelter-foraar-sommer).

Hvis du gerne vil kombinere madplanen med en god pakkeliste og tips til valg af plads, så læs også [Pakkeliste til sheltertur – den komplette tjekliste](/guides/pakkeliste-til-sheltertur) og [Shelter for begyndere – sådan får du en god første tur](/guides/shelter-for-begyndere-forste-tur). Når du har styr på madidéerne, kan du bruge [Søg shelters](/soeg) til at finde pladser med bålplads og de faciliteter, der passer til din tur.
    `.trim(),
    faq: [
      {
        question: "Kan man lave mad over bål ved alle shelters?",
        answer:
          "Nej, ikke alle shelters har bålplads. Tjek altid pladsens beskrivelse, og respekter eventuelle bålforbud. Du kan filtrere efter bålplads på Søg shelters.",
      },
      {
        question: "Hvad er den nemmeste mad at lave over bål?",
        answer:
          "Pølser, snobrød og one-pot pasta er nogle af de nemmeste retter. De kræver minimalt udstyr og er svære at ødelægge – perfekt til begyndere.",
      },
    ],
  },
  {
    slug: "overnatning-i-shelter-om-vinteren",
    title: "Overnatning i shelter om vinteren – sådan gør du",
    excerpt:
      "Drømmer du om vinter-shelter? Få styr på udstyr, sikkerhed og gode rutiner, så turen bliver kold på den gode måde – ikke den ubehagelige.",
    coverImage:
      "https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?w=1200&q=80&auto=format&fit=crop",
    category: "Vinter",
    content: `
## Er vinter-shelter noget for dig?

Ja – hvis du forbereder dig ordentligt. Vinterovernatning i shelter giver:

- Klare stjernehimler
- Færre mennesker
- En helt særlig ro

Men kulden skal tages alvorligt. Har du aldrig prøvet shelter før, kan det være en idé at starte med en [sommertur først](/blog/shelter-foraar-sommer).

![Vinterlandskab med sne og et shelter i skoven](https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1200&q=80&auto=format&fit=crop)

## Varm sovepose og rigtig underlag

Til vinter skal du have:

- Sovepose med **comfort-temperatur under** forventet nattemperatur
- Minimum ét godt liggeunderlag – gerne to (skum + oppusteligt)
- Hue, halsedisse og tørre uldsokker kun til nat

Undgå at sove i fugtigt tøj – skift til tørt sæt, før du lægger dig. Se også vores [udstyrguide for begyndere](/blog/udstyr-guide-begyndere) for anbefalinger til soveposer og liggeunderlag.

## Tøj og varme i løbet af dagen

Brug klassisk 3-lags princip:

- Inderst: uld eller svedtransporterende lag
- Mellem: isolerende lag (fleece/uld)
- Yderst: vind- og vandtæt jakke

Vigtigt:

- Frys ikke for længe ad gangen – bevæg dig eller lav bål
- Spis og drik regelmæssigt – kroppen laver varme af energi

## Sikkerhed og vejr

Hold ekstra øje med:

- Vejrudsigter (vind, nedbør, temperatur)
- Varsler om sne, is eller storm

Hav altid en **plan B**:

- Kendskab til nærmeste bil/bolig
- Mulighed for at afkorte turen, hvis nogen bliver for kolde

Tjek aktuelle forhold og vejrvarsler, og find egnede pladser via [Ud i Naturen](https://udinaturen.dk/) eller [Søg shelters](/soeg).

## Hvad med bål og brænde?

Vinter og vådt vejr gør det sværere at tænde bål:

- Brug små, tørre kviste og birkebark til optænding
- Medbring evt. lidt tørt brænde eller optændingsblokke

Respekter bålforbud – også om vinteren kan de forekomme. Aktuelle forbud finder du på [Naturstyrelsens hjemmeside](https://naturstyrelsen.dk/).

![Bål i sneen ved et shelter om vinteren](https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?w=1200&q=80&auto=format&fit=crop)

Med det rigtige udstyr og de rigtige rutiner kan vinter-shelter blive en af de mest mindeværdige ture, du tager på. Læs også vores tips til [shelter i regnvejr](/blog/shelter-i-regnvejr), da mange af rådene også gælder om vinteren.

Det er en god idé at kombinere denne guide med [Pakkeliste til sheltertur – den komplette tjekliste](/guides/pakkeliste-til-sheltertur) for at sikre, at du har alt med til kulden, og [Regler for shelter og teltning i Danmark](/guides/regler-for-shelter-og-teltning-i-danmark) for at være helt skarp på, hvor og hvordan du må overnatte. Brug gerne kortet og filtrene på [Søg shelters](/soeg) til at finde shelters, der ligger lidt tættere på civilisationen på dine første vinterture – så er det let at afkorte turen, hvis vejret overrasker.
    `.trim(),
    faq: [
      {
        question: "Kan man sove i shelter om vinteren?",
        answer:
          "Ja, det kan man godt – men det kræver ordentlig forberedelse. Du skal have en varm sovepose (comfort-temperatur under den forventede nattetemperatur), gode liggeunderlag og tørt tøj til natten.",
      },
      {
        question: "Hvor koldt kan det blive i et shelter om natten?",
        answer:
          "Et shelter beskytter mod vind og nedbør, men temperaturen indenfor følger stort set udetemperaturen. Om vinteren kan det nemt komme ned under frysepunktet, så forbered dig på minusgrader.",
      },
      {
        question: "Hvad gør man, hvis man fryser for meget i shelteret?",
        answer:
          "Spis noget energirigt, drik varmt, og lav lidt bevægelse som armstrækninger eller squats. Hav altid en plan B – kend vejen til nærmeste bil eller bolig, så du kan afkorte turen.",
      },
    ],
  },
];

export function getGuides(): Guide[] {
  return GUIDES;
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getGuideCategories(): GuideCategory[] {
  return GUIDE_CATEGORIES;
}

