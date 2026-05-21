import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastVerifiedBadge } from "@/components/LastVerifiedBadge";
import { SpeakableSchema } from "@/components/seo/SpeakableSchema";

const PAGE_TITLE = "Datakilder og metode | ShelterDK";
const PAGE_DESCRIPTION =
  "Se hvor ShelterDKs shelterdata kommer fra, hvordan de opdateres, og hvordan redaktionelle rettelser og brugerbidrag bliver håndteret.";
const LAST_VERIFIED = "2026-05-21";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "https://shelterdk.dk/data-kilder" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/data-kilder",
  },
};

const sources = [
  {
    title: "GeoFA",
    body: "GeoFA er en vigtig offentlig datakilde for shelterlokationer, faciliteter og grundlæggende metadata. ShelterDK bruger GeoFA som basis for store dele af den landsdækkende dækning.",
  },
  {
    title: "Naturstyrelsen",
    body: "ShelterDK bruger Naturstyrelsens oplysninger om bookbare shelters, primitive lejrpladser og ledighed, hvor de findes. Bookingoplysninger og kalenderdata kan blive synkroniseret særskilt.",
  },
  {
    title: "udinaturen.dk",
    body: "Udinaturen.dk bruges som supplement til officielle data, især for bookinglinks, beskrivelser og praktiske oplysninger på enkelte shelterpladser.",
  },
  {
    title: "Brugerbidrag og redaktionelle rettelser",
    body: "ShelterDK modtager tips, billeder og rettelser fra brugere og shelterejere. Nye oplysninger bliver modereret, før de bliver synlige på siden.",
  },
];

export default function DataSourcesPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    inLanguage: "da",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "https://shelterdk.dk/data-kilder",
  };

  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Datakilder" },
        ]}
      />
      <SpeakableSchema
        url="https://shelterdk.dk/data-kilder"
        selectors={[".llm-quote"]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="rounded-3xl border border-primary/10 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
                Datakilder
              </p>
              <h1 className="mt-3 font-serif text-3xl font-bold text-primary sm:text-4xl">
                Sådan samler og vedligeholder ShelterDK data
              </h1>
            </div>
            <LastVerifiedBadge isoDate={LAST_VERIFIED} />
          </div>
          <p className="llm-quote mt-5 max-w-3xl text-lg leading-8 text-primary/80">
            ShelterDK kombinerer offentlige datakilder, bookingdata,
            redaktionelt vedligehold og brugerbidrag for at gøre danske shelters
            lettere at finde, forstå og planlægge ture omkring.
          </p>
        </header>

        <section className="mt-10 grid gap-5">
          {sources.map((source) => (
            <article
              key={source.title}
              className="rounded-2xl border border-primary/10 bg-white p-6"
            >
              <h2 className="font-serif text-2xl font-bold text-primary">
                {source.title}
              </h2>
              <p className="mt-3 text-base leading-8 text-primary/80">
                {source.body}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-primary/10 bg-accent/5 p-6">
          <h2 className="font-serif text-2xl font-bold text-primary">
            Opdatering og datakvalitet
          </h2>
          <ul className="mt-4 space-y-3 text-base leading-8 text-primary/80">
            <li>
              ShelterDK opdaterer ikke alle datakilder i samme tempo. Derfor kan
              en shelterside være mere opdateret end en samlet oversigtsside.
            </li>
            <li>
              Booking- og ledighedsdata kan være afhængige af særskilt synkronisering
              med den eksterne kilde eller ShelterDKs eget bookingflow.
            </li>
            <li>
              Brugerbidrag og rettelser bliver gennemgået manuelt, før de bliver
              vist som endelig information.
            </li>
          </ul>
        </section>

        <section className="mt-10 rounded-2xl border border-primary/10 bg-white p-6">
          <h2 className="font-serif text-2xl font-bold text-primary">
            Læs mere
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/faq"
              className="rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Ofte stillede spørgsmål
            </Link>
            <Link
              href="/ordliste"
              className="rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Ordliste
            </Link>
            <Link
              href="/fakta/shelters-i-danmark"
              className="rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Fakta om shelters i Danmark
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
