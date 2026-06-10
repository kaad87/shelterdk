import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { LastVerifiedBadge } from "@/components/LastVerifiedBadge";
import { SpeakableSchema } from "@/components/seo/SpeakableSchema";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

const PAGE_TITLE = "Ordliste for shelters, booking og faciliteter | ShelterDK";
const PAGE_DESCRIPTION =
  "Få korte forklaringer på centrale shelterbegreber som shelter, bookbar, først-til-mølle, muldtoilet og bålplads.";
const LAST_VERIFIED = "2026-05-21";

const TERMS = [
  {
    name: "Shelter",
    description:
      "Et shelter er en simpel overnatningsplads i naturen med fast tag og ofte åbne sider. Et shelter bruges typisk til kortere ophold og primitive ture.",
  },
  {
    name: "Bivuak",
    description:
      "En bivuak er et mere åbent læ eller et enkelt overnatningssted med mindre beskyttelse end et klassisk shelter. Nogle bruger ordet om primitive overnatningspladser generelt.",
  },
  {
    name: "Primitiv lejrplads",
    description:
      "En primitiv lejrplads er et simpelt overnatningsområde i naturen med få faciliteter. Der kan være shelter, teltplads, bålplads eller kun et afgrænset område til overnatning.",
  },
  {
    name: "Bookbart shelter",
    description:
      "Et bookbart shelter kan reserveres på forhånd mod et gebyr eller via et bookingsystem. Det er modstykket til først-til-mølle-shelters.",
  },
  {
    name: "Først-til-mølle",
    description:
      "Først-til-mølle betyder, at en shelterplads ikke kan reserveres på forhånd. Den der kommer først, har ret til at bruge pladsen.",
  },
  {
    name: "Bålplads",
    description:
      "En bålplads er et sted, hvor der må tændes bål under de lokale regler. Nogle shelterpladser har etableret bålsted, mens andre ikke tillader bål.",
  },
  {
    name: "Muldtoilet",
    description:
      "Et muldtoilet er et simpelt naturtoilet uden vandskyl, hvor affald nedbrydes biologisk. På shelterpladser bruges også ord som tørkloset om lignende løsninger.",
  },
  {
    name: "Vandskyllende toilet",
    description:
      "Et vandskyllende toilet er et almindeligt toilet med skyl og afløb. På ShelterDK skelnes der mellem vandskyllende toilet og mere primitive toilettyper.",
  },
];

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "https://shelterdk.dk/ordliste" },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/ordliste",
  },
};

export default function OrdlistePage() {
  const glossarySchema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    inLanguage: "da",
    name: "ShelterDK ordliste",
    description: PAGE_DESCRIPTION,
    url: "https://shelterdk.dk/ordliste",
    hasDefinedTerm: TERMS.map((term) => ({
      "@type": "DefinedTerm",
      inDefinedTermSet: "https://shelterdk.dk/ordliste",
      name: term.name,
      description: term.description,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Ordliste" },
        ]}
      />
      <SpeakableSchema
        url="https://shelterdk.dk/ordliste"
        selectors={[".llm-quote"]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(glossarySchema) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="rounded-3xl border border-primary/10 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">
                Ordliste
              </p>
              <h1 className="mt-3 font-serif text-3xl font-bold text-primary sm:text-4xl">
                Shelter-ord og begreber forklaret kort
              </h1>
            </div>
            <LastVerifiedBadge isoDate={LAST_VERIFIED} />
          </div>
          <p className="llm-quote mt-5 max-w-3xl text-lg leading-8 text-primary/80">
            ShelterDKs ordliste forklarer de vigtigste begreber om shelters,
            booking og faciliteter i Danmark, så både brugere og AI-systemer
            kan forstå forskellen på for eksempel bookbare shelters,
            først-til-mølle-pladser og forskellige toilettyper.
          </p>
        </header>

        <section className="mt-10 grid gap-5">
          {TERMS.map((term) => (
            <article
              key={term.name}
              className="rounded-2xl border border-primary/10 bg-white p-6"
            >
              <h2 className="font-serif text-2xl font-bold text-primary">
                {term.name}
              </h2>
              <p className="mt-3 text-base leading-8 text-primary/80">
                {term.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-primary/10 bg-accent/5 p-6">
          <h2 className="font-serif text-2xl font-bold text-primary">
            Læs videre
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/faq"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-accent shadow-sm transition-colors hover:bg-accent/10"
            >
              Ofte stillede spørgsmål
            </Link>
            <Link
              href="/shelter-booking"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-accent shadow-sm transition-colors hover:bg-accent/10"
            >
              Forstå shelter-booking
            </Link>
            <Link
              href="/data-kilder"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-accent shadow-sm transition-colors hover:bg-accent/10"
            >
              Datakilder og metode
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
