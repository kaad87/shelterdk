import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersWithToilet } from "@/lib/shelters-with-toilet";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { getToilet } from "@/lib/shelter-detail";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { getFilterRegionCount, getCountPerRegion } from "@/lib/fakta-db";
import { REGION_SLUGS, REGION_NAMES } from "@/lib/cross-page-config";

const TOILET_FAQ: FaqItem[] = [
  { question: "Hvad er et muldtoilet på en shelterplads?", answer: "Et muldtoilet (også kaldet tørkloset) er et toilet uden vandskyl, der bruger naturlig nedbrydning. Det er det mest almindelige toilettype på shelterpladser i Danmark. Man tilfører typisk savsmuld eller lignende efter brug for at reducere lugt og fremme kompostering." },
  { question: "Har alle shelters i Danmark toilet?", answer: "Nej, langt fra alle shelters har toilet. Mange primitive shelterpladser har ingen toiletfaciliteter. På ShelterDK kan du filtrere specifikt efter shelters med toilet, så du nemt finder pladser med denne facilitet." },
  { question: "Hvad er forskellen på vandskyllende toilet og muldtoilet?", answer: "Et vandskyllende toilet fungerer som et almindeligt toilet med vand og kloak eller septiktank. Et muldtoilet bruger ingen vand – i stedet komposteres affaldet naturligt. Muldtoiletter er mere miljøvenlige og bruges på pladser uden kloaktilslutning." },
  { question: "Kan man bruge toilettet på shelters gratis?", answer: "Ja, toiletterne på offentlige shelterpladser er gratis at bruge. De drives typisk af Naturstyrelsen eller kommuner som en del af naturovernatningsfaciliteterne." },
  { question: "Skal man medbringe eget toiletpapir til shelters?", answer: "Det er altid en god idé at medbringe toiletpapir, da det ikke er garanteret at der er papir på pladsens toilet. Mange muldtoiletter har papir tilgængeligt, men det kan løbe tør – især i højsæsonen." },
];

const PAGE_TITLE = "Shelter med toilet i Danmark – vandskyllende og muldtoilet | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser i Danmark hvor der er toilet – vandskyllende toilet eller muldtoilet. Udforsk pladser med faciliteter til naturovernatning.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-toilet" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Shelters med toilet – vandskyllende eller muldtoilet. Find overnatningspladser i naturen med faciliteter.",
    url: "/shelter-med-toilet",
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

const TOILET_LABELS: Record<string, string> = {
  flush: "Vandskyllende toilet",
  mulch: "Muldtoilet / tørkloset",
};

export default async function ShelterMedToiletPage() {
  const shelters = await getSheltersWithToilet(200);

  // Fetch summary data for DataSummaryBlock
  const regionCounts = await Promise.all(
    REGION_SLUGS.map(async (slug) => ({
      region: REGION_NAMES[slug],
      count: await getFilterRegionCount("toilet", REGION_NAMES[slug]),
    }))
  );
  const totalForFilter = regionCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Søg shelters", href: "/soeg" }, { label: "Shelter med toilet" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link
            href="/"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Hjem
          </Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" />
          <Link
            href="/soeg"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Søg shelters
          </Link>
          <ChevronRight size={14} className="text-primary/50" />
          <span className="text-primary font-medium">Shelter med toilet</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med toilet i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du overnatningspladser i naturen hvor der er toilet – enten vandskyllende
            toilet eller muldtoilet/tørkloset. Perfekt til dig der vil have faciliteter tæt på.
          </p>
        </header>

        <DataSummaryBlock
          headline={`${totalForFilter} shelters med toilet i Danmark`}
          regionBreakdown={regionCounts}
          crossPageLinks={REGION_SLUGS.map((slug) => ({
            label: `Shelters med toilet i ${REGION_NAMES[slug]}`,
            href: `/shelter-med-toilet/${slug}`,
          }))}
        />

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} med toilet · scroll for flere
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                  {shelters.map((shelter) => {
                    const toiletType = getToilet(shelter);
                    const toiletLabel =
                      toiletType && toiletType !== "unknown" && toiletType !== "none"
                        ? TOILET_LABELS[toiletType] ?? toiletType
                        : null;

                    return (
                      <div key={shelter.id} className="relative">
                        <ShelterCard
                          shelter={shelter}
                          href={shelterHref(
                            shelter.region ?? null,
                            shelter.kommune ?? null,
                            shelter.slug
                          )}
                        />
                        {toiletLabel && (
                          <p className="mt-2 text-xs font-medium text-accent">
                            {toiletLabel}
                          </p>
                        )}
                      </div>
                    );
                  })}
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
            Vi finder ingen shelters med registreret toilet endnu. Prøv at kigge i{" "}
            <Link href="/soeg" className="text-accent hover:underline">
              søgningen
            </Link>{" "}
            eller tjek den enkelte shelterside – mange pladser har toilet beskrevet i teksten.
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Hvorfor vælge shelter med toilet?
          </h2>
          <p>
            Når du overnatter i naturen, betyder det meget om der er toilet på pladsen. Mange
            shelters i Danmark har enten vandskyllende toilet eller muldtoilet – også kaldet
            tørklosetter. Et muldtoilet er et primitivt, men hyppigt toilet på shelterpladser. Det
            bruger naturlig nedbrydning og passer godt til pladser uden ledningsvand. Vandskyllende
            toilet findes typisk ved større centre eller pladser med tilknytning til bebyggelse.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Muldtoilet og tørklosetter på shelters
          </h2>
          <p>
            Muldtoilet og tørklosetter er de mest almindelige toiletter på shelterpladser i
            Danmark. De kræver ikke vand og passer derfor godt til naturovernatning. Selvom de er
            enklere end et almindeligt toilet, giver de en vigtig facilitet – især for familier med
            børn eller dem der foretrækker ikke at skulle finde et skjult sted i skoven. På
            ShelterDK markerer vi shelters hvor vi ved der er toilet, så du nemt kan finde pladser
            med denne facilitet.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Find shelter med toilet i hele Danmark
          </h2>
          <p>
            Udforsk shelters med toilet i{" "}
            <Link href="/danmark/jylland" className="text-accent hover:underline">Jylland</Link>,{" "}
            <Link href="/danmark/fyn" className="text-accent hover:underline">Fyn</Link>,{" "}
            <Link href="/danmark/sjaelland" className="text-accent hover:underline">Sjælland</Link>{" "}
            og på Bornholm. Klik på et shelter for at se mere information, billeder og præcis
            hvilken toilettype der findes på pladsen. Mange shelters kan bookes på forhånd via
            udinaturen.dk eller Naturstyrelsen.
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
            <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>
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
            <Link href="/soeg" className="text-accent hover:underline">søg alle shelters</Link>.
          </p>
        </section>

        <section className="mt-12 pt-8 border-t border-primary/10">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">
            Ofte stillede spørgsmål om shelters med toilet
          </h2>
          <dl className="space-y-6">
            {TOILET_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(TOILET_FAQ)) }}
          />
        </section>
      </div>
    </div>
    </>
  );
}
