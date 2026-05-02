import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersWithWater } from "@/lib/shelters-with-water";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { getFilterRegionCount, getCountPerRegion } from "@/lib/fakta-db";
import { REGION_SLUGS, REGION_NAMES, REGION_SHORT_NAMES } from "@/lib/cross-page-config";

const VAND_FAQ: FaqItem[] = [
  { question: "Er vandet på shelterpladser drikkevand?", answer: "Det varierer fra plads til plads. Nogle shelterpladser har vandhaner med godkendt drikkevand, mens andre kun har vand til opvask. Tjek altid lokal skiltning ved vandhanen, og medtag drikkevand som backup hvis du er i tvivl." },
  { question: "Skal man medbringe eget vand til sheltertur?", answer: "Det er altid en god idé at medbringe vand til din sheltertur, selv hvis pladsen har vandhane. Vandhaner kan være lukket om vinteren, eller vandtrykket kan være lavt. Vi anbefaler minimum 2 liter per person per dag." },
  { question: "Har alle shelters i Danmark vand?", answer: "Nej, mange primitive shelterpladser har ingen vandforsyning. Pladser med vand er typisk dem der drives af Naturstyrelsen eller kommuner med et vist service-niveau. På ShelterDK kan du filtrere specifikt efter shelters med vand." },
  { question: "Kan man drikke vand fra søer og åer ved shelters?", answer: "Vi fraråder at drikke ubehandlet vand fra søer og åer i Danmark. Selvom vandet kan se rent ud, kan det indeholde bakterier og parasitter. Medbring altid drikkevand eller et vandfilter/rensetabletter." },
  { question: "Er der vand tilgængeligt hele året på shelterpladser?", answer: "Mange vandhaner på shelterpladser lukkes om vinteren for at undgå frostskader, typisk fra november til marts. Planlæg med ekstra medbragt vand hvis du overvejer en vintertur." },
];

const PAGE_TITLE = "Shelter med vand i Danmark – drikkevand og vandhane | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser i Danmark hvor der er vand – vandhane eller drikkevand. Udforsk pladser med adgang til vand til naturovernatning.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-vand" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Shelters med vand – vandhane eller drikkevand. Find overnatningspladser i naturen med adgang til vand.",
    url: "/shelter-med-vand",
  },
};

function shelterHref(
  region: string | null,
  kommune: string | null,
  slug: string
): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") {
    return `/shelter/${slug}`;
  }
  const regionSlug = slugifySegment(r);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${m}/${slug}`;
}

export default async function ShelterMedVandPage() {
  const shelters = await getSheltersWithWater(50);

  // Fetch summary data for DataSummaryBlock
  const regionCounts = await Promise.all(
    REGION_SLUGS.map(async (slug) => ({
      region: REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug],
      count: await getFilterRegionCount("vand", REGION_NAMES[slug]),
    }))
  );
  const totalForFilter = regionCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Shelter med vand" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link
            href="/"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Hjem
          </Link>
          <span className="text-primary font-medium">Shelter med vand</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med vand i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du overnatningspladser i naturen hvor der er vand – enten vandhane eller
            adgang til drikkevand. Perfekt til dig der vil have vand tæt på uden at medbringe alt.
          </p>
        </header>

        <DataSummaryBlock
          headline={`${totalForFilter} shelters med vand i Danmark`}
          regionBreakdown={regionCounts}
          crossPageLinks={REGION_SLUGS.map((slug) => ({
            label: `Shelters med vand i ${REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug]}`,
            href: `/shelter-med-vand/${slug}`,
          }))}
        />

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} med vand · scroll for flere
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
            Vi finder ingen shelters med registreret vand endnu. Prøv i stedet at udforske{" "}
            <Link href="/danmark" className="text-accent hover:underline">
              shelters i Danmark
            </Link>{" "}
            eller tjek den enkelte shelterside – mange pladser har vand beskrevet i teksten.
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Hvorfor vælge shelter med vand?
          </h2>
          <p>
            Adgang til vand gør shelterovernatning nemmere – til madlavning, opvask og drikkevand.
            Mange shelters i Danmark har vandhane eller anden adgang til vand registreret i
            GeoFA og Naturstyrelsens data. På pladser uden vand skal du medbringe alt vand eller
            have mulighed for at hente det i nærheden. Her finder du shelters hvor vi ved der er
            vand på eller tæt ved pladsen.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Vandhane og drikkevand på shelterpladser
          </h2>
          <p>
            Vand på shelterpladser kan være en vandhane ved toilet eller ved et servicehus, eller
            det kan være drikkevand fra en pumpe eller kran. Tjek altid på den enkelte plads om
            vandet er drikkbart – nogle steder er det kun til opvask. På ShelterDK viser vi
            pladser hvor vand er angivet i de offentlige datakilder, så du nemt kan finde
            shelters med denne facilitet.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Find shelter med vand i hele Danmark
          </h2>
          <p>
            Udforsk shelters med vand i{" "}
            <Link href="/danmark/jylland" className="text-accent hover:underline">Jylland</Link>,{" "}
            <Link href="/danmark/fyn" className="text-accent hover:underline">Fyn</Link>,{" "}
            <Link href="/danmark/sjaelland" className="text-accent hover:underline">Sjælland</Link>{" "}
            og på Bornholm. Klik på et shelter for at se mere information og præcis hvad der
            findes på pladsen. Mange shelters kan bookes på forhånd via udinaturen.dk eller
            Naturstyrelsen.
          </p>

          <p>
            Se også:{" "}
            <Link href="/shelter-til-familier" className="text-accent hover:underline">shelter til familier</Link>
            {" · "}
            <Link href="/shelter-til-cykeltur" className="text-accent hover:underline">shelter til cykeltur</Link>
            {" · "}
            <Link href="/shelter-naer-vand" className="text-accent hover:underline">shelter nær vand</Link>
            {" · "}
            <Link href="/handicapvenlige-shelters" className="text-accent hover:underline">handicapvenlige shelters</Link>
            {" · "}
            <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>
            {" · "}
            <Link href="/shelter-med-hund" className="text-accent hover:underline">hundevenlige shelters</Link>
            {" · "}
            <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>
            {" · "}
            <Link href="/shelter-med-strand" className="text-accent hover:underline">shelter ved stranden</Link>
            {" · "}
            <Link href="/shelter-med-bruser" className="text-accent hover:underline">shelter med bruser</Link>
            {" · "}
            <Link href="/shelter-booking" className="text-accent hover:underline">book shelter</Link>
            {" · "}
            <Link href="/danmark" className="text-accent hover:underline">udforsk alle shelters i Danmark
            </Link>
            .
          </p>
        </section>

        <section className="mt-12 pt-8 border-t border-primary/10">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">
            Ofte stillede spørgsmål om shelters med vand
          </h2>
          <dl className="space-y-6">
            {VAND_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(VAND_FAQ)) }}
          />
        </section>
      </div>
    </div>
    </>
  );
}
