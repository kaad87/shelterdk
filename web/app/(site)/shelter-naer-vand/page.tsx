import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getStrandShelters, getFilterRegionCount } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { REGION_SLUGS, REGION_NAMES, REGION_SHORT_NAMES } from "@/lib/cross-page-config";

export const revalidate = 86400;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Kan man finde shelters nær vand i Danmark?",
    answer:
      "Ja, mange shelters i Danmark ligger tæt på vand – enten ved kysten, søer eller åer. På ShelterDK kan du filtrere efter shelters nær strand for at finde de bedste pladser ved vandet.",
  },
  {
    question: "Er der shelters hvor man kan fiske?",
    answer:
      "Flere shelters ligger ved søer og åer med fiskemuligheder. Husk at du skal have et gyldigt fisketegn for at fiske i danske farvande og ferskvand. Tjek lokale regler for den specifikke sø eller å.",
  },
  {
    question: "Kan man tage kano eller kajak til et shelter?",
    answer:
      "Ja, flere vandløb som Gudenåen, Susåen og Skjern Å har shelters langs bredden, som er ideelle for kano- og kajakture. Brug vores ruteplanner til at finde ruter langs vandløb med shelters.",
  },
  {
    question: "Er det tilladt at bade ved shelters?",
    answer:
      "Ved mange kystnære shelters er der gode bademuligheder. Tjek altid lokal skiltning for badeforhold og eventuelle restriktioner. Nogle søer kan have baderestriktioner af hensyn til drikkevand.",
  },
  {
    question: "Hvilke regioner har flest shelters nær vand?",
    answer:
      "Jylland har flest shelters nær vand takket være den lange kystlinje og mange fjorde. Fyn og øerne har også mange kystnære shelters, og Sjælland byder på shelters ved både kyst og sø.",
  },
];

const PAGE_TITLE = "Shelter nær vand – overnat ved strand, sø og å | ShelterDK";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters nær vand i Danmark. Overnat ved stranden, søer og åer. Se shelters med bademuligheder, fiskeri og kano- og kajakadgang.",
  alternates: { canonical: "https://shelterdk.dk/shelter-naer-vand" },
  openGraph: {
    title: PAGE_TITLE,
    description: "Shelters nær vand i Danmark – strand, sø, å og kystovernatning.",
    url: "/shelter-naer-vand",
  },
};

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  return `/danmark/${slugifySegment(r)}/${kommune ? slugifySegment(kommune) : "ukendt-kommune"}/${slug}`;
}

export default async function ShelterNaerVandPage() {
  const shelters = await getStrandShelters(50);

  const regionCounts = await Promise.all(
    REGION_SLUGS.map(async (slug) => ({
      region: REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug],
      count: await getFilterRegionCount("strand", REGION_NAMES[slug]),
    }))
  );
  const total = regionCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Shelter nær vand" },
        ]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <span className="text-primary font-medium">Shelter nær vand</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              Shelter nær vand i Danmark
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Overnat tæt på vandet – ved stranden, ved en sø eller langs en å.
              {total > 0 && ` ${total} shelters i Danmark ligger nær strand eller vandløb.`}
            </p>
          </header>

          <DataSummaryBlock
            headline={`${total} shelters nær vand i Danmark`}
            regionBreakdown={regionCounts}
            crossPageLinks={REGION_SLUGS.map((slug) => ({
              label: `Shelters nær vand i ${REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug]}`,
              href: `/shelter-med-strand/${slug}`,
            }))}
          />

          {shelters.length > 0 && (
            <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
                <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                  <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                    {shelters.length} shelters nær vand · scroll for flere
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
          )}

          <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
            <h2 className="font-serif text-xl font-bold text-primary">
              Shelter ved stranden
            </h2>
            <p>
              Danmarks lange kystlinje byder på talrige sheltermuligheder med udsigt over
              havet eller kort afstand til stranden. Fra Vesterhavets dramatiske klitter til
              Østersøens rolige bugter finder du shelters der giver dig en unik overnatningsoplevelse
              tæt på bølgerne.
            </p>

            <h2 className="font-serif text-xl font-bold text-primary">
              Shelter ved sø og å – kano og kajak
            </h2>
            <p>
              Danmarks søer og åer er ideelle for kano- og kajakture med shelter. Langs{" "}
              <Link href="/ruteplanner" className="text-accent hover:underline">vandreruter</Link>{" "}
              ved Gudenåen, Susåen og Skjern Å finder du shelters der ligger perfekt til
              en overnatning midt på vandturen. Mange pladser har bålplads, så du kan
              tilberede din fangst over åben ild.
            </p>

            <h2 className="font-serif text-xl font-bold text-primary">
              Fiskeri fra shelter
            </h2>
            <p>
              Flere shelters ved søer og vandløb giver mulighed for fiskeri direkte fra
              pladsen. Husk dit fisketegn og tjek lokale regler. En kombination af
              shelter og fiskeri er en fantastisk måde at koble af i naturen.
            </p>

            <p>
              Se også:{" "}
              <Link href="/shelter-med-strand" className="text-accent hover:underline">shelters nær strand</Link>
              {" · "}
              <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>
              {" · "}
              <Link href="/shelter-til-cykeltur" className="text-accent hover:underline">shelter til cykeltur</Link>
              {" · "}
              <Link href="/shelter-til-familier" className="text-accent hover:underline">shelter til familier</Link>
              {" · "}
              <Link href="/handicapvenlige-shelters" className="text-accent hover:underline">handicapvenlige shelters</Link>
              {" · "}
              <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>
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
              Ofte stillede spørgsmål om shelters nær vand
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
