import { REGION_SHORT_NAMES, canonicalRegionSlug } from "@/lib/cross-page-config";

export interface RegionSection {
  heading: string;
  text: string;
  /** Kontekstuelle indgange (område-/by-/kommunesider) — rendres som linkrække under teksten. */
  links?: { label: string; href: string }[];
}

export interface RegionContent {
  intro: string;
  sections: RegionSection[];
  highlights: string[];
}

// Nøglen er det KORTE visningsnavn (REGION_SHORT_NAMES), ikke DB-værdien.
// DB siger "Sjælland og Øerne" — opslag skete tidligere direkte på DB-navnet,
// så Sjælland-hubben har renderet uden redaktionelt indhold. Tallene er
// optalt i basen 21/9-2026 (region = DB-navn, dubletter filtreret fra).
export const REGION_CONTENT: Record<string, RegionContent> = {
  Jylland: {
    intro:
      "Jylland er Danmarks største landsdel og hjem til over 1.000 shelters spredt over et varieret landskab – fra Vesterhavets klitplantager til Østjyllands fjorde og Midtjyllands heder. Med tre nationalparker og tusindvis af kilometer vandrestier er Jylland den perfekte destination for naturovernatning.",
    sections: [
      {
        heading: "Shelters i Nordjylland",
        text: "Omkring 260 shelters ligger nord for Limfjorden og i Himmerland. Nationalpark Thy har shelters med udsigt over Vesterhavet, Jammerbugt og Thisted er blandt de kommuner med flest pladser i landet, og Rold Skov og Rebild Bakker er klassikere med skovshelters tæt på gode vandrestier.",
        links: [
          { label: "Nationalpark Thy", href: "/omraade/nationalpark-thy" },
          { label: "Rold Skov og Rebild", href: "/omraade/rold-skov-rebild" },
          { label: "Limfjorden", href: "/omraade/limfjorden" },
          { label: "Læsø", href: "/omraade/laesoe" },
        ],
      },
      {
        heading: "Shelters i Sønderjylland",
        text: "Sønderjylland har godt 100 shelters fordelt på Sønderborg, Aabenraa, Tønder og Haderslev. Sønderborg alene har over 40 – mange af dem ved kysten på Als og Sundeved. Mod vest ligger Vadehavets UNESCO-natur med shelters ved marsken, Rømø og Tønder.",
        links: [
          { label: "Vadehavet", href: "/omraade/vadehavet" },
          { label: "Sønderborg", href: "/danmark/jylland/soenderborg" },
          { label: "Aabenraa", href: "/danmark/jylland/aabenraa" },
          { label: "Tønder", href: "/danmark/jylland/toender" },
        ],
      },
      {
        heading: "Shelters i Vestjylland",
        text: "Vestkysten fra Fanø til Thyborøn og indlandet omkring Herning og Holstebro rummer ca. 265 shelters. Ringkøbing-Skjern, Herning, Esbjerg og Varde har hver 36-44 pladser – ofte i klitplantager og hedeområder, hvor du kan ligge i læ af Vesterhavet.",
        links: [
          { label: "Fanø", href: "/omraade/fanoe" },
          { label: "Shelter i Esbjerg", href: "/by/esbjerg" },
          { label: "Ringkøbing-Skjern", href: "/danmark/jylland/ringkoebing-skjern" },
        ],
      },
      {
        heading: "Shelters i Østjylland og Søhøjlandet",
        text: "Østjylland er tættest besat med ca. 270 shelters. Søhøjlandet omkring Silkeborg og Skanderborg byder på shelters ved søer og Gudenåen med kano og fiskeri, Mols Bjerge på bakket terræn ved Ebeltoft Vig, og Djursland på kystshelters. Hærvejen passerer adskillige shelters ned gennem hele Jylland.",
        links: [
          { label: "Søhøjlandet", href: "/omraade/soehojlandet" },
          { label: "Hærvejen", href: "/omraade/haervejen" },
          { label: "Samsø", href: "/omraade/samsoe" },
          { label: "Shelter i Aarhus", href: "/by/aarhus" },
          { label: "Silkeborg", href: "/danmark/jylland/silkeborg" },
        ],
      },
      {
        heading: "Praktisk info om shelters i Jylland",
        text: "Mange jyske shelters drives af Naturstyrelsen eller lokale kommuner. Størstedelen er gratis og fungerer efter først-til-mølle-princippet, men populære pladser kan bookes via udinaturen.dk. Husk at tjekke faciliteterne – ikke alle shelters har toilet eller adgang til drikkevand.",
      },
    ],
    highlights: ["3 nationalparker", "Hærvejen", "Kyststrækninger øst og vest"],
  },

  Sjælland: {
    intro:
      "Sjælland byder på over 400 shelters trods landsdelens tætte befolkning. Fra Nordsjællands bøgeskove til Sydsjællands klinter og Lolland-Falsters kyster finder du shelters i varieret natur – ofte med kort afstand til offentlig transport.",
    sections: [
      {
        heading: "Shelters i Nordsjælland",
        text: "Nordsjælland er Sjællands tætteste shelterområde med ca. 125 pladser. Hillerød og Gribskov har over 20 hver, og Nationalpark Kongernes Nordsjælland samler Gribskov, Esrum Sø og Arresø med skovshelters få minutter fra S-tog og lokalbane. Helsingør, Fredensborg og Halsnæs har kystshelters ud til Øresund og Kattegat.",
        links: [
          { label: "Kongernes Nordsjælland", href: "/omraade/kongernes-nordsjaelland" },
          { label: "Hillerød", href: "/danmark/sjaelland-og-oeerne/hilleroed" },
          { label: "Gribskov", href: "/danmark/sjaelland-og-oeerne/gribskov" },
          { label: "Helsingør", href: "/danmark/sjaelland-og-oeerne/helsingoer" },
        ],
      },
      {
        heading: "Shelters nær København",
        text: "Bor du i hovedstadsområdet, behøver du ikke rejse langt. Amager Fælled og Kalvebod Fælled har shelters inden for cykelafstand af centrum, Dyrehaven og Jægersborg Hegn ligger ved S-toget, og Roskilde Fjord med Nationalpark Skjoldungernes Land er under en times kørsel. Det gør shelterture til et oplagt weekendeventyr for familier og begyndere.",
        links: [
          { label: "Shelter i København", href: "/by/koebenhavn" },
          { label: "Skjoldungernes Land", href: "/omraade/skjoldungernes-land" },
          { label: "Shelter i Roskilde", href: "/by/roskilde" },
          { label: "Lejre", href: "/danmark/sjaelland-og-oeerne/lejre" },
        ],
      },
      {
        heading: "Shelters i Vestsjælland og Odsherred",
        text: "Vestsjælland har ca. 80 shelters. Kalundborg og Slagelse har over 20 hver med kystshelters langs Storebælt og på Røsnæs og Reersø, mens Odsherreds bakkede istidslandskab og Holbæks fjordkyster giver skov- og strandshelters med kort afstand imellem.",
        links: [
          { label: "Odsherred", href: "/omraade/odsherred" },
          { label: "Kalundborg", href: "/danmark/sjaelland-og-oeerne/kalundborg" },
          { label: "Slagelse", href: "/danmark/sjaelland-og-oeerne/slagelse" },
          { label: "Holbæk", href: "/danmark/sjaelland-og-oeerne/holbaek" },
        ],
      },
      {
        heading: "Shelters i Sydsjælland og på Møn",
        text: "Vordingborg er med 40 shelters Sjællands næststørste shelterkommune. Møns Klint og vandreruten Camønoen har givet området et tæt net af pladser, Stevns Klint er UNESCO-verdensarv med shelters tæt på klinten, og Susåen byder på kano-kombinerede shelterture gennem Næstved.",
        links: [
          { label: "Sydsjælland og Møn", href: "/omraade/sydsjaelland-moen" },
          { label: "Shelter i Næstved", href: "/by/naestved" },
          { label: "Vordingborg", href: "/danmark/sjaelland-og-oeerne/vordingborg" },
          { label: "Stevns", href: "/danmark/sjaelland-og-oeerne/stevns" },
        ],
      },
      {
        heading: "Shelters på Lolland og Falster",
        text: "Lolland-Falster har ca. 70 shelters – Lolland er faktisk hele Sjællands største shelterkommune med 41 pladser. Her er kyststrækningerne lange og stille, Maribosøerne rummer shelters ved vandet, og de mange små havne har shelterpladser til kajakroere og cyklister på Østersøruten.",
        links: [
          { label: "Lolland-Falster", href: "/omraade/lolland-falster" },
          { label: "Lolland", href: "/danmark/sjaelland-og-oeerne/lolland" },
          { label: "Guldborgsund", href: "/danmark/sjaelland-og-oeerne/guldborgsund" },
        ],
      },
    ],
    highlights: ["Tæt på København", "2 nationalparker", "God offentlig transport"],
  },

  Fyn: {
    intro:
      "Fyn – eventyrets ø – er en kompakt shelterperle med kort afstand mellem pladserne. Øens bløde bakker, frugtbare landskab og over 1.100 km kystlinje giver en unik ramme for naturovernatning. Det Fynske Øhav med dets mange småøer tilbyder shelteroplevelser du ikke finder andre steder i Danmark.",
    sections: [
      {
        heading: "Shelters på Fyn og i Det Fynske Øhav",
        text: "Øhavssstien, der snor sig langs Sydfyns kyst og forbinder flere øer, passerer adskillige shelters med havudsigt. Småøer som Lyø, Avernakø og Drejø har shelters der kombinerer ø-idyl med primitiv overnatning. På selve Fyn finder du shelters i skovområderne omkring Odense og langs kysterne.",
        links: [
          { label: "Det Sydfynske Øhav", href: "/omraade/sydfynske-oeehav" },
          { label: "Hindsholm og Nordfyn", href: "/omraade/hindsholm-nordfyn" },
          { label: "Shelter i Odense", href: "/by/odense" },
        ],
      },
      {
        heading: "Cykelvenlige shelterture",
        text: "Fyns flade terræn og veludbyggede cykelruteenetværk gør landsdelen perfekt til cykelture med shelterovernatning. Rute 8 (Østersøruten) og flere lokale cykelruter forbinder shelters, så du kan planlægge flerdages ture uden bil. Mange pladser har cykelstativer og plads til at parkere cyklen.",
      },
      {
        heading: "Familievenlige shelters på Fyn",
        text: "Fyns overskuelige størrelse og milde klima gør øen ideel til familiens første sheltertur. Flere pladser har faciliteter som toilet, vand og bålplads, og afstandene er korte nok til at børn kan gå eller cykle med. Naturlegepladser og aktiviteter for børn findes tæt på mange shelterpladser.",
      },
    ],
    highlights: ["Det Fynske Øhav", "Øhavsstien", "Cykelvenlig"],
  },

  Bornholm: {
    intro:
      "Bornholm – solskinsøen – byder på en helt særlig shelteroplevelse med klippekyster, dybe sprækkedale og tætte skove. Øens kompakte størrelse gør det muligt at vandre fra shelter til shelter på få dage, og den karakteristiske natur adskiller sig markant fra resten af Danmark.",
    sections: [
      {
        heading: "Shelters langs kysten og i skovene",
        text: "Bornholms kyststi snor sig rundt om hele øen og forbinder flere shelterpladser med udsigt over Østersøen. Almindingen, Danmarks tredjestørste skov, rummer shelters dybt inde i skoven med mulighed for at opleve øens rige dyreliv. Ekkodalen og Paradisbakkerne er andre populære shelterområder.",
      },
      {
        heading: "Vandreture med shelterovernatning",
        text: "Bornholm er ideel til sammenhængende vandreture. Med shelters jævnt fordelt over øen kan du planlægge en flerdages rundtur og opleve klippekyster, rundkirker og kunsthåndværk undervejs. Kyststien er markeret og vedligeholdt, og terrænnet varierer fra fladt til kuperet.",
      },
      {
        heading: "Praktisk info for Bornholm",
        text: "Husk at Bornholm har et mildere klima end resten af Danmark, med flere solskinstimer. Shelters på øen drives primært af Naturstyrelsen og Bornholms Regionskommune. Færgen fra Ystad (Sverige) eller Køge giver nem adgang. I højsæsonen anbefales det at booke populære pladser i forvejen.",
      },
    ],
    highlights: ["Klippekyster", "Sprækkedale", "Kyststien rundt om øen"],
  },
};

/** Kort visningsnavn til titel/H1 — "Sjælland og Øerne" → "Sjælland". Det er formen folk søger på. */
export function regionDisplayName(regionName: string): string {
  const slug = canonicalRegionSlug(regionName);
  return REGION_SHORT_NAMES[slug] ?? regionName;
}

/** Slår op på DB-navnet ("Sjælland og Øerne") OG det korte navn ("Sjælland"). */
export function getRegionContent(regionName: string): RegionContent | null {
  return REGION_CONTENT[regionDisplayName(regionName)] ?? REGION_CONTENT[regionName] ?? null;
}

