import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { getCountPerRegion } from "@/lib/fakta-db";
import { slugifySegment } from "@/lib/slug";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "Shelters i Danmarks regioner | ShelterDK" },
  description:
    "Udforsk shelters efter region i Danmark. Gå videre til Jylland, Fyn, Sjælland og Øerne eller Bornholm og find shelters, bysider og kommunesider.",
  alternates: { canonical: "https://shelterdk.dk/danmark" },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: "Shelters i Danmarks regioner | ShelterDK",
    description:
      "Udforsk shelters efter region i Danmark og gå videre til regioner, kommuner og bysider.",
    url: "/danmark",
  },
};

export default async function DanmarkHubPage() {
  const regions = await getCountPerRegion();

  return (
    <>
      <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Danmark" }]} />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <nav className="mb-8 text-sm text-primary/70" aria-label="Brødkrummesti">
            <ol className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
              <li>
                <Link href="/" className="hover:text-accent transition-colors">
                  Forside
                </Link>
              </li>
              <li aria-hidden className="text-primary/50">/</li>
              <li className="text-primary font-medium">Danmark</li>
            </ol>
          </nav>

          <header className="mb-10 max-w-3xl">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-4">
              Shelters i Danmark efter region
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Brug Danmark-siloen som dit indeks over regioner, kommuner og byer. Herfra kan du
              gå videre til de vigtigste landingssider for shelters i Jylland, Fyn, Sjælland og
              Øerne samt Bornholm.
            </p>
          </header>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
            {regions.map((region) => (
              <Link
                key={region.region}
                href={`/danmark/${slugifySegment(region.region)}`}
                className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm hover:border-accent/30 hover:shadow-md transition-all"
              >
                <h2 className="font-serif text-2xl font-bold text-primary">
                  {region.region}
                </h2>
                <p className="mt-2 text-primary/70">
                  {region.count} shelter{region.count !== 1 ? "s" : ""} i regionen
                </p>
              </Link>
            ))}
          </section>

          <section className="prose prose-primary max-w-none text-primary/90">
            <h2 className="font-serif text-2xl font-bold text-primary">
              Andre måder at udforske shelters på
            </h2>
            <p>
              Hvis du hellere vil gå via mere præcise landingssider, kan du også bruge{" "}
              <Link href="/by" className="text-accent hover:underline">
                byoversigten
              </Link>{" "}
              eller{" "}
              <Link href="/omraade" className="text-accent hover:underline">
                områdeoversigten
              </Link>
              . Region-siderne er især gode, når du vil have det brede overblik og derefter zoome
              ind på kommuner og byer.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
