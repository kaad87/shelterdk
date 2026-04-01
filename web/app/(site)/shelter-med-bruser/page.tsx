import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersWithShower } from "@/lib/shelters-with-shower";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { getFilterRegionCount, getCountPerRegion } from "@/lib/fakta-db";
import { REGION_SLUGS, REGION_NAMES } from "@/lib/cross-page-config";

const SHOWER_FAQ: FaqItem[] = [
  { question: "Har shelters i Danmark bruser?", answer: "Nogle shelterpladser i Danmark har adgang til bruser eller badefaciliteter. Det er dog langt fra alle — de fleste primitive shelterpladser har ikke bruser. På ShelterDK kan du filtrere efter shelters med bruser/bad for at finde pladser med denne facilitet." },
  { question: "Er brusere på shelterpladser gratis?", answer: "På de fleste offentlige shelterpladser med bruser er faciliteten gratis at bruge. Nogle pladser tilknyttet campingpladser eller friluftsgårde kan dog kræve et mindre beløb." },
  { question: "Hvad er alternativet hvis shelteren ikke har bruser?", answer: "Mange shelterfolk vasker sig i søer, åer eller havet. Du kan også medbringe en solbruser (en sort vandbeholder der varmes af solen) eller biodieselbare vådservietter. Husk at bruge biologisk nedbrydelig sæbe hvis du vasker dig i naturen." },
  { question: "Hvilke shelters har de bedste badefaciliteter?", answer: "Shelters tilknyttet friluftsgårde, naturcentre eller campingpladser har typisk de bedste badefaciliteter. Pladser ved Naturstyrelsen har sjældent bruser, men kan have andre faciliteter som toilet og drikkevand." },
];

const PAGE_TITLE = "Shelter med bruser i Danmark – overnatning med badefaciliteter | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser i Danmark med bruser og badefaciliteter. Perfekt til længere shelterture eller familier der vil have lidt ekstra komfort.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-bruser" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Shelters med bruser og bad i Danmark. Find overnatningspladser i naturen med badefaciliteter.",
    url: "/shelter-med-bruser",
  },
};

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  const regionSlug = slugifySegment(r);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${m}/${slug}`;
}

export default async function ShelterMedBruserPage() {
  const shelters = await getSheltersWithShower(200);

  // Fetch summary data for DataSummaryBlock
  const regionCounts = await Promise.all(
    REGION_SLUGS.map(async (slug) => ({
      region: REGION_NAMES[slug],
      count: await getFilterRegionCount("bruser", REGION_NAMES[slug]),
    }))
  );
  const totalForFilter = regionCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Søg shelters", href: "/soeg" }, { label: "Shelter med bruser" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">Hjem</Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" />
          <Link href="/soeg" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">Søg shelters</Link>
          <ChevronRight size={14} className="text-primary/50" />
          <span className="text-primary font-medium">Shelter med bruser</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med bruser i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du shelters og overnatningspladser med bruser eller badefaciliteter.
            Perfekt til længere ture eller familier der vil have lidt ekstra komfort i naturen.
          </p>
        </header>

        <DataSummaryBlock
          headline={`${totalForFilter} shelters med bruser i Danmark`}
          regionBreakdown={regionCounts}
          crossPageLinks={REGION_SLUGS.map((slug) => ({
            label: `Shelters med bruser i ${REGION_NAMES[slug]}`,
            href: `/shelter-med-bruser/${slug}`,
          }))}
        />

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} med bruser · scroll for flere
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                  {shelters.map((shelter) => (
                    <ShelterCard
                      key={shelter.id}
                      shelter={shelter}
                      href={shelterHref(shelter.region ?? null, shelter.kommune ?? null, shelter.slug)}
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
            Vi finder ingen shelters med bruser endnu. Prøv at kigge i{" "}
            <Link href="/soeg" className="text-accent hover:underline">søgningen</Link>{" "}
            med Bruser/bad-filteret aktiveret.
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Hvorfor vælge shelter med bruser?
          </h2>
          <p>
            På en flerdag sheltertur gør adgang til bruser en stor forskel. Det giver dig
            mulighed for at vaske støv og sved af efter en lang vandredag og starte næste
            dag frisk. For familier med børn kan en bruser være forskellen på en god og en
            fantastisk tur.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Hvad kan du forvente?
          </h2>
          <p>
            Badefaciliteterne på shelterpladser varierer meget. Nogle pladser har moderne
            brusekabiner med varmt vand, mens andre har enklere udendørsbrusere. Pladser
            tilknyttet friluftsgårde og naturcentre har typisk de bedste faciliteter. Tjek
            den enkelte shelterside her på ShelterDK for detaljer om faciliteterne.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Planlæg din sheltertur med bruser
          </h2>
          <p>
            Kombiner komfort med natur ved at vælge en plads med bruser. Se vores{" "}
            <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">pakkeliste til sheltertur</Link>{" "}
            for tips til hvad du skal medbringe. Overvej at{" "}
            <Link href="/shelter-booking" className="text-accent hover:underline">booke dit shelter</Link>{" "}
            på forhånd — pladser med gode faciliteter er populære.
          </p>

          <p>
            Se også:{" "}
            <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>
            {" · "}
            <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>
            {" · "}
            <Link href="/shelter-med-strand" className="text-accent hover:underline">shelter ved stranden</Link>
            {" · "}
            <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>
            {" · "}
            <Link href="/shelter-med-hund" className="text-accent hover:underline">hundevenlige shelters</Link>
            {" · "}
            <Link href="/soeg" className="text-accent hover:underline">søg alle shelters</Link>
            .
          </p>
        </section>

        <section className="mt-12 pt-8 border-t border-primary/10">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">
            Ofte stillede spørgsmål om shelters med bruser
          </h2>
          <dl className="space-y-6">
            {SHOWER_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(SHOWER_FAQ)) }}
          />
        </section>
      </div>
    </div>
    </>
  );
}
