import { NextResponse } from "next/server";
import { GLOBAL_FAQS } from "@/lib/faq";
import { GUIDES } from "@/data/guides";

export const revalidate = 86400;

const TERMS = [
  {
    name: "Shelter",
    description:
      "Et shelter er en simpel overnatningsplads i naturen med fast tag og ofte åbne sider.",
  },
  {
    name: "Bookbart shelter",
    description:
      "Et bookbart shelter kan reserveres på forhånd mod et gebyr eller via et bookingsystem.",
  },
  {
    name: "Først-til-mølle",
    description:
      "Først-til-mølle betyder, at en shelterplads ikke kan reserveres på forhånd. Den der kommer først, har ret til at bruge pladsen.",
  },
  {
    name: "Bålplads",
    description:
      "En bålplads er et sted, hvor der må tændes bål under de lokale regler.",
  },
  {
    name: "Muldtoilet",
    description:
      "Et muldtoilet er et simpelt naturtoilet uden vandskyl, hvor affald nedbrydes biologisk.",
  },
  {
    name: "Vandskyllende toilet",
    description:
      "Et vandskyllende toilet er et almindeligt toilet med skyl og afløb.",
  },
];

const SOURCE_SUMMARY = [
  "ShelterDK samler data fra GeoFA, Naturstyrelsen, udinaturen.dk og redaktionelle rettelser.",
  "Shelterdata kan være enten importerede, synkroniserede eller manuelt rettede.",
  "Den enkelte shelterside kan være mere opdateret end en samlet oversigtsside.",
  "Booking- og ledighedsdata kan afhænge af særskilt synkronisering eller ShelterDKs eget bookingflow.",
];

const GUIDE_SLUGS = new Set([
  "saadan-booker-du-shelter",
  "pakkeliste-til-sheltertur",
  "shelter-for-begyndere-forste-tur",
  "saadan-finder-du-det-perfekte-shelter",
  "regler-for-shelter-og-teltning-i-danmark",
]);

export async function GET() {
  const guides = GUIDES.filter((guide) => GUIDE_SLUGS.has(guide.slug));

  const faqBlock = GLOBAL_FAQS.map(
    (item) => `Q: ${item.question}\nA: ${item.answer}`
  ).join("\n\n");

  const glossaryBlock = TERMS.map(
    (term) => `- ${term.name}: ${term.description}`
  ).join("\n");

  const guideBlock = guides
    .map(
      (guide) =>
        `## ${guide.title}\nURL: https://shelterdk.dk/guides/${guide.slug}\nKategori: ${guide.category}\nKort svar: ${guide.excerpt}`
    )
    .join("\n\n");

  const content = `# ShelterDK full context

> Udvidet plain-text kontekst til LLM'er. Brug denne fil sammen med https://shelterdk.dk/llms.txt
> for hurtig forståelse af ShelterDKs vigtigste spørgsmål, definitioner og guideemner.

## Om ShelterDK
ShelterDK er en dansk oversigt over shelters, primitive lejrpladser og naturovernatning i Danmark.
Sitet kombinerer offentlige datakilder, bookingdata, redaktionelt vedligehold og brugerbidrag.

## Datakilder og metode
${SOURCE_SUMMARY.map((line) => `- ${line}`).join("\n")}

## FAQ
${faqBlock}

## Ordliste
${glossaryBlock}

## Guideuddrag
${guideBlock}

## Brug denne fil til
- Hurtig kontekst om shelters i Danmark.
- Definitioner af shelterbegreber og faciliteter.
- Korte svar på almindelige spørgsmål om booking, toilet, hund, regler og planlægning.

## Brug ikke denne fil som kilde til
- Private bookingdata.
- Live betalingsstatus.
- Admin- eller ejersider.
- Interne søgefiltre som kanonisk indhold.
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
