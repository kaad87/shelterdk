import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ShelterCard } from "@/components/ShelterCard";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { SpeakableSchema } from "@/components/seo/SpeakableSchema";
import { getNewShelters, isNewShelter, newShelterHref, NEW_SHELTER_DAYS } from "@/lib/new-shelters";

export const revalidate = 3600; // ISR: hold /nye nogenlunde frisk (1 time)

const PAGE_LIMIT = 50;
const PAGE_TITLE = "Nye shelters i Danmark – senest tilføjet | ShelterDK";
const PAGE_OG_IMAGE =
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80&auto=format&fit=crop";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Se de nyeste shelters og shelterpladser tilføjet til ShelterDK. Opdateret løbende med nye overnatningspladser i naturen i hele Danmark.",
  alternates: { canonical: "https://shelterdk.dk/nye" },
  openGraph: {
    title: PAGE_TITLE,
    description: "De senest tilføjede shelters i Danmark – opdateret løbende.",
    url: "/nye",
    images: [{ url: PAGE_OG_IMAGE, width: 1200, height: 630, alt: "Nye shelters i Danmark" }],
  },
};

export default async function NyeSheltersPage() {
  const shelters = await getNewShelters({ limit: PAGE_LIMIT, presentableOnly: true });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Nye shelters i Danmark",
    numberOfItems: shelters.length,
    itemListElement: shelters.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://shelterdk.dk${newShelterHref(s)}`,
      name: s.title,
    })),
  };

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Nye shelters" }]} />
      <SpeakableSchema url="https://shelterdk.dk/nye" selectors={[".llm-quote"]} />
      {shelters.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Hjem
            </Link>
            <span aria-hidden="true">›</span>
            <span className="text-primary font-medium">Nye shelters</span>
          </nav>

          <header className="mb-8">
            <h1 className="flex items-center gap-2.5 font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
              <Sparkles size={30} className="text-accent" aria-hidden="true" />
              Nye shelters i Danmark
            </h1>
            <p className="text-primary/80 text-lg">
              De senest tilføjede shelters og shelterpladser på ShelterDK. Siden opdateres løbende,
              så kig forbi for at finde nye overnatningssteder i naturen før alle andre.
            </p>
          </header>

          <section className="mb-8 rounded-2xl border border-accent/20 bg-accent/5 p-6">
            <h2 className="font-serif text-2xl font-bold text-primary mb-3">Kort svar om nye shelters</h2>
            <p className="llm-quote text-primary/85 leading-relaxed">
              Nye shelters er de overnatningspladser, der senest er tilføjet til ShelterDK. Pladser
              markeret med &quot;Ny&quot; er tilføjet inden for de seneste {NEW_SHELTER_DAYS} dage. Her finder
              du dem alle ét sted – med billede, beskrivelse og link videre til hver enkelt plads.
            </p>
          </section>

          {shelters.length > 0 ? (
            <>
              <p className="text-primary/70 text-sm mb-4">
                {shelters.length} nye shelter{shelters.length !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5 pb-12">
                {shelters.map((shelter, index) => (
                  <ShelterCard
                    key={shelter.id}
                    shelter={shelter}
                    href={newShelterHref(shelter)}
                    isNew={isNewShelter(shelter)}
                    priority={index < 2}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-primary/70 py-8">
              Der er ingen nye shelters at vise lige nu. Udforsk i stedet{" "}
              <Link href="/danmark" className="text-accent hover:underline">
                alle shelters i Danmark
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </>
  );
}
