import type { Metadata } from "next";
import { Suspense } from "react";
import * as fs from "fs";
import * as path from "path";
import Link from "next/link";
import { CuratedRoutesClient } from "@/components/CuratedRoutesClient";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { slugifySegment } from "@/lib/slug";
import type { CuratedRouteIndex } from "@/types/curated-route";
import { DEFAULT_OG_IMAGE } from "@/lib/seo-meta";

export const metadata: Metadata = {
  title: "Vandreruter med shelters — Udforsk Danmarks bedste vandreruter",
  description:
    "Udforsk over 200 vandreruter fra Naturstyrelsen med shelters langs vejen. Filtrer efter region og længde, og download GPX til din næste vandretur.",
  alternates: { canonical: "https://shelterdk.dk/ruteplanner" },
  openGraph: {
    images: [DEFAULT_OG_IMAGE],
    title: "Vandreruter med shelters | ShelterDK",
    description:
      "Udforsk over 200 vandreruter fra Naturstyrelsen med shelters langs vejen. Filtrer efter region og længde, og download GPX til din næste vandretur.",
    url: "/ruteplanner",
  },
};

function loadIndex(): CuratedRouteIndex[] {
  try {
    const filePath = path.join(process.cwd(), "public/data/curated-routes-index.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function RutePlannerPage() {
  const index = loadIndex();
  const routeRegions = [...new Set(index.map((route) => route.region).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "da")
  );

  return (
    <>
    <BreadcrumbSchema items={[{ label: "Hjem", href: "/" }, { label: "Vandreruter" }]} />
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-4rem)] bg-background">
          <span className="text-primary/40 text-sm">Indlæser vandreruter...</span>
        </div>
      }
    >
      <CuratedRoutesClient initialIndex={index} />
    </Suspense>

    {/* Server-rendered route links for crawler discoverability */}
    {index.length > 0 && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-primary/10">
        {routeRegions.length > 0 && (
          <div className="mb-8">
            <h2 className="font-serif text-lg font-bold text-primary mb-4">
              Udforsk vandreruter efter region
            </h2>
            <div className="flex flex-wrap gap-2">
              {routeRegions.map((region) => (
                <Link
                  key={region}
                  href={`/ruteplanner/region/${slugifySegment(region)}`}
                  className="rounded-full border border-primary/10 bg-white px-4 py-2 text-sm font-medium text-primary hover:border-accent/30 hover:text-accent transition-colors"
                >
                  {region}
                </Link>
              ))}
            </div>
          </div>
        )}

        <h2 className="font-serif text-lg font-bold text-primary mb-4">
          Alle {index.length} vandreruter
        </h2>
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {index
            .sort((a, b) => b.shelter_count - a.shelter_count)
            .map((route) => (
            <Link
              key={route.slug}
              href={`/ruteplanner/${route.slug}`}
              className="block py-1.5 text-sm text-primary/70 hover:text-accent transition-colors truncate"
            >
              {route.name}
              <span className="text-primary/40 ml-1">
                · {route.length_km} km · {route.shelter_count} shelters
              </span>
            </Link>
          ))}
        </div>
      </section>
    )}
    </>
  );
}
