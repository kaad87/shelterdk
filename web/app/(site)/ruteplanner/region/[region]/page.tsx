import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import type { CuratedRouteIndex } from "@/types/curated-route";
import { slugifySegment } from "@/lib/slug";

export const revalidate = 86400;
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ region: string }>;
}

function loadIndex(): CuratedRouteIndex[] {
  try {
    const filePath = path.join(process.cwd(), "public/data/curated-routes-index.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

export function generateStaticParams() {
  const regions = [...new Set(loadIndex().map((route) => route.region))];
  return regions.map((region) => ({ region: slugifySegment(region) }));
}

function findRegionName(regionSlug: string): string | null {
  const regions = [...new Set(loadIndex().map((route) => route.region))];
  return regions.find((region) => slugifySegment(region) === regionSlug) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { region: regionSlug } = await params;
  const regionName = findRegionName(regionSlug);
  if (!regionName) return { title: { absolute: "Region ikke fundet" } };

  const routes = loadIndex().filter((route) => route.region === regionName);
  const title = `Vandreruter med shelters i ${regionName} | ShelterDK`;
  const description = `Udforsk ${routes.length} vandreruter med shelters i ${regionName}. Se længde, shelterantal og gå videre til den rigtige rute.`;
  const canonical = `/ruteplanner/region/${regionSlug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonical}` },
    openGraph: { title, description, url: canonical },
  };
}

export default async function RouteRegionPage({ params }: PageProps) {
  const { region: regionSlug } = await params;
  const regionName = findRegionName(regionSlug);
  if (!regionName) notFound();

  const routes = loadIndex()
    .filter((route) => route.region === regionName)
    .sort((a, b) => b.shelter_count - a.shelter_count || b.length_km - a.length_km);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Vandreruter", href: "/ruteplanner" },
          { label: regionName },
        ]}
      />
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <nav className="mb-8 text-sm text-primary/70" aria-label="Brødkrummesti">
            <ol className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
              <li><Link href="/" className="hover:text-accent transition-colors">Forside</Link></li>
              <li aria-hidden className="text-primary/50">/</li>
              <li><Link href="/ruteplanner" className="hover:text-accent transition-colors">Vandreruter</Link></li>
              <li aria-hidden className="text-primary/50">/</li>
              <li className="text-primary font-medium">{regionName}</li>
            </ol>
          </nav>

          <header className="mb-10 max-w-3xl">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-primary mb-4">
              Vandreruter med shelters i {regionName}
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Her finder du alle ruteplanner-sider for {regionName}, sorteret efter antal shelters
              og længde. Brug siden som regional hub, hvis du vil finde den rette rute til din næste tur.
            </p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routes.map((route) => (
              <Link
                key={route.slug}
                href={`/ruteplanner/${route.slug}`}
                className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm hover:border-accent/30 hover:shadow-md transition-all"
              >
                <h2 className="font-serif text-xl font-bold text-primary">{route.name}</h2>
                <p className="mt-2 text-sm text-primary/70">
                  {route.length_km} km · {route.shelter_count} shelters
                </p>
              </Link>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
