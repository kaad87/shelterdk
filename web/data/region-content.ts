export interface RegionContent {
  intro: string;
  sections: { heading: string; text: string }[];
  highlights: string[];
}

export const REGION_CONTENT: Record<string, RegionContent> = {
  Jylland: {
    intro:
      "Jylland er Danmarks største landsdel og hjem til hundredvis af shelters spredt over et varieret landskab – fra Vesterhavets klitplantager til Østjyllands fjorde og Midtjyllands heder. Med tre nationalparker og tusindvis af kilometer vandrestier er Jylland den perfekte destination for naturovernatning.",
    sections: [
      {
        heading: "Shelters i Jyllands nationalparker",
        text: "Nationalpark Thy, Nationalpark Mols Bjerge og Nationalpark Vadehavet byder alle på sheltermuligheder i enestående natur. I Thy finder du shelters med udsigt over Vesterhavet, mens Mols Bjerge byder på bakket terræn med udsyn over Ebeltoft Vig. Ved Vadehavet kan du overnatte tæt på Danmarks mest unikke tidevandsnatur.",
      },
      {
        heading: "Populære områder for shelterture",
        text: "Hærvejen, der strækker sig gennem hele Jylland, passerer adskillige shelters og er ideel til flerdages vandreture. Silkeborg-søerne, Rold Skov og Rebild Bakker er blandt de mest besøgte shelterområder. I Søhøjlandet finder du shelters ved søer og åer med gode muligheder for fiskeri og kano.",
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
      "Sjælland byder på overraskende mange sheltermuligheder trods landsdelens tætte befolkning. Fra Nordsjællands bøgeskove og Kongernes Nordsjælland til Sydsjællands åbne landskaber og Stevns Klint finder du shelters i varieret natur – ofte med kort afstand til offentlig transport.",
    sections: [
      {
        heading: "Shelters nær København",
        text: "Er du bosat i hovedstadsområdet, behøver du ikke rejse langt for en nat i naturen. Nordsjællands skove, Dyrehaven og områderne omkring Roskilde Fjord har shelters inden for en times kørsel. Det gør shelterture til et oplagt weekendeventyr for familier og begyndere.",
      },
      {
        heading: "Naturperler på Sjælland",
        text: "Kongernes Nordsjælland, der er på UNESCOs tentativliste, rummer flere shelters i historiske skovområder. Møns Klint og Stevns Klint er spektakulære geologiske oplevelser med nærliggende shelterpladser. Susåen byder på kano-kombinerede shelterture gennem det sydsjællandske landskab.",
      },
      {
        heading: "Transport og tilgængelighed",
        text: "Sjællands shelters er generelt let tilgængelige med offentlig transport eller cykel. Mange ligger tæt på S-togsstationer eller regionale busruter, hvilket gør dem ideelle for cykelture med overnatning. Tjek de enkelte shelters for parkeringsmuligheder.",
      },
    ],
    highlights: ["Tæt på København", "UNESCO-natur", "God offentlig transport"],
  },

  Fyn: {
    intro:
      "Fyn – eventyrets ø – er en kompakt shelterperle med kort afstand mellem pladserne. Øens bløde bakker, frugtbare landskab og over 1.100 km kystlinje giver en unik ramme for naturovernatning. Det Fynske Øhav med dets mange småøer tilbyder shelteroplevelser du ikke finder andre steder i Danmark.",
    sections: [
      {
        heading: "Shelters på Fyn og i Det Fynske Øhav",
        text: "Øhavssstien, der snor sig langs Sydfyns kyst og forbinder flere øer, passerer adskillige shelters med havudsigt. Småøer som Lyø, Avernakø og Drejø har shelters der kombinerer ø-idyl med primitiv overnatning. På selve Fyn finder du shelters i skovområderne omkring Odense og langs kysterne.",
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

export function getRegionContent(regionName: string): RegionContent | null {
  return REGION_CONTENT[regionName] ?? null;
}
