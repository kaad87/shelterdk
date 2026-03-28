export type GuideCategory =
  | "Pakkeliste"
  | "Regler"
  | "Begynder"
  | "Mad"
  | "Vinter"
  | "Udstyr"
  | "Natur";

export const GUIDE_CATEGORIES: GuideCategory[] = [
  "Pakkeliste",
  "Regler",
  "Begynder",
  "Mad",
  "Vinter",
  "Udstyr",
  "Natur",
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
    slug: "shelter-i-nationalparker",
    title: "Shelter i nationalparker – find naturens bedste pladser",
    excerpt:
      "Danmark har fem nationalparker med unikke sheltermuligheder. Udforsk shelters i Thy, Mols Bjerge, Vadehavet, Skjoldungernes Land og Kongernes Nordsjaelland.",
    coverImage:
      "https://images.unsplash.com/photo-1723637012148-6ea41e4517be?w=1200&q=80&auto=format&fit=crop",
    category: "Natur",
    content: `
## Derfor er nationalparkerne perfekte til shelterture

Danmarks fem nationalparker samler noget af det mest varierede og beskyttede natur, vi har. Her finder du alt fra brede klitheder og stille fjorde til tykke boskove og dramatiske kystlinjer. Fælles for dem er, at de tilbyder primitive overnatningspladser og shelters, der ligger midt i uforstyrret natur. En sheltertur i en nationalpark giver dig mulighed for at komme helt tæt på landskabet og opleve stilheden, fuglelivet og de store vidder på en måde, som en dagsudflugt aldrig kan matche.

Herunder gennemgår vi alle fem danske nationalparker, hvad du kan forvente af shelteroplevelsen i hver, og hvordan du bedst planlægger din tur.

## Nationalpark Thy – klitter, hede og vild vestkyst

Nationalpark Thy strækker sig langs Vestkysten i Nordjylland og er Danmarks ældste nationalpark. Landskabet er præget af vidtstrakte klitheder, nåleskove og friske søer.

### Shelteroplevelsen i Thy

Thy byder på flere primitive overnatningspladser fordelt langs vandreruter og cykelstier. Shelters her ligger typisk i læ bag klitterne eller i kanten af plantager, og mange pladser har bålplads og adgang til brænde. Forvent en rå og enkel oplevelse med lyden af havet i baggrunden. Vær forberedt på, at vinden kan være kraftig langs kysten, og pak vindtæt tøj.

### Sådan kommer du dertil

Thy er lettest tilgængelig med bil via rute 11 langs vestkysten. Nærmeste større by er Thisted. Du kan også tage tog til Thisted og cykle videre ud i parken. Udforsk flere shelters i området via [Jylland-siden](/danmark/jylland).

## Nationalpark Mols Bjerge – bakker og fjordudsigt

Mols Bjerge på Djursland er kendt for sine bakker, overdrev og panoramaudsigter over Ebeltoft Vig og Kalø Vig.

### Shelteroplevelsen i Mols Bjerge

Her finder du shelters og lejrpladser med udsigt over det bakkede landskab. Terrænet er lettere kuperet, og vandreruterne fører dig gennem både skov og åbne overdrev. Flere pladser har toilet og bålplads. Mols Bjerge er et godt valg, hvis du gerne vil kombinere sheltertur med vandring i varieret terræn.

### Sådan kommer du dertil

Kør mod Ebeltoft eller Rønde, hvorfra der er kort afstand til parkens indgange. Offentlig transport via bus fra Aarhus er også muligt. Shelters i området kan du finde under [Jylland](/danmark/jylland).

## Nationalpark Vadehavet – marsk, tidevand og fugle

Vadehavet i Sydvestjylland er UNESCO Verdensarv og et af de vigtigste vådområder i Nordeuropa. Her mødes hav og land i et landskab, der skifter med tidevandet.

### Shelteroplevelsen i Vadehavet

Overnatning ved Vadehavet er en helt særlig oplevelse. Shelters ligger typisk ved marsken eller i nærheden af digerne, og du kan opleve enorme flokke af trækfugle, solopgange over fladen og den helt stille atmosfære, der kendetegner området. Vær opmærksom på tidevand og vejrforhold, og planlæg din tur efter forholdene.

### Sådan kommer du dertil

De vigtigste adgangspunkter er Ribe, Tønder og Esbjerg. Herfra kan du køre eller cykle ud til parkens pladser. Find flere shelters i denne del af landet under [Jylland](/danmark/jylland).

## Nationalpark Skjoldungernes Land – fjorde og vikingearv

Skjoldungernes Land ligger omkring Roskilde og Lejre og er præget af fjordlandskab, skove og kulturhistorie.

### Shelteroplevelsen i Skjoldungernes Land

Parkens shelters og lejrpladser ligger tæt på Roskilde Fjord og de omkringliggende skove. Her kan du kombinere sheltertur med kajak eller kano på fjorden, og du er aldrig langt fra stier og kulturhistoriske seværdigheder. Pladserne er velegnede til familier og begyndere, da flere har gode faciliteter og let adgang.

### Sådan kommer du dertil

Tag S-tog eller regionaltog til Roskilde, hvorfra der er kort afstand til parkens områder. Udforsk shelters på Sjælland via [Sjælland-siden](/danmark/sjaelland).

## Kongernes Nordsjælland – skov, søer og slotte

Danmarks nyeste nationalpark dækker store dele af Nordsjælland med Gribskov, Esrum Sø og Arresø som centrale elementer.

### Shelteroplevelsen i Kongernes Nordsjælland

Her finder du shelters i nogle af Danmarks største og mest varierede skovområder. Gribskov alene har flere primitive overnatningspladser med bålplads og adgang til vandreruter. Naturen er frodig, og du kan opleve kronhjorte, rovfugle og en rig skovbundsflora. Området er let tilgængeligt fra København og oplagt til weekendture.

### Sådan kommer du dertil

Tag S-tog til Hillerød og bus videre, eller kør via Hillerødmotorvejen. Find shelters i Nordsjælland under [Sjælland](/danmark/sjaelland).

## Planlæg din nationalparktur

Uanset hvilken nationalpark du vælger, gælder de samme grundregler: respekter naturen, tjek pladsens regler, og pak ordentligt. Læs vores [guide til regler for shelter og teltning](/guides/regler-for-shelter-og-teltning-i-danmark) og sørg for at have styr på udstyret med vores [pakkeliste](/guides/pakkeliste-til-sheltertur).

Har du brug for shelters med bestemte faciliteter som [toilet](/shelter-med-toilet), [drikkevand](/shelter-med-vand) eller [baalplads](/shelter-med-baalplads), kan du filtrere efter dem på [Søg shelters](/soeg). Du kan også finde pladser, der tillader [hunde](/shelter-med-hund), hvis du har firbenede rejsekammerater med.
    `.trim(),
    faq: [
      {
        question: "Er der shelters i alle danske nationalparker?",
        answer:
          "Ja, alle fem danske nationalparker har primitive overnatningspladser eller shelters i nærområdet. Antallet og typen varierer, men du kan finde muligheder for shelterovernatning i Thy, Mols Bjerge, Vadehavet, Skjoldungernes Land og Kongernes Nordsjælland.",
      },
      {
        question: "Skal man booke shelter i nationalparker?",
        answer:
          "Det afhænger af den enkelte plads. Nogle shelters i nationalparkerne er først-til-mølle, mens andre kan bookes. Tjek altid den specifikke plads på ShelterDK eller via Ud i Naturen for at se, om booking er nødvendig.",
      },
      {
        question: "Hvad er den bedste nationalpark for shelterture?",
        answer:
          "Det kommer an på, hvad du søger. Thy er bedst til rå kystoplevelser, Mols Bjerge til bakket vandring, Vadehavet til fugle og stilhed, Skjoldungernes Land til fjord og familieture, og Kongernes Nordsjælland til let tilgængelige skovture tæt på København.",
      },
    ],
  },
  {
    slug: "saadan-finder-du-det-perfekte-shelter",
    title: "Sådan finder du det perfekte shelter – overbliksguide",
    excerpt:
      "En samlet guide til at finde det helt rigtige shelter i Danmark: vælg efter faciliteter, region, sæson og bookingmuligheder med ShelterDKs filtre.",
    coverImage:
      "https://plus.unsplash.com/premium_photo-1697644694742-c97ff0266e69?w=1200&q=80&auto=format&fit=crop",
    category: "Begynder",
    content: `
## Find det shelter, der passer til netop din tur

Danmark har hundredvis af shelters spredt ud over hele landet. Det kan virke uoverskueligt at finde den rigtige plads, men med en struktureret tilgang bliver det hurtigt nemmere. Denne guide hjælper dig med at vælge shelter ud fra faciliteter, beliggenhed, sæson og praktiske forhold som booking. Brug den som dit overblik, når du planlægger din næste sheltertur.

## Vælg shelter efter faciliteter

Det vigtigste ved valg af shelter er ofte, hvilke faciliteter du har brug for. Tænk over, hvad der er afgørende for netop din tur.

### Toilet

Har du børn med, eller er det din første tur, gør et toilet i nærheden turen langt mere komfortabel. Mange pladser har et simpelt das eller et transportabelt toilet. Find shelters med toilet via [Shelter med toilet](/shelter-med-toilet).

### Drikkevand

Ikke alle pladser har adgang til rent drikkevand. Hvis du ikke vil slæbe store mængder vand med, er det værd at prioritere en plads med vandforsyning. Se pladser med vand på [Shelter med vand](/shelter-med-vand).

### Baalplads

For mange er bålet en central del af shelteroplevelsen. Tjek om pladsen har en etableret bålplads, og husk altid at respektere eventuelle bålforbud. Udforsk pladser med bålmulighed via [Shelter med baalplads](/shelter-med-baalplads).

### Hund

Rejser du med hund, er det vigtigt at finde pladser, hvor hunde er velkomne. Reglerne varierer fra sted til sted, og nogle naturområder kræver, at hunden er i snor hele året. Se hundevenlige shelters på [Shelter med hund](/shelter-med-hund).

Du kan kombinere flere facilitetsfiltre på [Søg shelters](/soeg) for at finde den plads, der opfylder alle dine behov.

## Vælg shelter efter region

Beliggenheden spiller en stor rolle. Tænk over, hvor langt du vil køre, og hvilket landskab du ønsker.

### Jylland

Jylland byder på alt fra den vilde vestkyst og heder i vest til bakkede fjordlandskaber i øst. Her er mange pladser i store skovområder og langs kysten. Udforsk shelters i [Jylland](/danmark/jylland).

### Fyn

Fyn og de omkringliggende øer har et mildere landskab med frugtbare marker, små skove og rolige kyststrækninger. Øhav-området syd for Fyn er særligt populært til kajakture kombineret med shelterovernatning. Find pladser på [Fyn](/danmark/fyn).

### Sjælland

Sjælland har store skove som Gribskov og Nordskoven samt fjordlandskaber omkring Roskilde og Holbæk. Tæt på København finder du overraskende mange gode shelterpladser. Se shelters på [Sjælland](/danmark/sjaelland).

### Bornholm

Bornholm byder på klippekyster, dybe sprækkedale og en helt særlig natur, der adskiller sig fra resten af Danmark. Øen har flere fine shelters og lejrpladser. Udforsk [Bornholm](/danmark/bornholm).

## Vælg shelter efter sæson

Sæsonen påvirker både din oplevelse og dine krav til pladsen.

### Forår og sommer

I de varme måneder er udvalget størst, og de fleste faciliteter er åbne. Til gengæld er der flere besøgende, og populære pladser kan være optaget. Book i god tid, eller vælg mindre kendte pladser.

### Efterår

Efteråret byder på flotte farver, færre mennesker og en roligere atmosfære. Pak ekstra varmt tøj, og vær forberedt på fugt og regn. Tjek at vandforsyning stadig er åben.

### Vinter

Vinterovernatning kræver mere forberedelse, men belønner med stjernehimmel og total stilhed. Vælg pladser tæt på parkering, så du nemt kan afkorte turen. Læs mere i vores guide til [overnatning i shelter om vinteren](/guides/overnatning-i-shelter-om-vinteren).

## Booking eller først-til-mølle

Der er grundlæggende to typer shelters i Danmark:

### Bookbare shelters

Nogle shelters kan reserveres på forhånd, enten via kommunens bookingsystem eller gennem [udinaturen.dk](https://udinaturen.dk). Det giver tryghed for, at pladsen er ledig, og er særligt en fordel i weekender og ferier.

### Først-til-mølle

Mange af Naturstyrelsens primitive overnatningspladser fungerer efter først-til-mølle-princippet. Det betyder, at du ikke kan reservere, men til gengæld er pladserne ofte gratis. Hav altid en plan B, hvis pladsen er optaget.

Læs mere om regler og rettigheder i vores [guide til regler for shelter og teltning](/guides/regler-for-shelter-og-teltning-i-danmark).

## Brug ShelterDK til at filtrere og finde

På [Søg shelters](/soeg) kan du bruge kort og filtre til at indsnævre din søgning. Du kan filtrere på:

- Region og område
- Faciliteter som toilet, vand, bålplads og hundevenlighed
- Bookingmuligheder

Kombiner filtrene for at finde præcis den plads, der matcher dine ønsker. Du kan også udforske pladserne direkte på kortet for at se, hvad der ligger i nærheden af din ønskede destination.

## Kom godt i gang

Hvis du er helt ny, anbefaler vi at starte med vores [begynderguide](/guides/shelter-for-begyndere-forste-tur) og bruge [pakkelisten](/guides/pakkeliste-til-sheltertur) til at sikre, at du har alt med. Kombineret med denne overbliksguide har du alle redskaberne til at finde og planlægge den perfekte sheltertur i Danmark.
    `.trim(),
    faq: [
      {
        question: "Hvordan finder man shelters i Danmark?",
        answer:
          "Du kan bruge ShelterDKs søgefunktion til at finde shelters på et interaktivt kort med filtre for region, faciliteter og booking. Du kan også finde pladser via Naturstyrelsens hjemmeside og Ud i Naturen.",
      },
      {
        question: "Hvad skal man kigge efter i et godt shelter?",
        answer:
          "Det afhænger af dine behov. Overvej faciliteter som toilet, drikkevand og bålplads, afstanden til parkering, om pladsen kan bookes, og om den passer til årstiden. For familier og begyndere er pladser med gode faciliteter og let adgang bedst.",
      },
      {
        question: "Kan man filtrere shelters efter faciliteter?",
        answer:
          "Ja, på ShelterDK kan du filtrere shelters efter faciliteter som toilet, drikkevand, bålplads og hundevenlighed. Du kan også filtrere efter region og bookingmuligheder for at finde den plads, der passer til din tur.",
      },
    ],
  },
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
      "https://plus.unsplash.com/premium_photo-1682500052659-07fc479a4772?w=1200&q=80&auto=format&fit=crop",
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

