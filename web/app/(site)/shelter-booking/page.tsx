import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { DataSummaryBlock } from "@/components/DataSummaryBlock";
import { getFilterRegionCount, getCountPerRegion } from "@/lib/fakta-db";
import { REGION_SLUGS, REGION_NAMES, REGION_SHORT_NAMES } from "@/lib/cross-page-config";

const BOOKING_FAQ: FaqItem[] = [
  { question: "Hvor kan man booke shelter i Danmark?", answer: "Du kan booke shelters via udinaturen.dk (Friluftsrådet), book.naturstyrelsen.dk (Naturstyrelsen) og kommunernes egne bookingsystemer. På ShelterDK kan du filtrere efter bookbare shelters og finde direkte links til booking." },
  { question: "Hvad koster det at booke et shelter?", answer: "Prisen varierer. Mange shelters på Naturstyrelsens arealer koster 0–30 kr. per nat. Kommunale shelters og shelters på private arealer kan koste op til 100 kr. per nat. Gratis shelters findes også — de fungerer efter først-til-mølle-princippet." },
  { question: "Hvor lang tid i forvejen kan man booke shelter?", answer: "På book.naturstyrelsen.dk kan du typisk booke op til 3 måneder frem. Kommunale bookingsystemer varierer — nogle åbner for booking 6 måneder frem. I højsæsonen (juni–august) bør du booke så tidligt som muligt." },
  { question: "Kan man aflyse en shelterbooking?", answer: "Afbestillingsregler varierer mellem bookingplatforme. På Naturstyrelsens arealer er der typisk gratis afbestilling op til et vist antal dage før ankomst. Tjek altid de specifikke vilkår ved booking." },
  { question: "Hvad er forskellen på bookbare og gratis shelters?", answer: "Bookbare shelters kan reserveres på forhånd, så du er sikker på en plads. Gratis shelters (først-til-mølle) kan ikke reserveres — du risikerer at pladsen er optaget. Til gengæld er de helt gratis og kræver ingen planlægning." },
  { question: "Kan man booke shelter til en gruppe?", answer: "Ja, mange shelterpladser kan bookes til grupper. Nogle pladser har flere shelters der kan bookes samlet. Ved booking angiver du typisk antal personer. For større grupper (spejder, firmatur) kan det være en god idé at kontakte pladsen direkte." },
];

const PAGE_TITLE = "Book shelter i Danmark – guide til shelter-booking | ShelterDK";
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Alt om shelter-booking i Danmark. Find ud af hvor og hvordan du booker shelter, hvad det koster, og hvornår du bør booke. Links til udinaturen.dk og Naturstyrelsen.",
  alternates: { canonical: "https://shelterdk.dk/shelter-booking" },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Guide til shelter-booking i Danmark. Hvor, hvornår og hvordan du booker dit næste shelter.",
    url: "/shelter-booking",
  },
};

export default async function ShelterBookingPage() {
  // Fetch summary data for DataSummaryBlock
  const regionCounts = await Promise.all(
    REGION_SLUGS.map(async (slug) => ({
      region: REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug],
      count: await getFilterRegionCount("booking", REGION_NAMES[slug]),
    }))
  );
  const totalForFilter = regionCounts.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Shelter-booking" }]} />
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
          <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">Hjem</Link>
          <ChevronRight size={14} className="text-primary/50 shrink-0" />
          <span className="text-primary font-medium">Shelter-booking</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
            Book shelter i Danmark
          </h1>
          <p className="text-primary/80 text-lg leading-relaxed">
            Vil du være sikker på at have en plads klar når du ankommer? Her er alt du skal vide
            om shelter-booking i Danmark — hvor du booker, hvad det koster, og hvornår du bør
            reservere.
          </p>
        </header>

        <DataSummaryBlock
          headline={`${totalForFilter} bookbare shelters i Danmark`}
          regionBreakdown={regionCounts}
          crossPageLinks={REGION_SLUGS.map((slug) => ({
            label: `Bookbare shelters i ${REGION_SHORT_NAMES[slug] ?? REGION_NAMES[slug]}`,
            href: `/shelter-booking/${slug}`,
          }))}
        />

        <article className="prose prose-primary max-w-none text-primary/90">

          <h2 className="font-serif text-2xl font-bold text-primary">
            Hvor booker man shelter?
          </h2>
          <p>
            Der er tre hovedplatforme til at booke shelters i Danmark:
          </p>
          <ul>
            <li>
              <strong><a href="https://udinaturen.dk" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">udinaturen.dk</a></strong>{" "}
              — Friluftsrådets platform med shelters fra kommuner og private ejere. Her finder du et
              bredt udvalg af bookbare shelterpladser over hele landet.
            </li>
            <li>
              <strong><a href="https://book.naturstyrelsen.dk" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">book.naturstyrelsen.dk</a></strong>{" "}
              — Naturstyrelsens egen bookingside for shelters, lejrpladser og ly på statens arealer.
              Typisk billige eller gratis pladser i smuk natur.
            </li>
            <li>
              <strong>Kommunale bookingsystemer</strong> — Mange kommuner har egne bookingsystemer
              til lokale shelterpladser. Links findes typisk på kommunens hjemmeside under
              &quot;Friluftsliv&quot; eller &quot;Overnatning i naturen&quot;.
            </li>
          </ul>
          <p>
            På ShelterDK kan du{" "}
            <Link href="/soeg?bookbar=1" className="text-accent hover:underline">filtrere efter bookbare shelters</Link>{" "}
            og finde direkte links til booking for hvert enkelt shelter.
          </p>

          <h2 className="font-serif text-2xl font-bold text-primary">
            Hvad koster det?
          </h2>
          <p>
            Priserne varierer afhængigt af plads og ejer:
          </p>
          <ul>
            <li><strong>Naturstyrelsens arealer:</strong> Ofte gratis eller 0–30 kr. per nat</li>
            <li><strong>Kommunale shelters:</strong> Typisk 0–50 kr. per nat</li>
            <li><strong>Private og foreningsejede:</strong> Op til 100 kr. per nat</li>
          </ul>
          <p>
            Mange af de bedste shelterpladser i Danmark er helt gratis — de fungerer efter
            først-til-mølle-princippet og kan ikke bookes. Se vores guide til{" "}
            <Link href="/blog/gratis-shelters-i-danmark" className="text-accent hover:underline">gratis shelters i Danmark</Link>.
          </p>

          <h2 className="font-serif text-2xl font-bold text-primary">
            Hvornår bør du booke?
          </h2>
          <p>
            <strong>Højsæson (juni–august):</strong> Book 2–4 uger i forvejen, især til populære
            pladser ved kysten og i nationalparker. Weekender i juli kan være fuldt booket
            måneder i forvejen.
          </p>
          <p>
            <strong>Skuldersæson (april–maj, september–oktober):</strong> Ofte nok at booke
            1–2 uger i forvejen. Færre gæster og smukke farver gør det til en fantastisk tid
            for shelterture.
          </p>
          <p>
            <strong>Vinteren (november–marts):</strong> Sjældent nødvendigt at booke, da der er
            færre gæster. Perfekt til den eventyrlige sheltertur — se vores{" "}
            <Link href="/guides/overnatning-i-shelter-om-vinteren" className="text-accent hover:underline">
              vinterguide
            </Link>.
          </p>

          <h2 className="font-serif text-2xl font-bold text-primary">
            Bookbar vs. først-til-mølle
          </h2>
          <p>
            I Danmark er shelters opdelt i to kategorier:
          </p>
          <ul>
            <li>
              <strong>Bookbare shelters</strong> — Du reserverer på forhånd og har pladsen for
              dig selv. Perfekt til familier, grupper eller ture i højsæsonen. Koster typisk
              et lille beløb.
            </li>
            <li>
              <strong>Først-til-mølle shelters</strong> — Gratis, men du risikerer at pladsen
              er optaget. Bedst til spontane ture og i lavsæson. Husk at du må overnatte op
              til to nætter i træk.
            </li>
          </ul>
          <p>
            Vi anbefaler at booke hvis du rejser med{" "}
            <Link href="/blog/shelter-med-boern" className="text-accent hover:underline">børn</Link>{" "}
            eller planlægger en{" "}
            <Link href="/blog/shelter-som-par" className="text-accent hover:underline">romantisk tur</Link>{" "}
            — der er intet værre end at ankomme og finde pladsen optaget.
          </p>

          <h2 className="font-serif text-2xl font-bold text-primary">
            Find det rigtige shelter
          </h2>
          <p>
            Brug ShelterDK til at finde det perfekte shelter til din næste tur:
          </p>
          <ul>
            <li>
              <Link href="/soeg?bookbar=1" className="text-accent hover:underline">Bookbare shelters</Link>{" "}
              — alle shelters der kan reserveres
            </li>
            <li>
              <Link href="/shelter-med-toilet" className="text-accent hover:underline">Shelter med toilet</Link>{" "}
              — ekstra komfort
            </li>
            <li>
              <Link href="/shelter-med-vand" className="text-accent hover:underline">Shelter med vand</Link>{" "}
              — drikkevand på pladsen
            </li>
            <li>
              <Link href="/shelter-med-strand" className="text-accent hover:underline">Shelter ved stranden</Link>{" "}
              — overnatning nær kysten
            </li>
            <li>
              <Link href="/shelter-med-bruser" className="text-accent hover:underline">Shelter med bruser</Link>{" "}
              — badefaciliteter
            </li>
            <li>
              <Link href="/shelter-med-baalplads" className="text-accent hover:underline">Shelter med bålplads</Link>{" "}
              — hygge ved bålet
            </li>
            <li>
              <Link href="/shelter-med-hund" className="text-accent hover:underline">Hundevenlige shelters</Link>{" "}
              — tag hunden med
            </li>
            <li>
              <Link href="/handicapvenlige-shelters" className="text-accent hover:underline">Handicapvenlige shelters</Link>{" "}
              — tilgængelige overnatningspladser
            </li>
            <li>
              <Link href="/shelter-til-familier" className="text-accent hover:underline">Shelter til familier</Link>{" "}
              — børnevenlige shelters med faciliteter
            </li>
            <li>
              <Link href="/shelter-til-cykeltur" className="text-accent hover:underline">Shelter til cykeltur</Link>{" "}
              — overnat langs cykelruter
            </li>
            <li>
              <Link href="/shelter-naer-vand" className="text-accent hover:underline">Shelter nær vand</Link>{" "}
              — strand, sø og å
            </li>
            <li>
              <Link href="/shelter-naer-mig" className="text-accent hover:underline">Shelter nær mig</Link>{" "}
              — find det nærmeste shelter
            </li>
          </ul>
          <p>
            Se også vores{" "}
            <Link href="/guides/shelter-for-begyndere-forste-tur" className="text-accent hover:underline">begynderguide</Link>{" "}
            og{" "}
            <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">pakkeliste til sheltertur</Link>{" "}
            for at forberede din tur.
          </p>
        </article>

        <section className="mt-12 pt-8 border-t border-primary/10">
          <h2 className="font-serif text-xl font-bold text-primary mb-6">
            Ofte stillede spørgsmål om shelter-booking
          </h2>
          <dl className="space-y-6">
            {BOOKING_FAQ.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(BOOKING_FAQ)) }}
          />
        </section>
      </div>
    </div>
    </>
  );
}
