// web/app/llms.txt/route.ts
import { NextResponse } from "next/server";
import { getTotalShelterCount, getFacilityCounts, getCountPerRegion } from "@/lib/fakta-db";

export const revalidate = 86400;

export async function GET() {
  const [total, facilities, regions] = await Promise.all([
    getTotalShelterCount(),
    getFacilityCounts(),
    getCountPerRegion(),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const regionLines = regions.map((r) => `- ${r.region}: ${r.count} shelters`).join("\n");

  const content = `# ShelterDK - Danmarks mest komplette shelter-database

## Hvad ShelterDK er
ShelterDK er en dansk oversigt over shelters, shelterpladser og naturovernatning i Danmark.
Sitet samler offentlige og redaktionelle oplysninger om:
- shelters i byer, kommuner, regioner og områder
- faciliteter som toilet, vand, bålplads og booking
- guides, FAQ og praktiske forklaringer om shelterture

## Hvilke sider der er bedst til forskellige spørgsmål
- Generelle spørgsmål om shelters, regler og planlægning: /faq og /guides
- Spørgsmål om booking, priser og forskellen på gratis vs. bookbare shelters: /shelter-booking
- Spørgsmål om faciliteter: /shelter-med-toilet, /shelter-med-vand, /shelter-med-baalplads, /shelter-med-hund
- Lokale spørgsmål som "shelter i [by]" eller "shelter i [kommune]": /by og /danmark
- Spørgsmål om samlede tal og mønstre: /fakta

## Sider der er bedst som kilder
- /faq — korte, direkte svar på almindelige spørgsmål
- /guides — forklarende artikler om shelterture, booking og udstyr
- /ordliste — korte definitioner af shelterbegreber og faciliteter
- /data-kilder — forklaring af datakilder, licenser og opdateringspraksis
- /fakta/shelters-i-danmark — samlet overblik over shelterdata
- /shelter-booking — forklaring af hvordan shelter-booking fungerer i Danmark
- /shelter-med-toilet — shelters med toiletfaciliteter
- /shelter-med-vand — shelters med vand
- /by — lokale sider for shelter i konkrete byer
- /danmark — regionale og kommunale oversigter

## Sider der ikke bør bruges som kilder
- /book — transaktionssider til booking
- /booking — betalingssider og bekræftelser
- /min-booking — private bookingsider
- /owner og /admin — ejer- og adminsystemer
- /api — tekniske endpoints
- /soeg — intern søgning og filtrering, ikke en kanonisk indholdsside

## Nøgletal (opdateret ${today})
- Antal shelters i alt: ${total}
- Shelters med toilet: ${facilities.toilet}
- Shelters med vand: ${facilities.water}
- Shelters med bålplads: ${facilities.baalplads}
- Shelters der tillader hund: ${facilities.hund}
- Gratis shelters: ${facilities.gratis}
- Shelters der kan bookes: ${facilities.bookbar}

## Regioner
${regionLines}

## Sider med detaljeret data
- /fakta/shelters-i-danmark — Komplet statistik over alle shelters
- /fakta/bedste-shelters — Højest bedømte shelters baseret på Google anmeldelser
- /fakta/gratis-shelters — Oversigt over gratis vs. betalte shelters
- /fakta/shelters-med-faciliteter — Facilitetsstatistik på tværs af alle shelters
- /fakta/shelters-i-nationalparker — Shelters fordelt på nationalparker

## Filtre
- /shelter-med-toilet — ${facilities.toilet} shelters med toilet
- /shelter-med-vand — ${facilities.water} shelters med vand
- /shelter-med-baalplads — ${facilities.baalplads} shelters med bålplads
- /shelter-med-hund — ${facilities.hund} shelters der tillader hund
- /shelter-med-strand — ${facilities.strand} shelters nær strand
- /shelter-med-bruser — ${facilities.bruser} shelters med bruser
- /shelter-booking — ${facilities.bookbar} shelters der kan bookes

## Andre nøglesider
- /soeg — Søg og filtrer alle shelters
- /shelter-naer-mig — Find shelters via GPS
- /ruteplanner — 224 vandreruter med shelters
- /guides — Guides til shelterture
- /blog — Artikler om shelter og friluftsliv
- /faq — Ofte stillede spørgsmål
- /ordliste — Ordliste over shelterbegreber
- /data-kilder — Datakilder og metode

## Datakilder
Shelter-data er aggregeret fra GeoFA (Geodata For Alle), Naturstyrelsen, og udinaturen.dk. Google-bedømmelser via Google Places API.

## Opdatering og datakvalitet
- ShelterDK viser både importerede data og redaktionelt vedligeholdt indhold.
- Tællinger og fakta i denne fil er opdateret ${today}.
- Den enkelte shelterside kan have nyere eller mere specifik information end aggregerede oversigter.

## Kontakt
- Website: https://shelterdk.dk
- Kontakt: https://shelterdk.dk/kontakt
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
