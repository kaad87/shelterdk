export type BlogCategory =
  | "Guides"
  | "Sæson"
  | "Tips"
  | "Udstyr"
  | "Inspiration";

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  category: BlogCategory;
  coverImage: string;
  readingTime: number;
  faq?: { question: string; answer: string }[];
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  "Guides",
  "Sæson",
  "Tips",
  "Udstyr",
  "Inspiration",
];

const BLOG_POSTS: BlogPost[] = [
  {
    slug: "hvordan-vælge-shelter",
    title: "Hvordan vælger man det rigtige shelter?",
    excerpt:
      "Få tips til at finde det perfekte shelter – fra beliggenhed over faciliteter til sæson.",
    date: "2024-10-15",
    category: "Tips",
    coverImage:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop",
    readingTime: 3,
    content: `At finde det rigtige shelter kan gøre forskellen mellem en fantastisk tur og en nat med dårlig søvn og kulde. Danmark har over 1.000 offentlige shelters spredt ud over hele landet, og de varierer enormt – fra simple trekantede konstruktioner i skovbunden til velholdte pladser med borde, bænke og adgang til drikkevand. Her guider vi dig igennem de vigtigste overvejelser, så du kan vælge et shelter der passer præcist til din tur.

![Shelter i dansk skov med bålplads](https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop)

## Beliggenhed og adgang

Det første du bør overveje er, hvor langt du er villig til at gå. Nogle shelters ligger lige ved en parkeringsplads og er perfekte til familier med små børn eller begyndere, der ikke vil bære tungt udstyr over lange afstande. Andre kræver en vandring på flere kilometer ad skovstier, hvilket giver en mere autentisk naturoplevelse – men også mere planlægning.

Tænk også over landskabet. Vil du vågne op til lyden af bølger ved kysten, høre fuglesang i en gammel bøgeskov, eller se ud over et stille sølandskab? Brug vores [sheltersøgning](/soeg) til at filtrere efter region og se placeringen på kortet, før du beslutter dig.

## Faciliteter gør en forskel

Shelters i Danmark har vidt forskellige faciliteter. Her er de mest almindelige ting at kigge efter:

- **Bålplads** – langt de fleste shelters har en, men ikke alle. Tjek altid inden du pakker bålgrej
- **Bord og bænke** – rart at have til madlavning og kortspil, men ikke en selvfølge
- **Toilet** – nogle pladser har et toilet i nærheden, andre har ingen faciliteter overhovedet
- **Drikkevand** – sjældent tilgængeligt, så medbring altid din egen vandforsyning
- **Brænde** – nogle steder er der en brændebunke, men stol aldrig på det alene

Du kan se faciliteterne for hvert shelter på vores sheltersider. Læs også vores [begynderguide](/guides/shelter-for-begyndere-forste-tur) for at få et overblik over, hvad du kan forvente.

## Sæson og vejr

Nogle shelters er kun tilgængelige i bestemte perioder. Især pladser der forvaltes af kommuner eller private kan have lukkeperioder om vinteren. Tjek altid inden du tager afsted – [Naturstyrelsen](https://naturstyrelsen.dk) har opdaterede oplysninger om deres shelters.

Vejret spiller også en stor rolle. Et shelter med tre vægge og tag beskytter mod let regn, men i kraftig blæst fra den forkerte retning kan du blive våd. I tvivlstilfælde bør du medbringe en tarp som ekstra beskyttelse – læs mere i vores [artikel om shelterture i regnvejr](/blog/shelter-i-regnvejr).

## Bookbare vs. først-til-mølle shelters

I Danmark er mange shelters gratis og fungerer efter først-til-mølle-princippet. Det betyder, at du risikerer at ankomme til et optaget shelter – især i sommerens weekender. Hvis du vil være sikker på din plads, kan du vælge et bookbart shelter via [Book en Shelter](https://bookenshelter.dk) eller [udinaturen.dk](https://udinaturen.dk).

Booking er især en god idé når du:

- Rejser med børn og har brug for sikkerhed i planlægningen
- Vil på tur i højsæsonen (juni–august)
- Har en lang køretur og ikke vil risikere forgæves

[Søg shelters](/soeg) på vores side for at finde både bookbare og frie shelters i dit foretrukne område.

![Udsigt fra shelter ved sø](https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80&auto=format&fit=crop)

## Vores anbefaling

Start med at tænke over, hvad der er vigtigst for dig: beliggenhed, faciliteter eller garanti for plads. Brug vores [søgefunktion](/soeg) til at filtrere efter dine præferencer, og læs anmeldelser fra andre brugere. Tjek også vores [pakkeliste](/guides/pakkeliste-til-sheltertur) så du husker alt det nødvendige – uanset hvilket shelter du vælger.`,
    faq: [
      {
        question: "Kan man altid finde et ledigt shelter i Danmark?",
        answer:
          "Det afhænger af sæsonen og placeringen. I højsæsonen (juni–august) kan populære shelters hurtigt blive optaget. Hvis du vil være sikker, bør du booke på forhånd via bookenshelter.dk eller udinaturen.dk. Uden for sæsonen er der som regel god plads.",
      },
      {
        question: "Hvad er forskellen på et shelter og en primitiv lejrplads?",
        answer:
          "Et shelter er en fast trækonstruktion med tag og typisk tre vægge, hvor du kan sove beskyttet. En primitiv lejrplads er et udpeget areal, hvor du selv skal medbringe telt. Begge typer kan have bålplads og toilet, men et shelter giver mere beskyttelse mod vejret.",
      },
      {
        question: "Er det gratis at bruge shelters i Danmark?",
        answer:
          "De fleste shelters i Danmark er gratis at bruge. Nogle, især de bookbare, kan kræve et mindre gebyr. Naturstyrelsen driver mange gratis shelters, mens visse kommunale og private pladser kan have en pris.",
      },
    ],
  },
  {
    slug: "shelter-etiquette",
    title: "Shelter-etikette i naturen",
    excerpt:
      "Husk at tage hensyn til andre og naturen når du overnatter på et shelter.",
    date: "2024-09-22",
    category: "Tips",
    coverImage:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80&auto=format&fit=crop",
    readingTime: 3,
    content: `At overnatte i naturen er et privilegium – og det kræver hensyn. Shelterlivet fungerer bedst, når alle respekterer nogle enkle uskrevne regler. Uanset om du er erfaren friluftsmenneske eller på din første tur, er god shelter-etikette med til at sikre, at naturen forbliver intakt, og at alle får en god oplevelse.

![Stille skov med morgenlys](https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&q=80&auto=format&fit=crop)

## Del pladsen med andre

Medmindre du har booket et shelter til dig selv, er det vigtigt at forstå, at pladsen som udgangspunkt er fælles. De fleste shelters har plads til 4–6 personer, og i weekender og ferier kan der sagtens dukke andre gæster op. Vær venlig, sig hej og gør plads. Det er en af de fineste oplevelser ved friluftsliv – at møde fremmede, der deler samme passion for naturen.

Hvis du ankommer sent, bør du være stille og undgå at tænde kraftige lygter. Andre sover måske allerede. Omvendt – hvis du er den, der sover, så vær forberedt på, at der kan komme sene gæster.

## Ryd altid op efter dig selv

Grundreglen er enkel: lad stedet være renere end da du kom. Det betyder:

- Tag alt affald med hjem – også madaffald, der nedbrydes langsomt
- Tøm eventuelle askebakker og lad bålpladsen være klar til næste bruger
- Fjern madrester fra bord og bænke, da de tiltrækker dyr
- Ryd op efter hunden, hvis du har en med

Det lyder selvfølgeligt, men desværre efterlader nogle gæster skrald, brugte engangsgrille og endda glasflasker. Vær den gæst, som næste besøgende er taknemmelig for.

## Brug af bål og brænde

Bål er en central del af shelteroplevelsen, men det kræver ansvarlighed:

- Brug kun den bålplads der er etableret – lav aldrig bål direkte på jorden andre steder
- Brug tilgængeligt brænde fra eventuelle brændebunker, eller medbring dit eget
- Fæld aldrig levende træer – det er forbudt og skader skoven
- Sluk altid bålet fuldstændigt inden du går. Hæld vand på gløderne og tjek med hånden at varmen er væk

Læs mere om reglerne i vores [guide til regler for shelter og teltning](/guides/regler-for-shelter-og-teltning-i-danmark).

## Hold støjniveauet nede

Naturen byder på noget af det fineste lydlandskab, der findes – fuglesang, vindsus i trækronerne, knasende ild. Bevar det. Undgå høj musik fra højtalere, og sænk stemmerne efter kl. 22. Andre gæster – og dyrelivet – vil sætte pris på det.

Hvis du rejser i gruppe, kan det være en god idé at aftale et "stilletidspunkt" på forhånd, så alle er indforstået med hvornår roen sænker sig.

## Respektér dyrelivet

Du er gæst i dyrenes hjem. Det indebærer:

- Opbevar mad i lukkede beholdere eller hæng det op i en pose, så det ikke tiltrækker ræve, mus eller andre dyr
- Gå ikke tæt på dyrehuler eller reder
- Hold hunde i snor, især i ynglesæsonen (1. april – 30. september)
- Undgå at fodre vilde dyr

![Bålplads ved shelter om aftenen](https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&q=80&auto=format&fit=crop)

## Toiletbesøg i naturen

Ikke alle shelters har toilet. Hvis du skal ud i naturen, gælder disse regler:

- Grav et hul på mindst 15 cm dybde, mindst 50 meter fra vandløb og shelter
- Tildæk hullet ordentligt bagefter
- Medbring altid toiletpapir – og tag det brugte med hjem i en pose

God etikette er ikke kompliceret – det handler om sund fornuft og respekt. Hvis alle følger disse enkle regler, bevarer vi muligheden for frie shelterovernatninger i Danmark i mange år fremover. Planlæg din næste tur via vores [sheltersøgning](/soeg).`,
    faq: [
      {
        question: "Skal man dele et shelter med fremmede?",
        answer:
          "Ja, medmindre du har booket et shelter til dig selv, skal du forvente at dele pladsen. De fleste shelters er offentlige og fungerer efter først-til-mølle-princippet. Vær imødekommende og gør plads – det er en del af friluftslivet.",
      },
      {
        question: "Må man tænde bål ved alle shelters?",
        answer:
          "De fleste shelters har en dedikeret bålplads, men ikke alle. Tjek altid inden du tager afsted. I tørre perioder kan der desuden være bålrestriktioner fra myndighederne. Følg altid lokale regler og brug kun den etablerede bålplads.",
      },
      {
        question: "Hvad gør man med affald, når der ikke er skraldespande?",
        answer:
          "Du tager alt dit affald med hjem – inklusiv madrester, emballage og brugt toiletpapir. Pak en ekstra pose til skrald i rygsækken. Princippet er 'leave no trace': naturen skal se ud som om du aldrig har været der.",
      },
    ],
  },
  {
    slug: "de-bedste-regioner",
    title: "De bedste regioner for shelterophold",
    excerpt:
      "En kort rundtur i Danmarks mest populære områder til naturovernatning.",
    date: "2024-08-10",
    category: "Inspiration",
    coverImage:
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80&auto=format&fit=crop",
    readingTime: 4,
    content: `Danmark er et lille land med en overraskende stor variation i landskaber – og det afspejles i shelteroplevelserne. Fra Nordjyllands vilde kystlandskaber til Bornholms klippekyster og Sjællands dybe bøgeskove er der shelter til enhver smag. Her tager vi dig med på en rundtur i de bedste regioner for naturovernatning.

![Dansk skovlandskab med morgendis](https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80&auto=format&fit=crop)

## Nordjylland – vild natur og åbne horisonter

Nordjylland byder på en rå og uberørt natur. Her finder du shelters ved Vesterhavet med udsigt over klitter og bølger, men også inde i landet i de store plantager som Thy, Hanstholm og Blokhus Klitplantage. Rold Skov – en af Danmarks største skove – har adskillige shelters med let adgang fra gode vandreruter.

Nordjylland er oplagt for den, der vil opleve:

- Kystlandskaber med masser af frisk luft
- Store, stille plantager med få andre besøgende
- Kombinerede vandre- og shelterture langs Nordsøstien

## Midtjylland – søer, skove og Hærvejen

Silkeborg-området og Søhøjlandet er noget af det tætteste, Danmark kommer på bjerge. Her finder du shelters ved søer, langs åer og dybt inde i de kuperede skove. Hærvejen, Danmarks ældste landevej, passerer adskillige shelters, hvilket gør det muligt at lave en flerdages vandretur med overnatning undervejs.

Populære områder inkluderer:

- Silkeborg Vesterskov og området omkring Slåensø
- Himmelbjerget og de omkringliggende stier
- Naturpark Mols Bjerge med sin unikke natur

## Østjylland og Aarhus-området

Omkring Aarhus findes mange bynære shelters, der er perfekte til en hurtig overnatning uden lang kørsel. Marselisborg Skov og Moesgaard-området har gode muligheder. Djursland byder desuden på kystnære shelters med udsigt over Kattegat.

## Fyn – idyllisk og centralt

Fyn er perfekt til cykelshelterture. Øen har et tæt netværk af cykelruter og shelters, der ofte ligger med kort afstand til hinanden. Svanninge Bakker og Det Sydfynske Øhav er særligt populære for naturelskere. Mange fynske shelters har gode faciliteter og er velegnede til [ture med børn](/blog/shelter-med-boern).

## Sjælland – fra Gribskov til Stevns

Sjælland har shelter til enhver smag. Nordsjællands store skove – Gribskov, Tisvilde Hegn og Jægerspris – byder på masser af muligheder. Mod syd finder du den dramatiske Stevns Klint og rolige skove på Sydsjælland.

For Københavnere er Nordsjælland det oplagte valg for en weekend i naturen uden lang transporttid. Tjek [Naturstyrelsens oversigt](https://naturstyrelsen.dk) for aktuelle shelters i regionen.

## Øerne – Bornholm, Møn, Lolland-Falster

Bornholm fortjener sin egen omtale. Klippekyster, sprækkedale og en helt særlig stemning gør øen til et yndet mål for shelterturister. Hammershus, Almindingen og de mange kystklippeshelters er unikke i dansk sammenhæng.

Møn byder på Møns Klint og de omkringliggende skove, mens Lolland-Falster har rolige skove og strande, der sjældent er overfyldte.

![Kystlandskab med vandrerute](https://images.unsplash.com/photo-1500534314263-a3817d98e140?w=1200&q=80&auto=format&fit=crop)

## Find dit næste shelter

Uanset hvilken region der frister dig, kan du bruge vores [sheltersøgning](/soeg) til at filtrere efter område, faciliteter og tilgængelighed. Læs også vores [guide for begyndere](/guides/shelter-for-begyndere-forste-tur) hvis det er din første tur, eller find inspiration til [den perfekte sheltertur med din partner](/blog/shelter-som-par).

Du kan også udforske [udinaturen.dk](https://udinaturen.dk) for yderligere information om naturområder og overnatningsmuligheder i hele Danmark.`,
    faq: [
      {
        question: "Hvilken region har flest shelters i Danmark?",
        answer:
          "Jylland har generelt flest shelters, da regionen dækker det største areal med mange store skove og naturområder. Midtjylland og Nordjylland er særligt velforsynede. Du kan filtrere efter region på vores søgeside for at se præcise antal.",
      },
      {
        question: "Kan man lave flerdages shelterture i Danmark?",
        answer:
          "Ja, det er oplagt langs ruter som Hærvejen, Nordsøstien og de mange regionale vandreruter. Flere af disse ruter passerer shelters med 15–25 km mellemrum, så du kan planlægge en hel uge med overnatning i naturen.",
      },
      {
        question: "Er der shelters tæt på København?",
        answer:
          "Ja, Nordsjælland har mange shelters inden for en times kørsel fra København. Gribskov, Tisvilde Hegn og Jægerspris Nordskov er populære valg. Selv tættere på byen er der muligheder i Vestskoven og Hareskoven.",
      },
    ],
  },
  {
    slug: "shelter-med-boern",
    title: "Shelter med børn – sådan gør du turen til en succes",
    excerpt:
      "Praktiske tips til at tage børn med på sheltertur: valg af plads, aktiviteter og gode rutiner.",
    date: "2024-11-05",
    category: "Guides",
    coverImage:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80&auto=format&fit=crop",
    readingTime: 5,
    content: `At tage børn med på sheltertur er en af de bedste måder at introducere dem til naturen og friluftsliv. Men det kræver lidt mere planlægning end en tur alene eller med andre voksne. Med de rigtige forberedelser kan en sheltertur med børn blive en oplevelse, som hele familien husker længe – og som børnene vil bede om at gentage.

![Familie ved shelter i skoven](https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80&auto=format&fit=crop)

## Vælg den rigtige plads

Til ture med børn er det vigtigt at vælge et shelter, der er let tilgængeligt. Lange vandreture med tung oppakning er sjældent en succes med små ben. Her er hvad du bør kigge efter:

- **Kort gåafstand fra parkering** – helst under 1 km, især med børn under 6 år
- **Toilet i nærheden** – det gør alt meget lettere, især med mindre børn
- **Bålplads** – børn elsker at lave mad over bål, og det er en aktivitet i sig selv
- **Vand** – et vandløb, en sø eller havet i nærheden giver timers underholdning

Book altid shelteren på forhånd via [Book en Shelter](https://bookenshelter.dk) eller [udinaturen.dk](https://udinaturen.dk), når du rejser med børn. Der er intet værre end at ankomme med trætte, sultne børn og finde pladsen optaget. Brug vores [sheltersøgning](/soeg) til at finde egnede pladser med de rette faciliteter.

## Aktiviteter der holder børn i gang

Naturen er verdens bedste legeplads – men det skader ikke at have lidt struktur klar. Her er afprøvede aktiviteter, der fungerer for alle aldre:

- **Naturskattejagt** – lav en liste på forhånd med ting børnene skal finde: en rød sten, en fjer, et blad med fem takker, et insekt med vinger
- **Pindebål-arkitektur** – lad børnene bygge miniaturelejre af pinde, mos og bark
- **Dyresporing** – kig efter fodspor, ekskrementer og gnavehuller. Medbring en naturbog til identifikation
- **Snobrød og skumfiduser** – den klassiske bålaktivitet der aldrig fejler
- **Stjerneobservation** – tag en stjernekort-app med og find konstellationer sammen, når mørket falder på

Undgå at overkompensere med aktiviteter. Børn har en fantastisk evne til at underholde sig selv i naturen, hvis man giver dem lidt tid og rum.

## Mad og drikke – hold det enkelt

Avanceret bålmadlavning er sjældent en god idé med børn. Hold det simpelt:

- **Pølser og snobrød** – hurtig, nem og elsket af alle børn
- **Forudlavet mad** – pasta eller gryderet, der bare skal varmes over bål
- **Masser af snacks** – frisk luft giver sult. Pak frugt, nødder, müslibarer og kiks
- **Varm kakao** – den ultimative hygge efter en lang dag ude
- **Rigeligt med vand** – børn glemmer at drikke, så mind dem om det jævnligt

Læs vores [guide til mad over bål](/guides/mad-over-bal-nem-shelter-mad) for flere idéer til nemme shelter-retter.

## Søvn og komfort

Børn fryser hurtigere end voksne, og en kold nat kan ødelægge hele oplevelsen. Her er nøglerne til en god nats søvn:

- **Sovepose med lav comfort-temperatur** – vælg en sovepose der kan klare 5 grader under den forventede nattetemperatur
- **Ekstra lag tøj** – uldundertøj og tykke sokker kun til natten holder varmen
- **Godt liggeunderlag** – kulden kommer nedefra, så invester i et ordentligt underlag
- **Plysdyr eller bamse** – for de mindste gør det en kæmpe forskel at have noget genkendeligt med
- **Godnathistorie** – en fortælling ved bålskæret er en magisk afslutning på dagen

## Faste rutiner giver tryghed

Selv om I er i naturen, hjælper det at holde nogenlunde faste rammer. Spis aftensmad på et kendt tidspunkt, hav en fast goodnight-rutine og vågn op til de samme morgenvaner. Det giver tryghed – især for de mindste, der måske er lidt usikre på at sove et nyt sted.

![Børn leger ved bålplads](https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=1200&q=80&auto=format&fit=crop)

## Sikkerhed i naturen

Et par vigtige sikkerhedshensyn, når børn er med:

- **Bålsikkerhed** – aftal klare regler: ingen løb nær bålet, ingen pinde i ilden uden voksenhjælp
- **Flåtjek** – undersøg børnene (og jer selv) grundigt for flåter efter turen
- **Førstehjælp** – medbring plaster, renseservietter og pincet. Vabelplastre er guld for små fødder
- **Synlighed** – lad børn bære reflekser eller lys hvis de bevæger sig rundt i tusmørke

Med den rigtige planlægning bliver en sheltertur med børn en oplevelse, der styrker sammenholdet og skaber minder for livet. Tjek vores [begynderguide](/guides/shelter-for-begyndere-forste-tur) og [pakkeliste](/guides/pakkeliste-til-sheltertur) for at komme godt fra start.`,
    faq: [
      {
        question: "Hvornår er børn gamle nok til en sheltertur?",
        answer:
          "Der er ingen fast aldersgrænse. Mange familier tager babyer med på sheltertur – det kræver bare ekstra forberedelse med sovemuligheder og varmt tøj. Fra 3-4 års alderen begynder børn at kunne deltage aktivt i aktiviteter. Start med en enkelt overnatning tæt på bilen, og byg gradvist op.",
      },
      {
        question: "Hvad gør man, hvis barnet ikke vil sove i shelteret?",
        answer:
          "Bevar roen. Skab en hyggelig stemning med godnathistorier og stearinlys. Hav plysdyr og egen sovepose med. Nogle børn sover bedre, hvis de ligger tæt op ad en voksen. Har I aldrig prøvet shelter før, kan det hjælpe at øve sig med en overnatning i haven først.",
      },
      {
        question: "Skal man booke shelter, når man har børn med?",
        answer:
          "Det anbefales stærkt. Børn bliver trætte og sultne, og at ankomme til et optaget shelter kan ødelægge stemningen fuldstændigt. Book via bookenshelter.dk eller udinaturen.dk for at sikre pladsen – især i weekender og ferier.",
      },
    ],
  },
  {
    slug: "shelter-foraar-sommer",
    title: "De bedste shelterture i foråret og sommeren",
    excerpt:
      "Udnyt de lyse måneder til shelter – her er de bedste tips til forår og sommer.",
    date: "2024-12-01",
    category: "Sæson",
    coverImage:
      "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&q=80&auto=format&fit=crop",
    readingTime: 4,
    content: `Foråret og sommeren er den perfekte tid til shelterture i Danmark. De lange, lyse aftener, milde temperaturer og en natur i fuld blomst gør det til den mest populære sæson for naturovernatning. Men med populariteten følger også udfordringer – her guider vi dig til den bedste oplevelse i de varme måneder.

![Solnedgang over dansk skov om sommeren](https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=1200&q=80&auto=format&fit=crop)

## Foråret: marts til maj

Foråret er for mange den smukkeste tid at besøge et shelter. Naturen vågner, og skovbunden fyldes med hvide anemoner, duftende ramsløg og de første grønne blade. Fuglesangen er intens om morgenen, og lysningen kommer tidligt.

Temperaturen varierer dog kraftigt i foråret. Om dagen kan det være 15 grader og solrigt, mens natten byder på ned til 2–5 grader. Pak derfor:

- **Sovepose med comfort-temperatur på 0–5 grader** – nætterne er køligere end man tror
- **Lag-på-lag tøj** – let at tilpasse til skiftende temperaturer
- **Vandtæt jakke** – aprilbyger er uforudsigelige
- **Termokande med varm drik** – en kop kaffe eller te i en kold morgen er luksus

Foråret er perfekt til den, der vil undgå masser af andre besøgende. Shelters er sjældent fuldt booket i marts og april, så du har gode chancer for at have pladsen for dig selv.

## Sommeren: juni til august

Sommerens lange dage giver op til 18 timers dagslys, og nattemperaturen sjældent falder under 10–15 grader. Det gør sommeren til den mest tilgængelige sæson for alle – inklusiv familier og begyndere.

Men sommeren bringer også udfordringer:

- **Populære shelters bookes hurtigt** – reserver via [Book en Shelter](https://bookenshelter.dk) mindst 2–3 uger i forvejen
- **Myg og flåter** – juni og juli er værst. Medbring myggespray med DEET og tjek for flåter dagligt
- **Varme** – en let sovepose eller blot et lagen kan være nok. Medbring ekstra vand
- **Solbeskyttelse** – solcreme, kasket og solbriller. Solen kan stå overraskende stærkt selv i skoven

## Kombinér med andre aktiviteter

Forår og sommer er ideelle til at kombinere shelterturen med andre friluftsaktiviteter:

- **Vandring** – lange vandreruter som Hærvejen og Nordsøstien passerer mange shelters. Planlæg en flerdages tur med overnatning undervejs
- **Cykling** – Danmarks cykelrutenetværk er fantastisk. Fyn og Bornholm er særligt velegnede til cykelshelterture
- **Kajaktur** – kombiner en padletur med shelter ved søen eller kysten
- **Badning** – mange shelters ligger tæt på badesøer eller strande. En morgendukkert i en stille skovsø er svær at slå

Tjek vores [regionguide](/blog/de-bedste-regioner) for at finde de bedste områder til din foretrukne aktivitet.

## Hvad skal du pakke?

Sommerpakkelisten er kortere end vinterens, men der er stadig vigtige ting at huske:

- Let sovepose eller lagen (afhængig af temperatur)
- Liggeunderlag
- Myggespray og flåtpincet
- Solcreme og kasket
- Rigeligt med vand (minimum 2 liter per person)
- Let, hurtigt tørrende tøj
- Hovedlygte til de korte nætter

Se vores komplette [pakkeliste til sheltertur](/guides/pakkeliste-til-sheltertur) for en detaljeret oversigt.

![Vandring i dansk natur om foråret](https://images.unsplash.com/photo-1500534314263-a3817d98e140?w=1200&q=80&auto=format&fit=crop)

## Bookinger og planlægning

I højsæsonen er planlægning afgørende. Her er vores bedste råd:

- Book tidligt – populære shelters kan være booket flere uger i forvejen
- Hav en plan B – kend et alternativt shelter i nærheden, hvis dit førstvalg er optaget
- Tjek vejrudsigten – selv om det er sommer, kan en uventet regnbyge ændre oplevelsen. Læs vores [guide til shelterture i regnvejr](/blog/shelter-i-regnvejr)
- Ankom i god tid – sigt efter ankomst senest kl. 17, så I har tid til at installere jer og lave mad i dagslys

[Søg shelters](/soeg) og start planlægningen af din næste forår- eller sommertur. Og hvis du er ny i shelter-verdenen, anbefaler vi vores [begynderguide](/guides/shelter-for-begyndere-forste-tur) som udgangspunkt.`,
    faq: [
      {
        question: "Hvornår er den bedste måned for shelterture i Danmark?",
        answer:
          "Maj og september er ofte de bedste måneder. Vejret er behageligt, der er færre myg end i højsommeren, og shelters er ikke så hurtigt booket. Juni til august giver de varmeste nætter, men er også den travleste periode.",
      },
      {
        question: "Hvordan undgår man myg på en sheltertur om sommeren?",
        answer:
          "Brug myggespray med DEET, bær lange ærmer og bukser om aftenen, og vælg et shelter med god vindeksponering – myg trives dårligt i vind. Undgå at slå lejr tæt på stillestående vand, da myg yngler der.",
      },
      {
        question: "Har man brug for sovepose om sommeren?",
        answer:
          "I de varmeste uger (juli) kan et let lagen eller en tynd sovepose være nok. Men selv om sommeren kan nattemperaturen falde til 8-10 grader, så det er klogt at have en let sovepose med. Tjek vejrudsigten for den specifikke nat.",
      },
    ],
  },
  {
    slug: "udstyr-guide-begyndere",
    title: "Det vigtigste udstyr til din første sheltertur",
    excerpt:
      "En simpel guide til det basale udstyr du har brug for som shelter-begynder.",
    date: "2025-01-10",
    category: "Udstyr",
    coverImage:
      "https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=1200&q=80&auto=format&fit=crop",
    readingTime: 5,
    content: `Du behøver ikke avanceret eller dyrt udstyr for at komme i gang med shelterture. Faktisk er en af de store fordele ved shelterovernatning, at det er langt billigere end telttur – du behøver hverken telt, stangsystem eller footprint. Men der er nogle essentielle ting, du ikke bør gå på kompromis med. Her gennemgår vi alt det vigtige udstyr for din første sheltertur.

![Pakket rygsæk med friluftsudstyr](https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=1200&q=80&auto=format&fit=crop)

## Sovepose – dit vigtigste udstyr

Soveposen er den enkeltstående genstand, der har størst indflydelse på din oplevelse. En nat med kulde er en elendig nat, og det gør alt andet sekundært. Vælg sovepose efter årstiden:

- **Sommer (juni–august):** Comfort-temperatur på 10–15°C. En let dunpose eller syntetisk pose er tilstrækkelig
- **Forår/efterår (marts–maj, september–november):** Comfort-temperatur på 0–5°C. Her skal posen være varmere
- **Vinter (december–februar):** Comfort-temperatur på -5 til -10°C. Læs vores [vinterovernatningsguide](/guides/overnatning-i-shelter-om-vinteren) for detaljer

Vær opmærksom på forskellen mellem comfort- og limit-temperatur. Comfort er den temperatur, hvor en gennemsnitlig person sover behageligt. Limit er det laveste, før det bliver decideret ubehageligt. Vælg altid efter comfort-tallet.

Dun er lettere og pakker mindre, men syntetisk er billigere og isolerer bedre, når det er fugtigt. Til din første tur er en syntetisk sovepose det sikre valg.

## Liggeunderlag – kulden kommer nedefra

Selv i et shelter med trægulv mister du kropsvarme nedad. Et godt liggeunderlag isolerer og giver komfort. Der er tre typer:

- **Skumunderlag** – billigst, holdbart, men mindst komfortabelt. God nødisolering under et andet underlag
- **Selvoppustende underlag** – god kombination af komfort og isolering. Mellem prisleje
- **Oppusteligt underlag** – bedst komfort og lav vægt, men dyrere og kan punktere

Til begynderen anbefaler vi et selvoppustende underlag som det bedste kompromis. Hav altid et tyndt skumunderlag med som backup og ekstra isolering.

## Hovedlygte – uundværlig når mørket falder på

En god hovedlygte er et must. Du har begge hænder fri til at lave mad, samle brænde og navigere i mørke. Kig efter:

- Minimum 200 lumen lysstyrke
- Rød lystilstand (blænder ikke andre og bevarer nattesynet)
- Mindst 8 timers batteritid
- Vandtæt (IPX4 eller højere)

Medbring altid ekstra batterier. Der er intet værre end at stå i bælgmørke med en død lygte.

## Rygsæk – den rigtige størrelse

Til en enkelt overnatning er en rygsæk på 30–45 liter typisk tilstrækkelig. Til flerdages ture har du brug for 50–65 liter. Vigtige features:

- Justerbart hoftebælte der fordeler vægten
- Regncover eller vandtæt inderpose
- Udvendige stropper til liggeunderlag

Pak tungt grej tættest på ryggen og i midten af sækken for bedst balance.

## Madlavning og vand

Til simple shelterture med bålplads behøver du ikke bringe en campingkoger – men det er rart at have som backup:

- **Vandflaske** – minimum 1,5 liter. Genanvendelig stål- eller plastikflaske
- **Vandtætte poser** – til opbevaring af mad, så det ikke tiltrækker dyr
- **Grillrist eller bålstativ** – til madlavning over bål, hvis pladsen ikke har et
- **Bestik og kop** – en spork (ske/gaffel-kombi) og en isoleret kop til varme drikke

Se vores [guide til mad over bål](/guides/mad-over-bal-nem-shelter-mad) for nemme opskrifter.

## Kniv og ildstål

En god foldekniv er et af de mest alsidige redskaber i naturen. Brug den til at skære brænde, tilberede mad og lave båloptænding. Et ildstål er et pålideligt alternativ til tændstikker – det virker i al slags vejr og holder i tusindvis af tændinger.

Tip: Øv dig med ildstålet derhjemme, før du tager afsted. Det kræver teknik at få en gnist til at fænge i tørt materiale.

![Bål med kedel i skoven](https://images.unsplash.com/photo-1475483768296-6163e08872a1?w=1200&q=80&auto=format&fit=crop)

## Førstehjælp og sikkerhed

Et lille førstehjælpskit skal altid med. Det behøver ikke være stort – her er det essentielle:

- Plastre i forskellige størrelser
- Vabelplastre (uundværlige til vandreture)
- Sportstape
- Smertestillende tabletter
- Flåtpincet
- Renseservietter
- Allergi-medicin, hvis relevant

## Tøj efter lag-princippet

Pak tøj i lag, så du kan tilpasse dig skiftende temperaturer:

- **Basislag** – uld eller syntetisk undertøj der transporterer fugt
- **Mellemlag** – fleece eller tynd dunjakke til isolering
- **Yderlag** – vandtæt og vindtæt jakke og bukser
- **Ekstra** – tørre sokker og undertøj til natten, buff eller hue

Husk: bomuld er fjenden i naturen. Det tørrer langsomt og isolerer dårligt, når det er vådt. Vælg uld eller syntetisk materiale.

## Hvad du IKKE behøver

Som begynder er det let at overpakke. Her er ting du godt kan undvære på din første tur:

- Stort campingbord og stole – brug shelterets bord eller sid på jorden
- Pude – rul en jakke sammen
- Stor køletaske – pak mad der ikke kræver køling
- Mange elektroniske gadgets – nyd at være offline

Tjek vores komplette [pakkeliste](/guides/pakkeliste-til-sheltertur) og vores [begynderguide](/guides/shelter-for-begyndere-forste-tur) for at komme godt fra start. [Søg shelters](/soeg) for at finde den perfekte plads til din første overnatning.`,
    faq: [
      {
        question: "Hvad koster det at komme i gang med shelterture?",
        answer:
          "Du kan komme i gang for 1.000–2.000 kr. med en basal sovepose, et skumunderlag og en hovedlygte. Hvis du allerede har en varm sovepose fra campingture, er du næsten klar. Shelterture er en af de billigste former for friluftsliv, da selve overnatningen ofte er gratis.",
      },
      {
        question: "Kan man bruge almindeligt campingudstyr til shelterture?",
        answer:
          "Ja, stort set alt campingudstyr kan bruges til shelterture. Du behøver bare ikke telt og stangsystem. Din eksisterende sovepose, liggeunderlag og madlavningsudstyr kan bruges direkte. Fokuser på at pakke let og praktisk.",
      },
      {
        question: "Skal man have en rygsæk, eller kan man bruge en sportstaske?",
        answer:
          "En rygsæk med hoftebælte anbefales kraftigt, især hvis du skal gå mere end et par hundrede meter. En sportstaske belaster skuldrene ulige og er besværlig at bære på stier. En 30-40 liters rygsæk er den bedste investering for begynderen.",
      },
    ],
  },
  {
    slug: "shelter-i-regnvejr",
    title: "Sheltertur i regnvejr – overlev og nyd det",
    excerpt:
      "Regn behøver ikke ødelægge turen. Lær at forberede dig og gøre det bedste ud af vådt vejr.",
    date: "2025-02-14",
    category: "Tips",
    coverImage:
      "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1200&q=80&auto=format&fit=crop",
    readingTime: 4,
    content: `Regn er en uundgåelig del af det danske klima, og sandsynligheden for at opleve det på en sheltertur er høj – uanset årstiden. Men en regnvejrstur behøver slet ikke være en dårlig oplevelse. Tværtimod kan regn på shelteret tag, duften af våd skovbund og den særlige stilhed, der følger med gråvejr, være noget af det mest stemningsfulde, du kan opleve i naturen. Det kræver bare forberedelse.

![Regndråber på blade i skoven](https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=1200&q=80&auto=format&fit=crop)

## Tøjvalg der gør forskellen

Det vigtigste våben mod regn er det rigtige tøj. Princippet er simpelt: hold dig tør udefra og undgå at svede indefra.

- **Vandtæt jakke** – vælg en med åndbart membran (Gore-Tex eller lignende). Billige regncapes holder vand ude men lukker sveden ind
- **Vandtætte bukser** – overtræksbukser du kan tage over dine almindelige bukser
- **Vandtætte sko eller støvler** – membransko holder fødderne tørre. Gummistøvler er gode til lejren men dårlige til vandring
- **Ekstra tørt tøj** – pak mindst ét komplet sæt tørt tøj i en vandtæt drybag. Det er din livline, hvis alt andet bliver gennemblødt

Et vigtigt princip: undgå bomuld. Våd bomuld tørrer ekstremt langsomt og trækker varme ud af kroppen. Brug uld eller syntetisk materiale, der isolerer selv når det er fugtigt.

## Beskyt dit grej mod fugt

Alt dit udstyr – især sovepose og tørt tøj – skal pakkes i vandtætte poser. Her er en simpel strategi:

- **Sovepose** – altid i en kompressionsdrybag. Din sovepose er det vigtigste at holde tørt
- **Tørt skiftetøj** – i separat drybag
- **Elektronik og kort** – i en lille vandtæt pose
- **Tændstiksker/lighter** – i en vandtæt beholder

Et regncover til rygsækken er godt, men stol ikke på det alene. Kraftig regn kan drive igennem, og ryggen sveder under coveret. Drybags indeni er den sikre løsning.

## Tarp – din bedste investering

Hvis der er ét stykke udstyr, der transformerer en regnvejrstur, er det en tarp. En let tarp (3x3 meter er ideelt) spændt ud foran shelteret skaber et tørt opholdsområde, hvor du kan:

- Sidde og nyde udsigten uden at blive våd
- Lave mad på bålpladsen i tørvejr
- Tørre udstyr og tøj under taget
- Opbevare rygsæk og sko tørt

Montering er enkel: brug træer som ankerpunkter og et par snore. Øv dig derhjemme første gang. En tarp vejer typisk 500–800 gram og fylder næsten ingenting i rygsækken.

## Bål i regnvejr – det kan lade sig gøre

At tænde bål i regn er en udfordring, men absolut muligt med de rette teknikker:

- **Find tørt brænde** – kig under væltede træer og store sten. Indersiden af døde grene er ofte tør
- **Brug birkebark** – den indeholder naturlige olier og brænder selv når den er fugtig
- **Start småt** – begynd med helt tynde kviste og byg langsomt op
- **Brug et ildstål eller stormtændstkker** – almindelige tændstkker kan svigte i fugtigt vejr
- **Beskyt flammen** – brug kroppen eller en jakke som vindskjold i startfasen

Hvis shelteret har en overdækket bålplads, er du heldig. Ellers kan din tarp over bålpladsen gøre underværker – men hold altid god afstand mellem tarp og flammer.

![Shelter med tarp i regnvejr](https://images.unsplash.com/photo-1500534314263-a3817d98e140?w=1200&q=80&auto=format&fit=crop)

## Aktiviteter i regnvejr

Regn indbyder til en anden slags sheltertur – langsommere, mere meditativ:

- **Lytten** – regn på shelteret tag er en af naturens mest beroligende lyde. Luk øjnene og vær til stede
- **Læsning** – medbring en god bog (i vandtæt pose). Der er få bedre steder at læse end under et tag med regnen som lydkulisse
- **Kortspil** – en pakke kort vejer ingenting og giver timers underholdning
- **Varm drik** – kakao, kaffe eller te. Fyld termokannen inden turen og nyd den i tørvejr under taget
- **Naturobservation** – mange dyr er mere aktive i regnvejr. Snegle, salamandre og fugle kommer frem

## Tørring af udstyr

Når regnen stopper (og det gør den altid til sidst):

- Hæng vådt tøj op på en snor mellem træerne
- Vend sovestuff ud af soveposen og lad den lufte
- Tør sko med avispapir eller tørt græs indeni
- Udnyt ethvert solglint til at tørre det vigtigste

Læs mere om [det rigtige udstyr til shelterture](/blog/udstyr-guide-begyndere) og tjek vores [pakkeliste](/guides/pakkeliste-til-sheltertur) for en komplet oversigt over, hvad du skal medbringe. Brug [sheltersøgningen](/soeg) til at finde shelters med overdækket bålplads – det er guld værd i regnvejr.`,
    faq: [
      {
        question: "Er det sikkert at overnatte i shelter under tordenvejr?",
        answer:
          "Shelters er åbne konstruktioner og giver ikke beskyttelse mod lynnedslag. Hvis tordenvejret er kraftigt og direkte over dig, bør du undgå at opholde dig under høje, enkeltstående træer. Bliv i shelteret hvis det ligger lavt i terrænet, eller søg mod lavere terræn væk fra høje punkter og metalstrukturer.",
      },
      {
        question: "Hvad gør man, hvis soveposen bliver våd?",
        answer:
          "En våd sovepose mister det meste af sin isoleringsevne – især dunposer. Forsøg at vride den og tørre den ved bålet (pas på gnister). Brug tørt ekstra tøj som isolering og kryb ind i en nødfolie, hvis du har en. Det bedste forsvar er forebyggelse: pak altid soveposen i en vandtæt drybag.",
      },
      {
        question: "Hvilken tarp er bedst til shelterture?",
        answer:
          "En tarp på 3x3 meter i letvægtsnylon (silnylon) er ideel. Den vejer 400-800 gram, koster 300-600 kr. og giver rigeligt tørt areal foran shelteret. Vælg en med forstærkede øjer i hjørnerne og langs kanterne. Medbring 4-6 snore af mindst 3 meters længde.",
      },
    ],
  },
  {
    slug: "shelter-som-par",
    title: "Romantisk sheltertur – den perfekte tur for to",
    excerpt:
      "Planlæg en uforglemmelig sheltertur med din partner. Tips til plads, mad og stemning.",
    date: "2025-03-01",
    category: "Inspiration",
    coverImage:
      "https://images.unsplash.com/photo-1475483768296-6163e08872a1?w=1200&q=80&auto=format&fit=crop",
    readingTime: 4,
    content: `En sheltertur for to er en af de mest romantiske oplevelser, man kan give sig selv og sin partner. Væk fra hverdagens stress, uden skærme, notifikationer eller forstyrrelser – bare naturen, bålet og hinanden. Det kræver ikke meget planlægning at skabe en uforglemmelig aften under åben himmel, men de rigtige forberedelser løfter oplevelsen fra god til magisk.

![Par ved bål i naturen](https://images.unsplash.com/photo-1475483768296-6163e08872a1?w=1200&q=80&auto=format&fit=crop)

## Vælg det perfekte shelter

Placeringen er alt, når det handler om romantik. Et shelter med udsigt over en stille sø, ved en kystskrænt med solnedgang eller dybt inde i en gammel skov skaber vidt forskellige stemninger – alle smukke på deres egen måde.

Her er hvad du bør kigge efter:

- **Beliggenhed med udsigt** – en sø, kyst eller åben lysning giver den bedste stemning ved solnedgang
- **Privatliv** – vælg et shelter der ligger lidt afsides, så I ikke risikerer uventet selskab. Book altid på forhånd
- **Bålplads** – et bål er hjertet af en romantisk shelteraften. Tjek at pladsen har en
- **God adgang** – med mad, vin og ekstra komfort i rygsækken er en kort gåafstand en fordel

Book via [Book en Shelter](https://bookenshelter.dk) eller [udinaturen.dk](https://udinaturen.dk) for at sikre, at I har pladsen helt for jer selv. Der er intet romantisk ved at dele shelter med en gruppe spejdere. Brug vores [sheltersøgning](/soeg) til at finde shelters med de rette faciliteter.

## Mad der sætter stemningen

Mad over bål er i sig selv romantisk, men med lidt ekstra omtanke kan du hæve niveauet betragteligt:

- **Forret** – pak en god ost (comté eller brie), kiks, nødder og oliven. Server det mens I venter på at bålet er klar
- **Hovedret** – en one-pot ret over bål er nemt og imponerende. Prøv en cremet pasta med svampe og hvidløg, eller en marokkansk tagine med kikærter og krydderier. Forbered ingredienserne derhjemme, så du bare skal hælde det i gryden
- **Dessert** – varm chokoladefondant i en lille gryde, eller klassiske skumfiduser ristet over gløder
- **Drikke** – en flaske rødvin til maden, varmt krydret æblemost til desserten. Medbring rigtige glas – det gør en overraskende forskel

Tjek vores [guide til mad over bål](/guides/mad-over-bal-nem-shelter-mad) for flere opskrifter, der imponerer uden at kræve en kokkeskole.

## Komfort for to

Et shelter er ikke et femstjernet hotel, men med de rigtige detaljer kan det komme overraskende tæt på:

- **Dobbelt liggeunderlag** – eller to underlag lagt tæt sammen, så I kan ligge tæt
- **Sammenzippede soveposer** – mange soveposer kan zippes sammen til en dobbelt. Tjek inden turen at de er kompatible
- **Stearinlys** – 4-5 fyrfadslys i vindtætte glas skaber en intim stemning. Placer dem sikkert væk fra brændbart materiale
- **Blødt underlag** – et ekstra tæppe eller et fåreskind gør shelteret langt mere indbydende
- **Puder** – ja, det er ekstra vægt. Nej, du vil ikke fortryde det

## Aktiviteter for to

En romantisk sheltertur handler om at være til stede sammen. Her er aktiviteter, der styrker nærvær:

- **Vandretur sammen** – gå en rute til shelteret, helst med smukke udsigter undervejs. Gåturen giver tid til samtale uden distraktioner
- **Stjernekig** – læg jer på ryggen og find konstellationer. Download en stjernekort-app inden turen, men lad ellers telefonerne være
- **Bålsamtaler** – der er noget ved et bål der åbner op for dybere samtaler. Still hinanden spørgsmål, I normalt ikke stiller
- **Morgenmad i naturen** – vågn op til fuglesang og lav kaffe over gløder. Friskbrygget kaffe i morgenkulden med tåge over søen er svær at toppe

## Den rette timing

Ikke alle tidspunkter er lige gode til en romantisk sheltertur:

- **Forår (april–maj)** – lyse aftener, anemoner i skovbunden og fuglesang. Nætterne er kølige men håndterbare med god sovepose
- **Sensommer (august–september)** – varme nætter, stjerneklar himmel og gylden aftensol. Myggene aftager
- **Efterår (oktober)** – farverig skov og klar luft. Kortere dage giver længere bålaftener. Pak varmt

Undgå ture i højsæsonen (juni–juli weekender), hvor chancen for andre besøgende er størst – og myggene er på deres værste.

![Stjernehimmel over skov](https://images.unsplash.com/photo-1500534314263-a3817d98e140?w=1200&q=80&auto=format&fit=crop)

## Praktiske tips

Et par afsluttende råd til den perfekte tur for to:

- **Fortæl om planen** – en overraskelsestur er romantisk, men sørg for at din partner ved, at det indebærer overnatning udendørs. Ikke alle finder det charmerende uden forvarsel
- **Pak smart** – fordel vægten i to rygsække, så ingen bærer alt det tunge
- **Tænk over hygiejne** – medbring vådservietter, tandbørste og en lille flaske håndsæbe. Det er de små ting, der gør komforten
- **Hav en plan B** – hvis vejret vender helt, er det okay at køre hjem. Romantik fungerer dårligt i iskoldt slagregn

Læs også om [hvordan du vælger det rigtige shelter](/blog/hvordan-vælge-shelter) og tjek vores [pakkeliste](/guides/pakkeliste-til-sheltertur) for at sikre, at I har alt med. Besøg [Naturstyrelsens hjemmeside](https://naturstyrelsen.dk) for aktuel information om shelters og naturområder.`,
    faq: [
      {
        question: "Kan man booke et shelter til sig selv?",
        answer:
          "Ja, mange bookbare shelters kan reserveres til en enkelt gruppe. Book via bookenshelter.dk eller udinaturen.dk. Bemærk at gratis først-til-mølle shelters ikke kan reserveres, og du risikerer at få selskab. Til en romantisk tur anbefales booking stærkt.",
      },
      {
        question: "Hvad er de mest romantiske shelters i Danmark?",
        answer:
          "Shelters med udsigt over vand er generelt de mest stemningsfulde. Kig efter pladser ved søer i Søhøjlandet, ved kysten på Bornholm eller i Nordsjællands skove. Shelters der ligger lidt afsides og har god bålplads, giver den bedste oplevelse for to.",
      },
      {
        question: "Er en sheltertur en god idé til en første date?",
        answer:
          "Det afhænger af parret. For friluftsinteresserede kan det være fantastisk, men det er ret intimt for en første date. Overvej i stedet en dagtur med bål og madlavning som første skridt, og gem overnatningen til et senere tidspunkt, når I kender hinanden bedre.",
      },
    ],
  },
];

export function getBlogPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function getBlogCategories(): BlogCategory[] {
  return BLOG_CATEGORIES;
}

export function getFeaturedPost(): BlogPost {
  return getBlogPosts()[0];
}
