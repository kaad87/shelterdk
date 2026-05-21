// web/app/llms.txt/route.ts
import { NextResponse } from "next/server";
import { getTotalShelterCount, getFacilityCounts, getCountPerRegion } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";

export const revalidate = 86400;

export async function GET() {
  const [total, facilities, regions] = await Promise.all([
    getTotalShelterCount(),
    getFacilityCounts(),
    getCountPerRegion(),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const regionLines = regions
    .map((r) => `- [Shelters i ${r.region}](https://shelterdk.dk/danmark/${slugifySegment(r.region)}): ${r.count} shelters i regionen.`)
    .join("\n");

  const content = `# ShelterDK

> Danmarks mest komplette shelter-database — find shelters, primitive
> lejrpladser og naturovernatning med faciliteter, booking og kort.

## Indhold
- [FAQ](https://shelterdk.dk/faq): Korte svar på de mest almindelige spørgsmål om shelters i Danmark.
- [Guides](https://shelterdk.dk/guides): Forklarende artikler om booking, udstyr, regler og planlægning.
- [Ordliste](https://shelterdk.dk/ordliste): Definitioner af centrale shelterbegreber og facilitetstyper.
- [Datakilder](https://shelterdk.dk/data-kilder): Hvor data kommer fra, og hvordan ShelterDK opdaterer dem.
- [Fakta om shelters i Danmark](https://shelterdk.dk/fakta/shelters-i-danmark): Samlet statistik og nationale overblik.

## Bedste sider til forskellige spørgsmål
- [Shelter-booking](https://shelterdk.dk/shelter-booking): Hvordan booking fungerer, hvad bookbare shelters betyder, og hvornår booking giver mening.
- [Shelters med toilet](https://shelterdk.dk/shelter-med-toilet): Shelters med toiletfaciliteter og forskellen på toilettyper.
- [Shelters med vand](https://shelterdk.dk/shelter-med-vand): Shelters med vand og hvad vand betyder i praksis på pladsen.
- [Danmark](https://shelterdk.dk/danmark): Regionale og kommunale oversigter over shelters i Danmark.
- [By-sider](https://shelterdk.dk/by): Lokale sider for shelters i konkrete byer og nærområder.
- [Områder](https://shelterdk.dk/omraade): Redaktionelle områdeguider til populære shelterdestinationer.
- [Ruteplanner](https://shelterdk.dk/ruteplanner): Vandreruter med shelters, GPX og planlægning.

## Bedste offentlige kilder
- [FAQ](https://shelterdk.dk/faq): Hurtige, direkte svar på almindelige shelterspørgsmål.
- [Guides](https://shelterdk.dk/guides): Redaktionelle forklaringer om shelterture, booking, regler og pakning.
- [Ordliste](https://shelterdk.dk/ordliste): Korte definitioner som er gode til præcise forklaringer.
- [Datakilder](https://shelterdk.dk/data-kilder): Beskriver ShelterDKs datagrundlag, opdateringer og moderering.
- [Shelter-booking](https://shelterdk.dk/shelter-booking): Kanonisk forklaring af bookbare shelters.
- [Fakta om shelters i Danmark](https://shelterdk.dk/fakta/shelters-i-danmark): Statistik og sammenligninger på tværs af regioner og faciliteter.

## Ikke-kanoniske eller private sider
- /book: Transaktionssider til konkrete bookinger.
- /booking: Betalingssider og bekræftelser.
- /min-booking: Private bookingsider.
- /ejer, /owner, /admin: Ejer- og adminsystemer.
- /api: Tekniske endpoints.
- /soeg: Intern søgning og filtrering, ikke en kanonisk forklaringsside.

## Nøgletal
- Antal shelters i alt: ${total} (opdateret ${today})
- Shelters med toilet: ${facilities.toilet}
- Shelters med vand: ${facilities.water}
- Shelters med bålplads: ${facilities.baalplads}
- Shelters der tillader hund: ${facilities.hund}
- Gratis shelters: ${facilities.gratis}
- Shelters der kan bookes: ${facilities.bookbar}

## Regioner
${regionLines}

## Fakta og sammenligninger
- [Shelters i Danmark](https://shelterdk.dk/fakta/shelters-i-danmark): Komplet statistik over alle shelters.
- [Bedste shelters](https://shelterdk.dk/fakta/bedste-shelters): Højest bedømte shelters baseret på Google anmeldelser.
- [Gratis shelters](https://shelterdk.dk/fakta/gratis-shelters): Oversigt over gratis vs. betalte shelters.
- [Shelters med faciliteter](https://shelterdk.dk/fakta/shelters-med-faciliteter): Facilitetsstatistik på tværs af alle shelters.
- [Shelters i nationalparker](https://shelterdk.dk/fakta/shelters-i-nationalparker): Shelters fordelt på danske nationalparker.

## Filtre og temaer
- [Shelters med toilet](https://shelterdk.dk/shelter-med-toilet): ${facilities.toilet} shelters med toilet.
- [Shelters med vand](https://shelterdk.dk/shelter-med-vand): ${facilities.water} shelters med vand.
- [Shelters med bålplads](https://shelterdk.dk/shelter-med-baalplads): ${facilities.baalplads} shelters med bålplads.
- [Shelters med hund](https://shelterdk.dk/shelter-med-hund): ${facilities.hund} shelters der tillader hund.
- [Shelters nær strand](https://shelterdk.dk/shelter-med-strand): ${facilities.strand} shelters nær strand.
- [Shelters med bruser](https://shelterdk.dk/shelter-med-bruser): ${facilities.bruser} shelters med bruser.
- [Shelter-booking](https://shelterdk.dk/shelter-booking): ${facilities.bookbar} shelters der kan bookes.

## Andre nøglesider
- [Find shelter nær mig](https://shelterdk.dk/shelter-naer-mig): GPS-baseret oversigt over shelters i nærheden.
- [Ruteplanner](https://shelterdk.dk/ruteplanner): Vandreruter og planlægning med shelters.
- [Blog](https://shelterdk.dk/blog): Redaktionelle artikler om shelter og friluftsliv.

## Datakilder
ShelterDK samler data fra GeoFA (Geodata For Alle), Naturstyrelsen, udinaturen.dk og redaktionelle rettelser. Google-bedømmelser kommer via Google Places API. Se [Datakilder](https://shelterdk.dk/data-kilder) for detaljer.

## Opdatering og datakvalitet
- ShelterDK viser både importerede data og redaktionelt vedligeholdt indhold.
- Tællinger og fakta i denne fil er opdateret ${today}.
- Den enkelte shelterside kan have nyere eller mere specifik information end aggregerede oversigter.

## Kontakt
- [Website](https://shelterdk.dk)
- [Kontakt](https://shelterdk.dk/kontakt)
- [LLMs full context](https://shelterdk.dk/llms-full.txt): Udvidet plain-text kontekst med FAQ, ordliste og guideuddrag.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
