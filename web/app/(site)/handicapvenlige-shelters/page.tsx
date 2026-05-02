import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getHandicapShelters, getFilterRegionCount } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { REGION_SLUGS, REGION_NAMES, REGION_SHORT_NAMES } from "@/lib/cross-page-config";

export const revalidate = 86400;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Er shelters i Danmark handicapvenlige?",
    answer:
      "Nogle shelters er registreret som handicapegnede eller delvist handicapegnede. Det betyder typisk, at der er tilkørselsforhold, fast belægning og eventuelt tilpassede faciliteter. På ShelterDK kan du filtrere specifikt efter handicapvenlige shelters.",
  },
  {
    question: "Hvad betyder 'delvist handicapegnet'?",
    answer:
      "Delvist handicapegnet betyder, at nogle faciliteter er tilgængelige (f.eks. tilkørsel og parkering), men at selve shelteren eller stien dertil kan have begrænsninger som ujævnt underlag, trapper eller smalle stier.",
  },
  {
    question: "Har handicapvenlige shelters toilet?",
    answer:
      "Ikke nødvendigvis. Handicapegnet refererer til fysisk tilgængelighed – tilkørsel, belægning og plads. Toiletfaciliteter varierer. Brug vores søgning til at kombinere filteret med 'toilet' for at finde shelters med begge dele.",
  },
  {
    question: "Kan man køre helt hen til handicapvenlige shelters?",
    answer:
      "Mange handicapegnede shelters har parkeringsplads i nærheden og fast belægning på stien til shelteren. Tjek den enkelte shelterside for præcis tilgængelighedsbeskrivelse.",
  },
  {
    question: "Hvor finder man information om tilgængelighed for det enkelte shelter?",
    answer:
      "På hver shelterside på ShelterDK vises tilgængelighedsoplysninger under 'Tilgængelighed', når disse data er tilgængelige fra de offentlige registre. Her kan du læse om belægning, adgangsforhold og eventuelle begrænsninger.",
  },
];

const PAGE_TITLE =
  "Handicapvenlige shelters i Danmark | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find handicapvenlige og tilgængelige shelters i Danmark. Se alle shelters der er registreret som handicapegnede eller delvist handicapegnede.",
  alternates: { canonical: "https://shelterdk.dk/handicapvenlige-shelters" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Handicapvenlige shelters i Danmark – find tilgængelige overnatningspladser i naturen.",
    url: "/handicapvenlige-shelters",
  },
};

function shelterHref(
  region: string | null,
  kommune: string | null,
  slug: string
): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  return `/danmark/${slugifySegment(r)}/${kommune ? slugifySegment(kommune) : "ukendt-kommune"}/${slug}`;
}

export default async function HandicapvenligeSheltersPage() {
  const shelters = await getHandicapShelters(50);

  const regionCounts = await Promise.all(
    REGION_SLUGS.map(async (slug) => ({
      region: REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug],
      count: await getFilterRegionCount("handicap", REGION_NAMES[slug]),
    }))
  );
  const totalForFilter = regionCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Handicapvenlige shelters" },
        ]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link
              href="/"
              className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
            >
              Hjem
            </Link>
            <span className="text-primary font-medium">Handicapvenlige shelters</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
              Handicapvenlige shelters i Danmark
            </h1>
            <p className="text-primary/80 text-lg">
              Find shelters og overnatningspladser i naturen med tilgængelighed for
              kørestolsbrugere og personer med nedsat mobilitet.
            </p>
          </header>

          <DataSummaryBlock
            headline={`${totalForFilter} handicapvenlige shelters i Danmark`}
            regionBreakdown={regionCounts}
            crossPageLinks={REGION_SLUGS.map((slug) => ({
              label: `Handicapvenlige shelters i ${REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug]}`,
              href: `/handicapvenlige-shelters/${slug}`,
            }))}
          />

          {shelters.length > 0 ? (
            <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
                <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                  <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                    {shelters.length} handicapvenlig{shelters.length !== 1 ? "e shelters" : "t shelter"} · scroll for flere
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                    {shelters.map((shelter) => (
                      <ShelterCard
                        key={shelter.id}
                        shelter={shelter}
                        href={shelterHref(
                          shelter.region ?? null,
                          shelter.kommune ?? null,
                          shelter.slug
                        )}
                      />
                    ))}
                  </div>
                </div>
                <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-6 lg:mb-0 mx-4 sm:mx-6 lg:mx-0">
                  <ShelterMap shelters={shelters} className="w-full h-full" />
                </div>
              </div>
            </section>
          ) : null}

          {shelters.length === 0 && (
            <p className="text-primary/70 py-8">
              Vi finder ingen shelters med registreret handicaptilgængelighed endnu. Tjek den
              enkelte shelterside for tilgængelighedsoplysninger, eller{" "}
              <Link href="/danmark" className="text-accent hover:underline">
                udforsk shelters i Danmark
              </Link>
              .
            </p>
          )}

          <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
            <h2 className="font-serif text-xl font-bold text-primary">
              Tilgængelig naturovernatning
            </h2>
            <p>
              Naturen skal være for alle. Flere og flere shelters i Danmark er bygget
              eller tilpasset, så de er tilgængelige for kørestolsbrugere og personer med
              nedsat mobilitet. Det kan betyde fast belægning på stien til shelteren,
              bred adgang, niveaufri indgang eller tilpassede toilet- og parkeringsforhold.
            </p>

            <h2 className="font-serif text-xl font-bold text-primary">
              Hvad kan du forvente?
            </h2>
            <p>
              Tilgængeligheden varierer fra sted til sted. Nogle shelters er fuldt handicapegnede
              med rampe, fast underlag og handicaptoilet, mens andre er delvist tilgængelige –
              f.eks. med god tilkørsel men ujævnt underlag de sidste meter. Vi anbefaler altid
              at tjekke den specifikke shelterside for detaljerede tilgængelighedsoplysninger
              under afsnittet &quot;Tilgængelighed&quot;.
            </p>

            <h2 className="font-serif text-xl font-bold text-primary">
              Find det rette shelter
            </h2>
            <p>
              Udforsk handicapvenlige shelters i{" "}
              <Link href="/handicapvenlige-shelters/jylland" className="text-accent hover:underline">Jylland</Link>,{" "}
              <Link href="/handicapvenlige-shelters/sjaelland" className="text-accent hover:underline">Sjælland</Link>,{" "}
              <Link href="/handicapvenlige-shelters/fyn" className="text-accent hover:underline">Fyn</Link>{" "}
              og{" "}
              <Link href="/handicapvenlige-shelters/bornholm" className="text-accent hover:underline">Bornholm</Link>.
              Brug region- og fasilitetssiderne her på ShelterDK til at finde shelters med
              både handicaptilgængelighed og andre praktiske faciliteter som toilet eller vand.
            </p>

            <p>
              Se også:{" "}
              <Link href="/shelter-til-familier" className="text-accent hover:underline">shelter til familier</Link>
              {" · "}
              <Link href="/shelter-til-cykeltur" className="text-accent hover:underline">shelter til cykeltur</Link>
              {" · "}
              <Link href="/shelter-naer-vand" className="text-accent hover:underline">shelter nær vand</Link>
              {" · "}
              <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>
              {" · "}
              <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>
              {" · "}
              <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>
              {" · "}
              <Link href="/shelter-med-hund" className="text-accent hover:underline">hundevenlige shelters</Link>
              {" · "}
              <Link href="/shelter-booking" className="text-accent hover:underline">book shelter</Link>
              {" · "}
              <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">pakkeliste</Link>
              {" · "}
              <Link href="/danmark" className="text-accent hover:underline">udforsk alle shelters i Danmark</Link>.
            </p>
          </section>

          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål om handicapvenlige shelters
            </h2>
            <dl className="space-y-6">
              {FAQ_ITEMS.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(FAQ_ITEMS)) }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
