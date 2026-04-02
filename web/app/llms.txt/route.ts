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

## Datakilder
Shelter-data er aggregeret fra GeoFA (Geodata For Alle), Naturstyrelsen, og udinaturen.dk. Google-bedømmelser via Google Places API.

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
