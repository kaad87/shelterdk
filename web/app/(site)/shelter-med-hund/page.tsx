import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersWithPets } from "@/lib/shelters-with-pets";
import { slugifySegment } from "@/lib/slug";
import { Fragment } from "react";
import { ShelterCard } from "@/components/ShelterCard";
import { AdInFeed } from "@/components/AdInFeed";
import { showInFeedAdAt } from "@/lib/adsense";
import { ShelterMap } from "@/components/ShelterMap";
import { toMapShelters } from "@/lib/map-shelter";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { getFilterRegionCount, getCountPerRegion } from "@/lib/fakta-db";
import { REGION_SLUGS, REGION_NAMES, REGION_SHORT_NAMES } from "@/lib/cross-page-config";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

const HUND_FAQ: FaqItem[] = [
  { question: "Skal hunden være i snor på shelterpladser?", answer: "Ja, i perioden 1. april til 30. september skal hunde altid føres i snor i danske skove og naturområder – også på shelterpladser. Resten af året må hunde gå løse hvis de er under fuld kontrol, men tjek altid lokal skiltning." },
  { question: "Er alle shelters i Danmark hundevenlige?", answer: "Nej, ikke alle shelters tillader hunde. Nogle pladser ligger i områder med særlige hensyn til vildt eller fugleliv. På ShelterDK kan du filtrere efter hundevenlige shelters, så du kun ser pladser hvor hunde er velkomne." },
  { question: "Kan hunden sove i shelteren?", answer: "På de fleste hundevenlige shelterpladser er det tilladt at have hunden med i selve shelteren. Vis hensyn til andre gæster og sørg for at hunden ikke er til gene. Medbring hundens egen soveunderlag." },
  { question: "Hvad skal jeg medbringe til hunden på sheltertur?", answer: "Medbring rigeligt vand og vandskål, hundefoder, snor, hundeposer til afføring, hundens soveunderlag og evt. en refleksvest til aftenvandringer. Husk også hundens vaccinationsattest hvis I krydser grænser." },
  { question: "Må hunden bade i søer ved shelters?", answer: "Det varierer fra sted til sted. Nogle naturområder har baderestriktioner for hunde, især i fuglenes yngletid. Tjek lokal skiltning og undgå at lade hunden bade i drikkevandssøer eller i nærheden af badesteder for mennesker." },
];

const PAGE_TITLE = "Shelter med hund i Danmark – tag hunden med på tur | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser i Danmark hvor hunde er tilladt. Se alle shelterpladser der er hundevenlige og tag hunden med på naturovernatning.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-hund" },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: PAGE_TITLE,
    description:
      "Hundevenlige shelters i Danmark – find overnatningspladser hvor du må have hund med.",
    url: "/shelter-med-hund",
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

export default async function ShelterMedHundPage() {
  const shelters = await getSheltersWithPets(50);

  // Fetch summary data for DataSummaryBlock
  const regionCounts = await Promise.all(
    REGION_SLUGS.map(async (slug) => ({
      region: REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug],
      count: await getFilterRegionCount("hund", REGION_NAMES[slug]),
    }))
  );
  const totalForFilter = regionCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Shelter med hund" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link
            href="/"
            className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation"
          >
            Hjem
          </Link>
          <span className="text-primary font-medium">Shelter med hund</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter med hund i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du shelters og overnatningspladser i naturen hvor hunde er tilladt.
            Tag hunden med på tur og oplev naturovernatning i Danmark.
          </p>
        </header>

        <DataSummaryBlock
          headline={`${totalForFilter} shelters med hund i Danmark`}
          regionBreakdown={regionCounts}
          crossPageLinks={REGION_SLUGS.map((slug) => ({
            label: `Hundevenlige shelters i ${REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug]}`,
            href: `/shelter-med-hund/${slug}`,
          }))}
        />

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} hundevenlig{shelters.length !== 1 ? "e shelters" : " shelter"} · scroll for flere
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                  {shelters.map((shelter, i) => (
                    <Fragment key={shelter.id}>
                      {showInFeedAdAt(i, shelters.length) && <AdInFeed />}
                      <ShelterCard
                        shelter={shelter}
                        href={shelterHref(
                          shelter.region ?? null,
                          shelter.kommune ?? null,
                          shelter.slug
                        )}
                      />
                    </Fragment>
                  ))}
                </div>
              </div>
              <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] sm:min-h-[360px] lg:min-h-[420px] h-[50vh] sm:h-[60vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-6 lg:mb-0 mx-4 sm:mx-6 lg:mx-0">
                <ShelterMap shelters={toMapShelters(shelters)} className="w-full h-full" />
              </div>
            </div>
          </section>
        ) : null}

        {shelters.length === 0 && (
          <p className="text-primary/70 py-8">
            Vi finder ingen shelters med registreret hundetilladelse endnu. Tjek den enkelte
            shelterside – mange pladser tillader hunde og beskriver det i teksten. Du kan også{" "}
            <Link href="/danmark" className="text-accent hover:underline">
              udforske shelters i Danmark
            </Link>
            .
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Tag hunden med på sheltertur
          </h2>
          <p>
            Mange shelters i Danmark er hundevenlige – men det er ikke alle pladser der tillader hunde.
            Det skyldes typisk hensyn til vildtet i området, dyreliv eller regler for den pågældende
            skov eller naturpark. På ShelterDK viser vi de pladser hvor det fremgår af de offentlige
            data at hunde er tilladt, så du kan planlægge turen i god ro.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Regler for hunde på shelterpladser
          </h2>
          <p>
            Selvom hunde er tilladt på en shelterplads, gælder Danmarks generelle regler for hunde
            i naturen: hunde skal som udgangspunkt føres i snor i skove og naturområder fra 1. april
            til 30. september. Udenfor disse måneder er der friere regler, men tjek altid lokal
            skiltning. Hav altid vand med til din hund, og respekter andre overnatningsgæsters
            plads og frihed.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Find hundevenlig shelter i hele Danmark
          </h2>
          <p>
            Udforsk hundevenlige shelters i{" "}
            <Link href="/danmark/jylland" className="text-accent hover:underline">Jylland</Link>,{" "}
            <Link href="/danmark/fyn" className="text-accent hover:underline">Fyn</Link>,{" "}
            <Link href="/danmark/sjaelland" className="text-accent hover:underline">Sjælland</Link>{" "}
            og på <Link href="/omraade/bornholm" className="text-accent hover:underline">Bornholm</Link>. Klik på et shelter for at se detaljeret info om faciliteter og
            bookingmuligheder.
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
            <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>
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
            Ofte stillede spørgsmål om shelters med hund
          </h2>
          <dl className="space-y-6">
            {HUND_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(HUND_FAQ)) }}
          />
        </section>
      </div>
    </div>
    </>
  );
}
