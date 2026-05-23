/**
 * Editorial intro shown on /by/[slug] for priority cities.
 *
 * These are written to be specific and observational — not templated.
 * Google's Helpful Content algorithm demotes text that reads as
 * machine-assembled. Each entry should mention real shelter areas,
 * practical considerations (parking, transport, season), and avoid
 * the generic "stærk base", "godt udgangspunkt" pattern.
 *
 * Editing tip for the team: when adding a new city, write at least
 * ONE thing you'd actually say to a friend asking "hvor skal jeg
 * sove ude omkring [byen]?". If you can't write that, leave the
 * city out of this file rather than ship templated filler.
 */
export interface CityEditorial {
  summary: string;
  nearbyPois: string[];
}

export const CITY_EDITORIAL: Record<string, CityEditorial> = {
  "Aalborg": {
    summary:
      "Selve Aalborg har ingen shelters — det er en bykerne. Det interessante ligger nord og syd for fjorden. Hammer Bakker har de mest brugte pladser blandt vores brugere, dels fordi de er nemme at gå til fra parkeringen, dels fordi terrænet er kuperet nok til at man føler man er væk uden at køre langt. Vil du have mere stilhed, så kør de 30-40 minutter sydpå til Lille Vildmose — der er færre folk og man hører rørdrum og kraner i træktiden.",
    nearbyPois: ["Hammer Bakker", "Lindholm Høje", "Lille Vildmose", "Limfjorden"],
  },
  "Aarhus": {
    summary:
      "Aarhus har den fordel at du kan tage cyklen direkte fra centrum og være ved en shelter på under en time. Marselisborg Skovene er det åbenlyse valg — fladt, familievenligt, og du kan kombinere med en tur forbi dyrehaven. For en lidt vildere oplevelse: tag mod Mols Bjerge på Djursland (35 min med bil). Husk at Marselisborg-shelters er populære i juli og august, så book tidligt hvis du satser på den weekend.",
    nearbyPois: ["Marselisborg Skovene", "Risskov", "Brabrand Sø", "Mols Bjerge"],
  },
  "Billund": {
    summary:
      "Billund er en lidt overset base for shelterture i det midtjyske, men området er stærkt, hvis du vil kombinere hede, skov og rolige overnatningspladser. Her er det ofte nemt at finde ture, der passer godt til familier og korte overnatninger.",
    nearbyPois: ["Grindsted Plantage", "Sønder Omme", "Hejnsvig", "Vorbasse"],
  },
  "Esbjerg": {
    summary:
      "Esbjerg er især interessant for shelterture med vestkyst, fugleliv og store åbne landskaber. Området fungerer godt, hvis du vil have en blanding af skov, hede og kystoplevelser på korte afstande fra byen.",
    nearbyPois: ["Marbæk Plantage", "Vadehavet", "Sneum Digesø", "Ho Bugt"],
  },
  "Helsingør": {
    summary:
      "Helsingør er stærk til korte shelterture med både skov og kyst. Området passer godt til dagsture, familieture og overnatninger, hvor du vil være tæt på byens faciliteter men stadig hurtigt ude i grønne omgivelser.",
    nearbyPois: ["Teglstrup Hegn", "Hornbæk Plantage", "Esrum Sø", "Kronborg-området"],
  },
  "Herning": {
    summary:
      "Herning er et godt knudepunkt til shelterture i de midtjyske skove og søområder. Det er særligt et godt valg, hvis du vil have rolige pladser og mere natur end klassisk destinationsturisme.",
    nearbyPois: ["Lovbakkerne", "Søby Brunkulslejer", "Skarrildhus", "Skjern Å"],
  },
  "Holstebro": {
    summary:
      "Holstebro giver nem adgang til shelterture med ådale, plantager og mere åbne vestjyske landskaber. Det er et område, der især fungerer godt til rolige weekendture og ture med bil som base.",
    nearbyPois: ["Stråsø Plantage", "Nissum Fjord", "Storå", "Vedersø Klit"],
  },
  "Horsens": {
    summary:
      "Horsens er et godt udgangspunkt, hvis du vil kombinere fjord, skov og bakker på samme tur. Området har en god blanding af lettilgængelige shelters og lidt mere skjulte pladser omkring fjord og skov.",
    nearbyPois: ["Bygholm Sø", "Nørrestrand", "Sondrup Bakker", "Horsens Fjord"],
  },
  "Kolding": {
    summary:
      "Kolding fungerer godt til shelterture med skov, fjord og familievenlige naturoplevelser. Det er en stærk base, hvis du vil have korte transportafstande og mange forskellige typer natur inden for samme område.",
    nearbyPois: ["Marielundskoven", "Kolding Fjord", "Skamlingsbanken", "Stenderupskovene"],
  },
  "København": {
    summary:
      "Bor du i København og søger shelter, så glem byen selv — der er ingen rigtige shelter-pladser indenfor Ringvejene. Det nemmeste er Vestamager (15 min med metro + 10 min gang) hvor pladserne ligger ud mod havet og er bookbare. Dyrehaven nord for byen har klassikerne, men de fyldes meget hurtigt i højsæsonen. Hvis du har bil, så kør 45 min mod Roskilde — Boserup Skov er mindre crowdy og billigere at booke.",
    nearbyPois: ["Amager Fælled", "Vestamager", "Dyrehaven", "Amager Strandpark"],
  },
  "Næstved": {
    summary:
      "Næstved er et godt udgangspunkt til shelterture på Sydsjælland, især hvis du vil kombinere skov, sø og kystnær natur. Området fungerer godt til både førstegangsture og mere rolige weekendovernatninger.",
    nearbyPois: ["Gavnø", "Herlufsholm Skov", "Karrebæksminde", "Susåen"],
  },
  "Odense": {
    summary:
      "Odense's overraskelse er at de bedste shelters faktisk ligger ret tæt på — Stige Ø er kun 15 minutter nord for centrum og har naturlig kontakt til Odense Fjord. For en lidt længere tur kan vi anbefale Fyns Hoved nordpå (45 min med bil) hvor du sover næsten ude i Kattegat. Hvis du leder efter shelter med vand til hund og børn, så er Langesø den mest familievenlige af de tilgængelige pladser i området.",
    nearbyPois: ["Stige Ø", "Langesø", "Killerup Rende", "Fyns Hoved"],
  },
  "Randers": {
    summary:
      "Randers fungerer godt til shelterture, hvis du vil kombinere ådal, skov og fjordlandskab. Det er især et stærkt område til ture, hvor du gerne vil hurtigt ud i naturen uden lange transportstræk.",
    nearbyPois: ["Randers Fjord", "Gudenåen", "Fussingø", "Clausholm Skovene"],
  },
  "Roskilde": {
    summary:
      "Roskilde er et naturligt udgangspunkt for shelterture på Midtsjælland, hvor fjord, skov og åbne landskaber mødes. Området passer godt til både korte ture og mere planlagte weekendovernatninger.",
    nearbyPois: ["Boserup Skov", "Roskilde Fjord", "Bidstrup Skovene", "Lejre"],
  },
  "Silkeborg": {
    summary:
      "Silkeborg er nok den eneste danske by hvor du kan paddle, vandre og sove i shelter alt sammen på en weekend uden at flytte bil. Søhøjlandet er tæt pakket med pladser — flere af dem ligger direkte ned til Silkeborgsøerne så du kan ankomme i kano. Himmelbjerget-områdets shelters bookes hurtigt op i sommerferien; book et halvt år i forvejen hvis du vil sove der i juli. Foretrækker du roen, så tag de 20 minutter ud til Nordskoven — færre folk, samme natur.",
    nearbyPois: ["Silkeborgsøerne", "Nordskoven", "AQUA-området", "Himmelbjerget"],
  },
  "Svendborg": {
    summary:
      "Svendborg er stærk til shelterture med øhav, skov og kyst. Det er især et godt område, hvis du leder efter mere naturskønne ture med havudsigt, færgeforbindelser eller en rolig sydfynsk base.",
    nearbyPois: ["Svendborgsund", "Ollerup", "Egebjerg Bakker", "Det Sydfynske Øhav"],
  },
  "Vejle": {
    summary:
      "Vejle Ådal er årsagen til at folk overhovedet googler shelter her — det er en af Danmarks længste sammenhængende ådale, og der ligger pladser fordelt så du kan gå fra én til den næste over to-tre dage. Vores erfaring er at de første kilometer fra Vejle er pænt trafikerede, så hvis du vil have ro, så start ad det grønne spor fra Jelling og arbejd dig sydpå. Grejsdalen er stejlere og smukkere men har færre shelters — mest egnet til dagstur frem for overnatning.",
    nearbyPois: ["Vejle Ådal", "Nørreskoven", "Grejsdalen", "Vejle Fjord"],
  },
  "Viborg": {
    summary:
      "Viborg er et godt centrum for shelterture med store skove, heder og sølandskaber. Det er især et område, der fungerer godt, hvis du vil prioritere naturro og lidt større afstand til de mest travle destinationer.",
    nearbyPois: ["Hald Sø", "Undallslund", "Fusager Plantage", "Dollerup Bakker"],
  },
};

export function getCityEditorial(placeName: string): CityEditorial | null {
  return CITY_EDITORIAL[placeName] ?? null;
}
