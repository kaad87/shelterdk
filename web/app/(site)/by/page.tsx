import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getDistinctPlacesWithCounts, slugifySegment } from "@/lib/danmark-silo";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "Shelter by i Danmark | ShelterDK" },
  description:
    "Find shelter i danske byer som Aarhus, Billund, Silkeborg og Svendborg. Udforsk bysider med shelters, kort og faciliteter.",
  alternates: { canonical: "https://shelterdk.dk/by" },
  openGraph: {
    title: "Shelter by i Danmark | ShelterDK",
    description:
      "Find shelter i danske byer som Aarhus, Billund, Silkeborg og Svendborg.",
    url: "/by",
  },
};

export default async function ByIndexPage() {
  const places = await getDistinctPlacesWithCounts(1);
  const featuredPlaceNames = [
    "Aarhus",
    "Billund",
    "Silkeborg",
    "Svendborg",
    "Vejle",
    "Horsens",
    "Odense",
    "Aalborg",
  ];

  const featured = featuredPlaceNames
    .map((name) => places.find((place) => place.place === name))
    .filter(Boolean) as { place: string; count: number }[];

  const remaining = places.filter(
    (place) => !featuredPlaceNames.includes(place.place)
  );
  const popular = [...featured, ...remaining.sort((a, b) => b.count - a.count)].slice(0, 24);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Byer" },
        ]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors touch-manipulation">
              Hjem
            </Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <span className="text-primary font-medium">Byer</span>
          </nav>

          <header className="mb-10 max-w-3xl">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              Shelter by i Danmark
            </h1>
            <p className="text-lg text-primary/80">
              Find bysider for danske shelter-områder og gå direkte til sider som
              <span> </span>
              <Link href="/by/aarhus" className="text-accent hover:underline">
                Shelter Aarhus
              </Link>
              ,<span> </span>
              <Link href="/by/billund" className="text-accent hover:underline">
                Shelter Billund
              </Link>
              <span> </span>og andre populære byer.
            </p>
          </header>

          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-primary mb-5">
              Populære byer
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {popular.map(({ place, count }) => (
                <Link
                  key={place}
                  href={`/by/${slugifySegment(place)}`}
                  className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm hover:border-accent/30 hover:shadow-md transition-all"
                >
                  <div className="font-serif text-xl font-bold text-primary">
                    Shelter {place}
                  </div>
                  <div className="mt-2 text-sm text-primary/70">
                    {count} shelter{count !== 1 ? "s" : ""} i byen
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="prose prose-primary max-w-none text-primary/90">
            <h2 className="font-serif text-2xl font-bold text-primary">
              Hvad finder du på by-siderne?
            </h2>
            <p>
              Hver byside samler shelters i og omkring byen med direkte links til de enkelte
              shelterbeskrivelser, kommune-sider og relevante facilitetsfiltre. Det gør det lettere
              at finde shelter i byer som Aarhus, Billund, Silkeborg og Svendborg uden at skulle
              starte på den generelle søgeside.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
