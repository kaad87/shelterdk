import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getDistinctByLandingPages, slugifySegment } from "@/lib/danmark-silo";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "Byer med shelters i Danmark | ShelterDK" },
  description:
    "Udforsk byer med shelters i Danmark. Find bysider med shelteroversigter, kort, faciliteter og direkte links til de enkelte pladser.",
  alternates: { canonical: "https://shelterdk.dk/by" },
  openGraph: {
    title: "Byer med shelters i Danmark | ShelterDK",
    description:
      "Udforsk byer med shelters i Danmark og find den rigtige byside til din næste tur.",
    url: "/by",
  },
};

const PRIORITY_CITY_NAMES = [
  "Aalborg",
  "Aarhus",
  "Billund",
  "Esbjerg",
  "Helsingør",
  "Herning",
  "Holstebro",
  "Horsens",
  "Kolding",
  "København",
  "Næstved",
  "Odense",
  "Randers",
  "Roskilde",
  "Silkeborg",
  "Svendborg",
  "Vejle",
  "Viborg",
];

const MIN_POPULAR_CITY_COUNT = 2;

export default async function ByIndexPage() {
  const places = await getDistinctByLandingPages(1);
  const priorityCities = PRIORITY_CITY_NAMES
    .map((cityName) => places.find((place) => place.place === cityName))
    .filter((place): place is { place: string; count: number } =>
      Boolean(place && place.count >= MIN_POPULAR_CITY_COUNT)
    );
  const sortedByPopularity = [...places].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.place.localeCompare(b.place, "da");
  });
  const popular =
    priorityCities.length > 0
      ? [...priorityCities].sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.place.localeCompare(b.place, "da");
        })
      : sortedByPopularity.filter((place) => place.count >= 4).slice(0, 12);
  const groupedPlaces = [...places]
    .sort((a, b) => a.place.localeCompare(b.place, "da"))
    .reduce<Record<string, { place: string; count: number }[]>>((groups, place) => {
      const letter = place.place.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(place);
      return groups;
    }, {});
  const letters = Object.keys(groupedPlaces).sort((a, b) => a.localeCompare(b, "da"));

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
              Byer med shelters i Danmark
            </h1>
            <p className="text-lg text-primary/80">
              Denne side samler ShelterDKs bysider, så du hurtigt kan finde shelters i eller tæt på
              danske byer. Vælg en by for at se lokale shelteroversigter, faciliteter og direkte
              links til de enkelte pladser.
            </p>
          </header>

          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-primary mb-5">
              Kendte byer med flest shelters
            </h2>
            <p className="mb-5 max-w-3xl text-primary/75">
              Her viser vi genkendelige danske byer, hvor der er registreret flere shelters på
              bysiden. Listen er sorteret efter hvor mange shelters der er registreret i byen,
              mens den fulde A-Å-oversigt længere nede viser alle bysider.
            </p>
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

          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-primary mb-5">
              Alle byer A-Å
            </h2>
            <div className="space-y-8">
              {letters.map((letter) => (
                <section key={letter}>
                  <h3 className="font-serif text-xl font-bold text-primary mb-3">
                    {letter}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {groupedPlaces[letter].map(({ place, count }) => (
                      <Link
                        key={place}
                        href={`/by/${slugifySegment(place)}`}
                        className="rounded-xl border border-primary/10 bg-white px-4 py-3 text-sm hover:border-accent/30 hover:shadow-sm transition-all"
                      >
                        <span className="font-semibold text-primary">Shelter {place}</span>
                        <span className="mt-1 block text-primary/60">
                          {count} shelter{count !== 1 ? "s" : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="prose prose-primary max-w-none text-primary/90">
            <h2 className="font-serif text-2xl font-bold text-primary">
              Hvad finder du på by-siderne?
            </h2>
            <p>
              Hver byside samler shelters i og omkring byen med direkte links til shelterbeskrivelser,
              kommune-sider og relevante facilitetsfiltre. Det gør det lettere at finde shelter i en
              bestemt by uden at starte i den generelle søgning eller gætte sig frem til den rigtige
              kommune.
            </p>
            <p>
              Vil du hellere udforske bredere, kan du også gå videre til{" "}
              <Link href="/danmark" className="text-accent hover:underline">
                shelters i Danmark
              </Link>
              ,{" "}
              <Link href="/omraade" className="text-accent hover:underline">
                shelter efter område
              </Link>
              {" "}eller{" "}
              <Link href="/guides" className="text-accent hover:underline">
                vores guides
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
