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
  "Natur",
];

const GUIDE_CATEGORY_DESCRIPTIONS: Record<GuideCategory, string> = {
  Pakkeliste:
    "Pakkelister og tjeklister til shelterture, så du har styr på udstyr, tøj og de små detaljer.",
  Regler:
    "Guides til regler for shelter, teltning, booking og hvad du må i dansk natur.",
  Begynder:
    "Begynderguides til din første sheltertur med valg af shelter, planlægning og gode vaner.",
  Mad:
    "Guides til nem sheltermad, mad over bål og opskrifter der fungerer i naturen.",
  Vinter:
    "Råd om vinterovernatning, varme, sikkerhed og forberedelse til kolde shelterture.",
  Udstyr:
    "Guides til udstyr, sovegrej og praktiske valg før du tager på sheltertur.",
  Natur:
    "Inspiration og guider til naturområder, nationalparker og landskaber med gode shelters.",
};

export interface Guide {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: GuideCategory;
  publishedAt: string;
  updatedAt: string;
  faq?: { question: string; answer: string }[];
}

export const GUIDES: Guide[] = [
  {
    slug: "shelter-i-nationalparker",
    title: "Shelter i nationalparker – find naturens bedste pladser",
    excerpt:
      "Danmark har fem nationalparker med unikke sheltermuligheder. Udforsk shelters i Thy, Mols Bjerge, Vadehavet, Skjoldungernes Land og Kongernes Nordsjaelland.",
    coverImage:
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/862d0a21-7627-4a6a-9c13-aa2d2d442938.jpg",
    category: "Natur",
    publishedAt: "2025-02-18",
    updatedAt: "2026-03-06",
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
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/ef2db7dd-fccf-4c69-a6e1-808468d15982.jpg",
    category: "Begynder",
    publishedAt: "2025-03-04",
    updatedAt: "2026-06-11",
    content: `
## Find det shelter, der passer til netop din tur

Danmark har hundredvis af shelters spredt ud over hele landet. Det kan virke uoverskueligt at finde den rigtige plads, men med en struktureret tilgang bliver det hurtigt nemmere. Denne guide hjælper dig med at vælge shelter ud fra faciliteter, beliggenhed, sæson og praktiske forhold som booking. Brug den som dit overblik, når du planlægger din næste sheltertur.

## Beliggenhed og adgang: hvor langt vil du gå?

Det første valg er, hvor langt du er villig til at gå med oppakning. Nogle shelters ligger få hundrede meter fra en parkeringsplads og er perfekte til familier med små børn eller til din første tur. Andre kræver flere kilometers vandring ad skovstier — det giver en mere autentisk naturoplevelse, men kræver bedre planlægning og lettere grej.

Tænk også over landskabet: Vil du vågne til lyden af bølger ved kysten, fuglesang i en gammel bøgeskov eller udsigt over en stille sø? Brug kortet i [sheltersøgningen](/soeg) til at se den præcise placering og terrænet omkring pladsen, før du beslutter dig.

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

Booking er især en god idé, når du:

- Rejser med børn og har brug for sikkerhed i planlægningen
- Skal afsted i højsæsonen (juni–august), hvor først-til-mølle-pladser fyldes hurtigt
- Har lang transport og ikke vil risikere at køre forgæves

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
      "Den store pakkeliste til sheltertur med hurtig tjekliste, udstyr til børn og vinter samt de vigtigste ting, du ikke må glemme før du tager afsted.",
    coverImage:
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/20ce3f13-4d23-4d31-9f54-5fde55d4fe7e.jpg",
    category: "Pakkeliste",
    publishedAt: "2025-03-21",
    updatedAt: "2026-03-28",
    content: `
Hvis du leder efter en **pakkeliste til sheltertur**, er de vigtigste ting: sovepose, liggeunderlag, varmt tøj i lag, mad, vand, lys og en lille pose med hygiejne og førstehjælp. Resten handler om komfort og om at pakke rigtigt til årstid, turens længde og hvem du rejser med.

## Kort pakkeliste til sheltertur

Hvis du bare vil have den korte version, så pak mindst:

- **Sovepose** der passer til årstiden
- **Liggeunderlag** eller madrasunderlag
- En [sovepude og lagenpose](/bedste/sovepude) til bedre søvn og et par graders ekstra varme
- Varmt **tøj i lag** + ekstra sokker
- **Mad og vand** til hele turen
- **Pandelygte** eller lommelygte
- Tandbørste, toiletpapir og **håndsprit**
- Telefon + **powerbank**
- Lille **førstehjælpskit**
- Skraldeposer til affald og vådt tøj

Det er minimumspakken til en almindelig sheltertur med én overnatning. Nedenfor får du den komplette tjekliste, plus ekstra udstyr til børn, vinter og begyndere.

## Minimal pakkeliste til sheltertur med 1 overnatning

Til en kort tur behøver du sjældent at pakke tungt. Tænk i tre niveauer:

- **Sovegrej**: sovepose, liggeunderlag og evt. lille pude
- **Beklædning**: ét sæt til turen, ét varmt lag til aftenen og ét tørt sæt til at sove i
- **Mad og praktiske ting**: aftensmad, morgenmad, vand, bestik, lys og toiletgrej

Hvis det er jeres første tur, kan det være en fordel at læse [Shelter for begyndere – sådan får du en god første tur](/guides/shelter-for-begyndere-forste-tur), så pakkelisten passer til en realistisk begyndertur og ikke til en ekspedition.

## 1. Sovegrej – det allervigtigste

Hvis du kun skal huske én ting, er det **sovegrej**. Uden god søvn bliver alt andet surt.

Pak mindst:

- **Sovepose** der passer til årstiden (tjek comfort-temperaturen) – se [vores test af de bedste soveposer](/bedste/sovepose)
- **Uldundertøj** at sove i — se [bedste uldundertøj](/bedste/uldundertoj)
- **Liggeunderlag** – gerne oppusteligt + evt. skumunderlag under til kulde ([bedste liggeunderlag](/bedste/liggeunderlag))
- Evt. **pude** eller et sammenrullet trøje

::gear-group[backpackerlife-499694,outdoortid-49290462232908]

Overvej også:

- Lagenpose eller indersovepose (nemmere at vaske)
- [Tarp](/bedste/tarp) eller lille telt, hvis du er i tvivl om hvor tæt shelteret er
- Ekstra tæppe eller fleecepose til kolde nætter

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

## Pakkeliste til sheltertur med børn

Når du pakker til børn, er målet ikke bare at overleve natten, men at gøre turen rar nok til, at alle får lyst til at tage afsted igen.

Pak typisk ekstra:

- Ét ekstra varmt lag pr. barn – og en [sovepose der passer til børn](/bedste/sovepose-til-boern)
- Ét ekstra tørt sæt tøj pr. barn
- Hue og vanter, også i skuldersæsonerne
- Snacks, drikkedunk og noget velkendt mad
- Evt. bamse, lille pude eller andet tryghedsskabende
- Vådservietter og flere skraldeposer end du tror

Til familieture er det ofte de små komfortting, der redder aftenen. Se også vores guide til [shelter med børn](/blog/shelter-med-boern) og siden med [shelter til familier](/shelter-til-familier), hvis du vil finde pladser, der er nemmere at starte med.

## 3. Mad og køkken

Gør det simpelt – så du kan hygge dig, i stedet for at stå med et avanceret køkkenprojekt.

Grundlæggende køkken:

- Trangia eller lille gasbrænder
- Brændstof / gas + tændstikker/tændstål
- 1 gryde og evt. 1 pande
- Krus, tallerken og bestik pr. person
- Skarp kniv og lille skærebræt

::gear[backpackerlife-361944]

Madidéer til shelter:

- One-pot pasta eller gryderet
- Pølser og grønt på pande
- Havregrød til morgenmad
- Snobrød eller pandekager til hygge

Husk også:

- **Vand** (hvis der ikke er vand ved shelteret)
- Skraldeposer – alt du tager med ud, skal med hjem igen

Hvis du mangler ideer til nem aftensmad og morgenmad, så læs [Mad over bål – nem shelter-mad til hele turen](/guides/mad-over-bal-nem-shelter-mad).

## 4. Hygiejne og komfort

Det behøver ikke være luksus – men lidt komfort gør turen markant bedre.

Pak fx:

- Tandbørste, tandpasta og evt. lille håndklæde
- Håndsprit eller vådservietter
- Toiletrulle i vandtæt pose
- Lille førstehjælpskit (plaster, sportstape, smertestillende, vabelplastre)

## Pakkeliste til sheltertur om vinteren

En vinter-sheltertur kræver ikke nødvendigvis meget mere udstyr, men det kræver **varmere og mere gennemtestet udstyr**.

Pak ekstra til vinter:

- Varmere sovepose eller kombination af sovepose + inderpose
- Isolerende liggeunderlag med høj R-værdi
- Uldundertøj, varm hue og tørre sokker kun til natten — se [bedste uldundertøj](/bedste/uldundertoj) og [bedste vandresokker](/bedste/vandresokker)
- Termokande med varmt vand eller te
- Ekstra handsker og evt. håndvarmere
- Tørpose til tøj og elektronik

Er du i tvivl om temperaturer, kondens og kulde, så læs [Overnatning i shelter om vinteren – sådan gør du](/guides/overnatning-i-shelter-om-vinteren) som supplement til denne pakkeliste.

## 5. Lys, strøm og sikkerhed

Det bliver **mørkt** i skoven – også selvom du er tæt på byen.

Husk:

- Pandelygte til alle + ekstra batterier – se [bedste pandelampe](/bedste/pandelampe)
- Powerbank til telefon
- Kort eller offline kort på mobilen

::gear[outmore-9328389030533]

Tænk også over sikkerhed:

- Fortæl nogen, hvor I skal hen, og hvornår I er hjemme igen
- Hav styr på vejrudsigten, før I tager afsted

![Pandelygte og udstyr pakket klar til sheltertur](https://images.unsplash.com/photo-1532339142463-fd0a8979791a?w=1200&q=80&auto=format&fit=crop)

## 6. 5 ting folk oftest glemmer

Det er sjældent de store ting, der bliver glemt. Det er næsten altid småting, som først bliver irriterende, når man står derude.

De mest glemte ting på sheltertur er:

- Ekstra **sokker** eller tørt nattøj
- **Toiletpapir** i en lukket pose
- Opladt **powerbank**
- Noget at sidde på ved bålet
- Skraldeposer til vådt tøj og affald

Hvis du vil undgå den klassiske "vi mangler noget"-følelse, så pak aftenen før og kryds af punkt for punkt.

## 7. Små ting der gør turen ekstra god

Det er ofte de små ting, man bliver gladest for:

- Siddemåtte eller lille foldestol
- Spil eller kort til aftenen
- En god bog eller notesbog
- Skumfiduser, chokolade eller anden lille luksus

Med denne pakkeliste er du dækket ind til de fleste shelterture – både med venner, kæreste og familie. Har du brug for mere inspiration til udstyr, så tjek vores [udstyrguide for begyndere](/blog/udstyr-guide-begyndere). Se også de [bedste outdoor-tilbud lige nu](/tilbud) og spar på udstyret.

Hvis du vil dykke endnu mere ned i forberedelserne, kan du læse guiden [Shelter for begyndere – sådan får du en god første tur](/guides/shelter-for-begyndere-forste-tur) og vores tips til [Mad over bål – nem shelter-mad til hele turen](/guides/mad-over-bal-nem-shelter-mad). Begynder du at planlægge ture i de koldere måneder, er [Overnatning i shelter om vinteren – sådan gør du](/guides/overnatning-i-shelter-om-vinteren) et godt supplement til denne pakkeliste. Find din næste shelterplads via [oversigten over shelters i Danmark](/danmark).
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
      {
        question: "Hvad er minimum man skal have med på en sheltertur?",
        answer:
          "Som minimum skal du have sovepose, liggeunderlag, varmt tøj, mad, vand, lys og lidt basisgrej til hygiejne og sikkerhed. Det er nok til en enkel sheltertur med én overnatning.",
      },
      {
        question: "Hvad skal børn have med på sheltertur?",
        answer:
          "Børn skal især have varmt skiftetøj, tørre sokker, hue, enkel mad, drikkedunk og gerne en lille tryghedsting som bamse eller pude. På sheltertur med børn er ekstra komfort ofte vigtigere end at pakke ultralet.",
      },
      {
        question: "Hvad skal man pakke til sheltertur om vinteren?",
        answer:
          "Til vinter bør du pakke varmere sovepose, mere isolerende liggeunderlag, uldlag, tørre sokker kun til natten og ekstra beskyttelse mod fugt og kulde. Vinterture handler især om at holde varmen nedefra og holde tøjet tørt.",
      },
    ],
  },
  {
    slug: "regler-for-shelter-og-teltning-i-danmark",
    title: "Regler for shelter og teltning i Danmark",
    excerpt:
      "Få styr på de vigtigste regler for shelters og teltning i Danmark: hvor længe du må blive, om du må drikke alkohol, og hvem der har førsteret til pladsen.",
    coverImage:
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/fb4d6fb9-6c08-4ff6-ac92-e4010c1d4876.jpg",
    category: "Regler",
    publishedAt: "2025-04-11",
    updatedAt: "2026-06-11",
    content: `
Må man bare overnatte i naturen i Danmark? Svaret er nej — men systemet er bedre, end rygtet siger. Danmark har over 1.600 shelters og primitive overnatningspladser, hvor du må sove lovligt, og i mange tilfælde gratis. Denne guide samler alle reglerne: hvor længe du må blive, hvor du må slå telt op, hvad du må med bål og alkohol, og hvad der sker, hvis du bryder reglerne.

## Grundreglen: udpegede pladser

I Danmark er det som udgangspunkt kun tilladt at overnatte på udpegede pladser — shelters, primitive teltpladser og lejrpladser, der er markeret og godkendt til formålet. Du kan altså ikke bare finde et pænt sted i skoven og slå lejr. Naturbeskyttelsesloven regulerer adgangen til naturen, og selvom Danmark har gode adgangsregler, er grænserne klare.

Det adskiller os fra Sverige og Norge, hvor allemandsretten er langt mere vidtgående. Til gengæld er det danske net af lovlige pladser tæt: du er sjældent mere end 10-15 km fra den nærmeste plads, og du kan finde dem alle på [Søg shelters](/soeg) eller [Ud i Naturen](https://udinaturen.dk/).

## Hvor længe må man blive på et shelter?

Reglerne varierer efter, hvem der ejer eller forvalter området (Naturstyrelsen, kommune, privat). Som hovedregel:

- På **Naturstyrelsens primitive overnatningspladser** må du typisk blive op til **2 nætter** samme sted.
- På **fri teltning-områder** (uden faste shelters) må du typisk overnatte **én nat** samme sted.
- På **bookbare shelters** gælder det tidsrum, du har booket.

Tjek altid beskrivelsen på sheltersiden, eventuel skiltning på pladsen og [Naturstyrelsens hjemmeside](https://naturstyrelsen.dk/), hvis du er i tvivl.

![Skiltning ved en primitiv overnatningsplads i skoven](https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80&auto=format&fit=crop)

## De vigtigste regler for shelters

Shelters er de mest ligetil overnatningssteder i naturen — de er bygget til at sove i, og overnatning er tilladt, medmindre skilte siger andet:

- **Overnatning er tilladt** — det er det, shelters er til
- **Først-til-mølle** — gratis shelters kan ikke reserveres, og du har ikke eneret på pladsen
- **Typisk maks. 2 nætter** — medmindre andet er angivet
- **Brug kun etablerede bålpladser** — aldrig bål uden for de markerede områder
- **Tag alt affald med** — efterlad ingen spor

## Hvem har førsteret til shelteret?

- Mange shelters er **først-til-mølle** — den, der kommer først, må bruge pladsen.
- På **bookbare shelters** har den, der har booket, førsteret i det reserverede tidsrum.

Det er god stil at spørge venligt, om der er plads til flere, hvis nogen allerede er der — og at være åben for at dele, når shelteret ikke er eksklusivt booket. Læs mere om god opførsel i vores artikel om [shelter-etikette](/blog/shelter-etiquette).

## Må man drikke alkohol ved shelteret?

Der findes sjældent en specifik lov mod alkohol ved et shelter, men:

- Du skal følge **almindelige ordensregler**
- Du må ikke være til gene for andre gæster eller naboer
- Åbenlys støj og fest er sjældent populært — og kan være forbudt på kommunale/private pladser

Respekter særlige regler, hvis de er skiltet eller nævnt i pladsens beskrivelse.

## Hvor må man slå telt op?

Teltreglerne er mere komplicerede end shelter-reglerne:

**I statsskove (Naturstyrelsens skove):**

- Du må telte én nat på udpegede teltpladser
- Mange statsskove har gratis primitive teltpladser
- Du må ikke slå telt op frit i skoven

**I private skove over 5 hektar:**

- Du må telte en enkelt nat, hvis du er gående eller på cykel
- Du skal holde mindst **150 meter fra beboelse**
- Du skal være væk senest **kl. 10 dagen efter ankomst**
- Det gælder kun, hvis der ikke er skiltet med forbud

**Andre steder:**

- På stranden må du som udgangspunkt ikke telte
- I klitter, fredede områder og sårbare naturområder er overnatning forbudt
- I nationalparker kan der gælde særlige regler

![Telt ved en shelterplads i dansk natur](https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop)

## Hvad med fri camping og wild camping?

Wild camping — at overnatte frit i naturen uden for udpegede pladser — er generelt **ikke tilladt** i Danmark. De lovlige muligheder for "fri" overnatning er:

- Udpegede shelters og teltpladser
- Private skove over 5 hektar (med begrænsningerne ovenfor)
- Steder hvor du har ejerens udtrykkelige tilladelse

Der findes desuden et netværk af fri teltning-områder udpeget specifikt til formålet — se [Naturstyrelsens kort](https://naturstyrelsen.dk/) eller [Ud i Naturen](https://udinaturen.dk/).

## Bålregler

Bål er en central del af shelteroplevelsen, men reglerne er faste:

- **Brug kun etablerede bålpladser** — aldrig bål direkte på skovbunden
- **Tjek for bålforbud** — i tørre perioder kan myndighederne forbyde åben ild, også uden for sommeren
- **Fæld aldrig levende træer** — brug dødt, nedfaldent træ eller medbring eget brænde
- **Sluk bålet helt** — hæld vand på gløderne, og mærk efter at alt er koldt, før du går

Overtrædelse af bålregler kan medføre bøde — og erstatningsansvar, hvis ilden forårsager skade.

## Generelle naturregler du skal kende

- Tag altid dit affald med — også madrester og cigaretskod
- Parker kun, hvor det er tilladt
- Lad dyrelivet være i fred, og hold hund i snor, hvor det kræves
- Respekter afspærringer og fredninger

## Hvad sker der, hvis man bryder reglerne?

- **Teltning uden for udpegede pladser** — kan give bøde; Naturstyrelsen og politiet håndhæver reglerne
- **Ulovligt bål** — bøde og eventuelt erstatningsansvar
- **Hærværk på shelters eller natur** — strafbart efter straffeloven
- **Forsøpling** — bøde og i grove tilfælde politianmeldelse

I praksis møder de fleste aldrig problemer, hvis de bruger sund fornuft og holder sig til de udpegede pladser. Myndighederne er generelt imødekommende over for friluftsfolk, der opfører sig ordentligt.

## Kom godt afsted

Danmark har et fint system for naturovernatning — nøglen er at kende reglerne, bruge de udpegede pladser og rydde op efter sig. Find din plads på [Søg shelters](/soeg), og kombinér denne guide med [Shelter for begyndere](/guides/shelter-for-begyndere-forste-tur) og den store [Pakkeliste til sheltertur](/guides/pakkeliste-til-sheltertur), så er du klar til turen — helt inden for lovens rammer.
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
      {
        question: "Er wild camping lovligt i Danmark?",
        answer:
          "Nej, som udgangspunkt ikke. Du må kun overnatte på udpegede pladser, i private skove over 5 hektar (én nat, 150 m fra beboelse, væk inden kl. 10) eller med ejerens tilladelse.",
      },
      {
        question: "Må man drikke alkohol ved et shelter?",
        answer:
          "Der er sjældent et direkte forbud, men almindelige ordensregler gælder: du må ikke være til gene for andre. Kommunale og private pladser kan have egne regler – tjek skiltning og pladsens beskrivelse.",
      },
      {
        question: "Hvad er bøden for at telte ulovligt?",
        answer:
          "Teltning uden for udpegede pladser kan give en bøde, og ulovligt bål kan derudover medføre erstatningsansvar. I praksis håndhæves reglerne lempeligt over for folk, der opfører sig ordentligt og flytter sig, når de bliver bedt om det.",
      },
    ],
  },
  {
    slug: "shelter-for-begyndere-forste-tur",
    title: "Shelter for begyndere – sådan får du en god første tur",
    excerpt:
      "Ny i shelters? Her får du en enkel introduktion til valg af plads, grej, mad og gode vaner, så din første tur bliver en succes.",
    coverImage:
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/8d8316d3-7be9-4b6c-8c90-8c1dd01cbd2c.jpg",
    category: "Begynder",
    publishedAt: "2025-04-28",
    updatedAt: "2026-06-11",
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
    

## De 5 mest almindelige begynderfejl

1. **For meget oppakning** — du skal ikke bruge 80 % af det, du tror. Følg [pakkelisten](/guides/pakkeliste-til-sheltertur) og lad resten blive hjemme
2. **For tynd sovepose** — nætterne er 10-15 grader koldere end dagene, også om sommeren. Tjek comfort-temperaturen, ikke extreme-temperaturen ([sovepose-guide her](/bedste/sovepose))
3. **Intet liggeunderlag** — briksen i et shelter er hårdt træ, og kulden kommer nedefra. Et [liggeunderlag](/bedste/liggeunderlag) er ikke valgfrit
4. **Ankomst i mørke** — giv dig selv mindst to timers dagslys til at finde pladsen, slå lejr og samle brænde
5. **Ingen plan B** — først-til-mølle-shelters kan være optaget. Hav 1-2 alternative pladser klar i nærheden, eller book hvor det er muligt

## Hvad koster en sheltertur?

En af de bedste ting ved shelterlivet: det er næsten gratis. De fleste shelters koster 0 kr. (se [oversigten over gratis pladser](/fakta/gratis-shelters)), og bookbare pladser ligger typisk på 30-100 kr. pr. nat. Startudstyret behøver heller ikke ruinere dig — en god begynder-sovepose, et liggeunderlag og en pandelampe kan samlet fås for under 1.000 kr., hvis du vælger efter [vores grej-tests](/bedste) frem for at købe i blinde.

## Din første tur: kort opskrift

Vælg en plads under 30 minutter hjemmefra med toilet og kort afstand fra parkering. Tag afsted en lun aften i maj-september med en ven. Spis aftensmad over bål, og hav en plan om at køre hjem næste morgen. Det er hele opskriften — turen må gerne være "for nem". Succes på første tur er det, der giver lyst til tur nummer to.
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
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/9a5f3aef-c48c-4605-9709-044cd1f23a91.jpg",
    category: "Mad",
    publishedAt: "2025-05-16",
    updatedAt: "2026-06-11",
    content: `
## Basisudstyr til mad over bål

Du behøver ikke et helt udekøkken for at lave god mad over bål. Som regel rækker:

- Bålrist eller trefod (hvis det findes på pladsen)
- 1–2 solide gryder/pander
- Tang eller grillhandske

Husk at tjekke, om der er **bålplads** og om der er **bålforbud** i området. Aktuelle bålforbud kan ses på [Naturstyrelsens hjemmeside](https://naturstyrelsen.dk/). Er der bålforbud — eller vil du bare rejse let — er [frysetørret trekking-mad](/bedste/frysetorret-mad) en nem genvej: du skal kun bruge kogende vand fra et lille stormkøkken.

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
    

## Tidsplan: sådan undgår du at spise klokken 22

Den klassiske begynderfejl er at undervurdere, hvor lang tid bålmad tager. Et bål skal brænde **45-60 minutter**, før der er en stabil glødeseng at lave mad over — flammer er til hygge, gløder er til madlavning. En realistisk aftenplan ser sådan ud:

1. **Ankomst + lejr** (30 min): slå lejr og saml brænde FØR du er træt og sulten
2. **Bål tændes** (kl. ~17): mens det brænder ned, forberedes maden — snit grøntsager, marinér kød
3. **Madlavning over gløder** (kl. ~18): one-pot-retter tager 25-40 min over gode gløder
4. **Snobrød og hygge** (efter aftensmad): nyd resten af gløderne

## Hvad gør du, når bålet driller?

- **Vådt brænde:** Flæk det — det indre er tørt. Brug kniven fra [vores knivtest](/bedste/kniv) eller en lille økse, og snit tændspåner af det tørre indre
- **Bålforbud:** Tjek altid inden afgang (især i tørre perioder). Et [stormkøkken eller Trangia](/bedste/stormkoekken) er den lovlige plan B — og faktisk hurtigere til morgenmad
- **Regn:** Lav maden under en tarp spændt op i god afstand fra bålet, og hold brændet tørt under shelterets tag

## Husk at pakke

Udover selve maden: snitteplade, en god kniv, grydelap eller arbejdshandske (gryden bliver GLOHED), stanniol, opvaskebalje og -børste, og skraldeposer til alt affald — også madrester. Se den fulde [pakkeliste](/guides/pakkeliste-til-sheltertur) med mad-sektionen.
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
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/41420734-998e-4623-bb57-1c9ea5c155b7.jpg",
    category: "Vinter",
    publishedAt: "2025-10-02",
    updatedAt: "2026-06-11",
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

- Sovepose med **comfort-temperatur under** forventet nattemperatur – se [bedste sovepose til vinter](/bedste/sovepose-til-vinter)
- Minimum ét godt liggeunderlag – gerne to (skum + oppusteligt), se [bedste liggeunderlag til vinter](/bedste/liggeunderlag-til-vinter)
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

## Sov rigtigt: teknikken der holder dig varm

Selv det bedste grej fejler, hvis du bruger det forkert. De vigtigste vinter-vaner:

- **Gå varm i seng.** Soveposen producerer ikke varme — den holder kun på din. Lav 20 sprællemænd eller en kort gåtur, før du kravler ned i posen.
- **Skift ALT tøjet.** Dagens tøj er fugtigt af sved, selv om det ikke føles sådan. Sov i et tørt sæt uld, du kun bruger til at sove i.
- **Spis fedt og varmt før sengetid.** Kroppen brænder kalorier for at holde varmen hele natten — en håndfuld nødder eller et stykke chokolade lige før du sover, er reelt "brændsel".
- **Flaskefidusen:** Fyld en drikkeflaske (der tåler det) med varmt vand og læg den ved fødderne eller i lysken, hvor blodet løber tæt på overfladen.
- **Luft ud i posen om morgenen** — ellers samler nattens fugt sig i fyldet og gør posen koldere nat for nat.

## Mad og drikke i frostvejr

Vinterture brænder langt flere kalorier end sommerture. Planlæg mad, der er hurtig, fed og varm: havregrød med smør og rosiner til morgen, og en one-pot-ret til aften. Husk at:

- Vand fryser — opbevar flasken med bunden i vejret (isen lægger sig i toppen, så låget ikke fryser fast) eller inde i rygsækken
- En termokande med te eller bouillon er guld værd ved ankomst, før bålet er i gang
- Gasblus mister tryk i frost — læg gasdåsen i soveposen om natten, eller brug vinterblanding

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
    

## Begynderens første vintertur: tjekliste

Er det din første tur i frostgrader, så gør den kort og sikker:

1. Vælg et shelter **tæt på bilen** (under 1 km) — så er en kold nat aldrig farlig, bare ubehagelig
2. Tjek vejrudsigten samme dag — udskyd ved udsigt til regn/slud omkring frysepunktet (det farligste vintervejr)
3. Sig til nogen derhjemme, hvor du er, og hvornår du er hjemme
4. Pak efter [pakkelisten til vinterture](/guides/pakkeliste-til-sheltertur), og brug grej-testene: [bedste vintersovepose](/bedste/sovepose-til-vinter) og [bedste liggeunderlag til vinter](/bedste/liggeunderlag-til-vinter)
5. Book eventuelt pladsen, hvor det er muligt — vinterpladser er sjældent optaget, men en booking giver ro i planlægningen

Vinterovernatning i shelter er en af de mest givende friluftsoplevelser, Danmark byder på: stilheden, stjernehimlen og følelsen af at have naturen helt for sig selv. Med det rigtige grej og de rigtige vaner er det hverken farligt eller specielt ubehageligt — bare velforberedt.
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
  {
    slug: "saadan-booker-du-shelter",
    title: "Sådan booker du shelter i Danmark – komplet guide",
    excerpt:
      "Lær hvornår og hvordan du booker shelter i Danmark. Se hvilke platforme der bruges, hvad det koster, og hvornår det er nødvendigt at booke på forhånd.",
    coverImage:
      "https://mapcentia-www.s3-eu-west-1.amazonaws.com/fkg/1600/3defe0e8-fadc-4ee3-9eb4-9671b5e7b155.jpg",
    category: "Begynder",
    publishedAt: "2025-11-14",
    updatedAt: "2026-04-05",
    content: `
## Hvornår skal du booke shelter?

Ikke alle shelters i Danmark kræver booking – mange fungerer efter først-til-mølle-princippet, hvor du bare møder op og slår lejr. Men i højsæsonen fra maj til september og i weekenderne er de populære pladser hurtigt optaget. Hvis du har sat dig et bestemt mål, er det klogt at sikre din plads i god tid.

Som tommelfingerregel: book shelter hvis du rejser i weekender, på helligdage eller i sommerferien. Rejser du på en tilfældig hverdagaften tidligt i sæsonen, er du sjældent i fare for at stå uden plads.

## Hvor booker man shelter i Danmark?

De fleste bookbare shelters i Danmark kan bookes via én af to platforme:

### Ud i Naturen (udinaturen.dk)

Ud i Naturen er Naturstyrelsens officielle platform og det primære sted at booke statsejede shelters og lejrpladser. Her finder du pladser i statsskove, langs vandreruter som Hærvejen og Camønoen, og i en lang række naturparker. Booking er gratis på de fleste pladser, men du skal oprette en bruger. Tilgængelighed og regler fremgår direkte på pladsen.

### Naturstyrelsen (naturstyrelsen.dk)

Naturstyrelsen administrerer mange af de samme pladser som Ud i Naturen og bruger i dag typisk Ud i Naturen som bookingplatform. Gå direkte til udinaturen.dk for at søge og booke.

### Kommunale bookingsystemer

Nogle kommunale shelters bruger egne systemer eller lokale hjemmesider. Tjek altid den konkrete shelterside på ShelterDK – der vil fremgå en direkte bookinglink, hvis pladsen kan bookes.

## Hvad koster det at booke shelter?

Mange shelters er gratis at bruge og booke. Det gælder særligt shelters langs statsejede vandreruter og i naturstyrelsesskove. Andre pladser – typisk dem med faciliteter som toilet, bruser og tømmerbarhygge – koster et beløb per nat. Prisen ligger typisk mellem 0 og 150 kr. per person eller per gruppe.

Tjek altid prisen på bookingplatformen, inden du bekræfter. Betalingen sker online ved booking.

## Trin-for-trin: Sådan booker du shelter på Ud i Naturen

1. Gå til [udinaturen.dk](https://udinaturen.dk) og opret en gratis bruger
2. Søg på shelternavn, region eller vandrerute
3. Vælg plads og tjek ledighed på den ønskede dato
4. Klik "Book" og udfyld antal personer og eventuel betaling
5. Du modtager en bekræftelse på e-mail – gem den, da du kan blive bedt om at vise den

Husk at annullere i god tid, hvis du ikke kan komme – så frigøres pladsen til andre.

## Først-til-mølle vs. booking

Mange shelters har ingen booking og er åbne for alle der ankommer. Det giver frihed til spontane ture, men ingen garanti for en plads. Fordele og ulemper:

| | Booking | Først-til-mølle |
|---|---|---|
| Garanti for plads | Ja | Nej |
| Kræver planlægning | Ja | Nej |
| Fleksibilitet | Begrænset | Stor |
| Typisk pris | 0–150 kr. | Gratis |

Til korte weekendture i højsæsonen anbefaler vi altid at booke. Til lange vandreture med flere overnatninger kan det være en fordel at have lidt fleksibilitet – kombiner eventuelt bookede pladser med fri overnatning undervejs.

## Populære ruter med bookbare shelters

- **Hærvejen** – vandrerute gennem midtjylland med mange bookbare pladser via Ud i Naturen
- **Camønoen** – rute på Møn og Sydsjælland med gode overnatningsfaciliteter
- **Øhavsstien** – rute på Sydfyn og øerne med shelters langs kysten
- **Palatstien** – rute i Nordsjælland med shelters i Gribskov

Find alle bookbare shelters via [ShelterDKs booking-oversigt](/shelter-booking) eller søg direkte med booking-filtret på [søgesiden](/soeg?bookbar=1).

## Tips til booking i højsæsonen

- Book 2–4 uger i forvejen til populære weekender
- Tjek annulleringer dagen inden – pladser dukker op igen
- Overvej hverdagsture – onsdag og torsdag er sjældent fuldt besat
- Kig efter pladser lidt uden for turistcentre – de er ofte ledige

Læs også vores [pakkeliste til sheltertur](/guides/pakkeliste-til-sheltertur) og [guide til regler for shelter og teltning](/guides/regler-for-shelter-og-teltning-i-danmark), så du er godt forberedt når du ankommer.
    `.trim(),
    faq: [
      {
        question: "Skal man booke shelter i Danmark?",
        answer:
          "Det afhænger af sheltertypen og tidspunktet. Mange shelters fungerer efter først-til-mølle, men i weekender og sommersæsonen anbefales det at booke de populære pladser på forhånd via udinaturen.dk.",
      },
      {
        question: "Hvor booker man shelter i Danmark?",
        answer:
          "De fleste bookbare shelters bookes via udinaturen.dk, som er Naturstyrelsens officielle platform. Nogle kommunale shelters bruger egne bookingsystemer – tjek den konkrete shelterside for direkte bookinglink.",
      },
      {
        question: "Hvad koster det at booke shelter?",
        answer:
          "Mange shelters er gratis. Pladser med faciliteter som toilet og bruser koster typisk 0–150 kr. per nat per person eller gruppe. Tjek altid prisen på bookingplatformen inden du bekræfter.",
      },
      {
        question: "Hvor lang tid i forvejen bør man booke shelter?",
        answer:
          "I højsæsonen (maj–september) og i weekenderne anbefales det at booke 2–4 uger i forvejen til populære pladser. Hverdagsture tidligt eller sent på sæsonen kan ofte bookes med kortere varsel.",
      },
    ],
  },
];

export function getGuides(): Guide[] {
  return [...GUIDES].sort(
    (a, b) =>
      new Date(b.updatedAt ?? b.publishedAt).getTime() -
      new Date(a.updatedAt ?? a.publishedAt).getTime()
  );
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getGuideCategories(): GuideCategory[] {
  return GUIDE_CATEGORIES;
}

export function getGuideCategoryDescription(category: GuideCategory): string {
  return GUIDE_CATEGORY_DESCRIPTIONS[category];
}

export function getRelatedGuides(slug: string, limit = 2): Guide[] {
  const current = getGuideBySlug(slug);
  if (!current) return [];

  const allGuides = getGuides().filter((guide) => guide.slug !== slug);
  const sameCategory = allGuides.filter((guide) => guide.category === current.category);
  const otherGuides = allGuides.filter((guide) => guide.category !== current.category);

  return [...sameCategory, ...otherGuides].slice(0, limit);
}
