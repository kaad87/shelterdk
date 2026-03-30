import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getSheltersWithBeach } from "@/lib/shelters-with-beach";
import { slugifySegment } from "@/lib/slug";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";

const BEACH_FAQ: FaqItem[] = [
  { question: "Kan man overnatte i shelter ved stranden i Danmark?", answer: "Ja, der findes en række shelterpladser tæt på stranden i Danmark. Mange ligger langs kysten ved Vestjylland, i Det Sydfynske Øhav, på Bornholm og langs Sjællands kyst. På ShelterDK kan du filtrere efter shelters nær strand." },
  { question: "Er shelters ved stranden gratis?", answer: "De fleste shelters nær strand er gratis og fungerer efter først-til-mølle-princippet. Nogle kan dog bookes på forhånd via udinaturen.dk eller book.naturstyrelsen.dk — især i sommerens højsæson er det en god idé at booke." },
  { question: "Må man bade fra shelterpladser ved stranden?", answer: "Ja, du må frit bade fra strandene i Danmark. Vær opmærksom på lokale forhold som strøm og bølger. Mange shelterpladser ved kysten har direkte adgang til en badestrand." },
  { question: "Hvilke faciliteter har shelters ved stranden?", answer: "Det varierer fra plads til plads. Nogle har bålplads, toilet og drikkevand, mens andre er helt primitive. På ShelterDK kan du se faciliteter for hvert enkelt shelter, så du kan finde en plads der passer dine behov." },
  { question: "Hvornår er den bedste tid at overnatte i shelter ved stranden?", answer: "Sommeren (juni–august) er mest populær med varme temperaturer og lange aftener. Men forår og tidligt efterår kan også være fantastisk med færre gæster og smukke solnedgange. Om vinteren kan det være en unik oplevelse, men kræver god forberedelse og varmt udstyr." },
];

const PAGE_TITLE = "Shelter ved stranden i Danmark – overnatning nær kysten | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters og overnatningspladser tæt på stranden i Danmark. Oplev naturovernatning med havudsigt, bølgelyde og direkte adgang til kysten.",
  alternates: { canonical: "https://shelterdk.dk/shelter-med-strand" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Shelters nær stranden i Danmark. Find overnatningspladser i naturen med havudsigt og direkte strandadgang.",
    url: "/shelter-med-strand",
  },
};

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  const regionSlug = slugifySegment(r);
  const m = kommune ? slugifySegment(kommune) : "ukendt-kommune";
  return `/danmark/${regionSlug}/${m}/${slug}`;
}

export default async function ShelterMedStrandPage() {
  const shelters = await getSheltersWithBeach(200);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Søg shelters", href: "/soeg" }, { label: "Shelter ved stranden" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">Hjem</Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" />
          <Link href="/soeg" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">Søg shelters</Link>
          <ChevronRight size={14} className="text-primary/50" />
          <span className="text-primary font-medium">Shelter ved stranden</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
            Shelter ved stranden i Danmark
          </h1>
          <p className="text-primary/80 text-lg">
            Her finder du shelters og overnatningspladser tæt på stranden. Fald i søvn til lyden af
            bølgerne og vågn op til havudsigt — en af de bedste måder at opleve den danske kyst.
          </p>
        </header>

        {shelters.length > 0 ? (
          <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[70vh]">
              <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                  {shelters.length} shelter{shelters.length !== 1 ? "s" : ""} nær strand · scroll for flere
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
            Vi finder ingen shelters nær strand endnu. Prøv at kigge i{" "}
            <Link href="/soeg" className="text-accent hover:underline">søgningen</Link>{" "}
            med Strand-filteret aktiveret.
          </p>
        )}

        <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
          <h2 className="font-serif text-xl font-bold text-primary">
            Hvorfor vælge shelter ved stranden?
          </h2>
          <p>
            At overnatte i et shelter nær stranden er en helt særlig oplevelse. Du får
            kombinationen af naturovernatning og kystlandskab — med mulighed for at bade,
            fiske eller bare nyde solnedgangen over vandet. Danmarks over 7.000 km kystlinje
            byder på mange muligheder for shelterture langs havet.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Populære kystområder med shelters
          </h2>
          <p>
            Vestkysten i{" "}
            <Link href="/danmark/jylland" className="text-accent hover:underline">Jylland</Link>{" "}
            byder på dramatiske klitlandskaber og rå natur. Det Sydfynske Øhav og{" "}
            <Link href="/danmark/fyn" className="text-accent hover:underline">Fyn</Link>{" "}
            har mildere farvande perfekte til familier.{" "}
            <Link href="/danmark/bornholm" className="text-accent hover:underline">Bornholm</Link>{" "}
            kombinerer klippekyster med sandstrande, og{" "}
            <Link href="/danmark/sjaelland" className="text-accent hover:underline">Sjællands</Link>{" "}
            kyster byder på alt fra brede sandstrande til stille fjorde.
          </p>

          <h2 className="font-serif text-xl font-bold text-primary">
            Tips til sheltertur ved kysten
          </h2>
          <p>
            Husk at vinden kan være kraftigere ved kysten — medring ekstra varm beklædning og
            overvej et shelter med læ. Tjek vejrudsigten på den enkelte shelterside her på ShelterDK.
            Om sommeren er det en god idé at{" "}
            <Link href="/shelter-booking" className="text-accent hover:underline">booke dit shelter</Link>{" "}
            på forhånd, da kystpladserne er meget populære.
          </p>

          <p>
            Se også:{" "}
            <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>
            {" · "}
            <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>
            {" · "}
            <Link href="/shelter-med-bruser" className="text-accent hover:underline">shelter med bruser</Link>
            {" · "}
            <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>
            {" · "}
            <Link href="/shelter-med-hund" className="text-accent hover:underline">hundevenlige shelters</Link>
            {" · "}
            <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">pakkeliste til sheltertur</Link>
            .
          </p>
        </section>

        <section className="mt-12 pt-8 border-t border-primary/10">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">
            Ofte stillede spørgsmål om shelters ved stranden
          </h2>
          <dl className="space-y-6">
            {BEACH_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(BEACH_FAQ)) }}
          />
        </section>
      </div>
    </div>
    </>
  );
}
