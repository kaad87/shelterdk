import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { ChevronRight, MapPin, Ruler, Mountain } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { formatDistance } from "@/lib/haversine";
import type { CuratedRouteIndex, CuratedRouteDataMap, RouteShelter } from "@/types/curated-route";

export const revalidate = 86400;
export const dynamicParams = false;

function loadIndex(): CuratedRouteIndex[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "public/data/curated-routes-index.json"),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function loadRouteData(slug: string): { shelters: RouteShelter[] } | null {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "public/data/curated-routes.json"),
      "utf-8"
    );
    const map: CuratedRouteDataMap = JSON.parse(raw);
    return map[slug] ?? null;
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return loadIndex().map((r) => ({ slug: r.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const index = loadIndex();
  const route = index.find((r) => r.slug === slug);
  if (!route) return { title: { absolute: "Rute ikke fundet" } };

  const title = `${route.name} – ${route.length_km} km vandrerute med ${route.shelter_count} shelters | ShelterDK`;
  const description = route.description
    ? route.description.slice(0, 160)
    : `${route.name} er en ${route.length_km} km vandrerute i ${route.region} med ${route.shelter_count} shelters langs ruten.`;
  const canonical = `/ruteplanner/${slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `https://shelterdk.dk${canonical}` },
    openGraph: { title, description, url: canonical },
    robots: { index: true, follow: true },
  };
}

export default async function RouteDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const index = loadIndex();
  const route = index.find((r) => r.slug === slug);
  if (!route) notFound();

  const data = loadRouteData(slug);
  const shelters = data?.shelters ?? [];

  const relatedRoutes = index
    .filter((r) => r.region === route.region && r.slug !== slug)
    .sort((a, b) => b.shelter_count - a.shelter_count)
    .slice(0, 6);

  const sheltersWithWater = shelters.filter((s) => s.water);
  const sheltersWithToilet = shelters.filter(
    (s) => s.toilet && s.toilet !== "none" && s.toilet !== "unknown"
  );
  const totalCapacity = shelters.reduce((sum, s) => sum + (s.capacity ?? 0), 0);

  const faqItems: FaqItem[] = [
    {
      question: `Hvor lang er ${route.name}?`,
      answer: `${route.name} er ${route.length_km} km lang og ligger i ${route.region}.`,
    },
    {
      question: `Hvor mange shelters er der langs ${route.name}?`,
      answer: `Der er ${shelters.length} shelters langs eller nær ${route.name}.${sheltersWithWater.length > 0 ? ` ${sheltersWithWater.length} har vand.` : ""}${sheltersWithToilet.length > 0 ? ` ${sheltersWithToilet.length} har toilet.` : ""}`,
    },
    {
      question: `Er ${route.name} gratis at vandre?`,
      answer: `Ja, selve ruten er gratis at benytte. Mange af shelterne langs ruten er også gratis (først-til-mølle). Nogle shelters kan kræve booking.`,
    },
    {
      question: `Kan man overnatte langs ${route.name}?`,
      answer: `Ja, der er ${shelters.length} shelters langs ruten med en samlet kapacitet på ca. ${totalCapacity} pladser. Se listen nedenfor for detaljer om faciliteter.`,
    },
  ];

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Vandreruter", href: "/ruteplanner" },
          { label: route.name },
        ]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">
              Hjem
            </Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href="/ruteplanner" className="py-1 -my-1 hover:text-accent transition-colors">
              Vandreruter
            </Link>
            <ChevronRight size={14} className="text-primary/50" />
            <span className="text-primary font-medium">{route.name}</span>
          </nav>

          <header className="mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              {route.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-primary/60">
              <span className="flex items-center gap-1.5">
                <Ruler size={16} className="text-accent" />
                {route.length_km} km
              </span>
              <span className="flex items-center gap-1.5">
                <Mountain size={16} className="text-accent" />
                {route.region}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={16} className="text-accent" />
                {shelters.length} shelters
              </span>
            </div>
          </header>

          {route.description && (
            <section className="mb-10">
              <p className="text-primary/80 text-lg leading-relaxed">{route.description}</p>
            </section>
          )}

          {/* Key stats */}
          <section className="mb-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{shelters.length}</p>
              <p className="text-xs text-primary/60 mt-1">Shelters</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{route.length_km}</p>
              <p className="text-xs text-primary/60 mt-1">Kilometer</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{sheltersWithWater.length}</p>
              <p className="text-xs text-primary/60 mt-1">Med vand</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{sheltersWithToilet.length}</p>
              <p className="text-xs text-primary/60 mt-1">Med toilet</p>
            </div>
          </section>

          {/* Shelter list */}
          {shelters.length > 0 && (
            <section className="mb-10">
              <h2 className="font-serif text-xl font-bold text-primary mb-4">
                Shelters langs {route.name}
              </h2>
              <div className="divide-y divide-primary/10 rounded-xl border border-primary/10 bg-white overflow-hidden">
                {shelters.map((shelter, i) => (
                  <div key={shelter.id} className="flex items-center justify-between px-4 py-3 hover:bg-primary/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/shelter/${shelter.slug}`}
                          className="text-sm font-medium text-primary hover:text-accent transition-colors truncate block"
                        >
                          {shelter.title}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-primary/40 mt-0.5">
                          {shelter.capacity && <span>{shelter.capacity} pl.</span>}
                          {shelter.water && <span>Vand</span>}
                          {shelter.toilet && shelter.toilet !== "none" && shelter.toilet !== "unknown" && (
                            <span>Toilet</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-primary/40 shrink-0 ml-2">
                      {formatDistance(shelter.distance_to_trail_km ?? 0)} fra ruten
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Interactive ruteplanner link */}
          <section className="mb-10 rounded-xl border border-accent/20 bg-accent/5 p-6 text-center">
            <p className="text-primary/80 mb-3">
              Udforsk alle vandreruter med shelters på kortet
            </p>
            <Link
              href="/ruteplanner"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors"
            >
              <MapPin size={16} />
              Se alle vandreruter
            </Link>
          </section>

          {/* FAQ */}
          <section className="mb-10 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål om {route.name}
            </h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }}
            />
          </section>

          {/* Related routes */}
          {relatedRoutes.length > 0 && (
            <section className="mb-10 pt-8 border-t border-primary/10">
              <h2 className="font-serif text-xl font-bold text-primary mb-4">
                Andre vandreruter i {route.region}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedRoutes.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/ruteplanner/${r.slug}`}
                    className="flex items-center justify-between rounded-xl border border-primary/10 bg-white px-4 py-3 hover:border-accent/30 hover:shadow-sm transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{r.name}</p>
                      <p className="text-xs text-primary/50">{r.length_km} km · {r.shelter_count} shelters</p>
                    </div>
                    <ChevronRight size={16} className="text-primary/30 shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Cross-links */}
          <section className="pt-8 border-t border-primary/10">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">Udforsk mere</h2>
            <div className="flex flex-wrap gap-2">
              <Link href="/ruteplanner" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Alle vandreruter</Link>
              <Link href="/shelter-til-cykeltur" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Shelter til cykeltur</Link>
              <Link href="/shelter-naer-vand" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Shelter nær vand</Link>
              <Link href="/shelter-til-familier" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Shelter til familier</Link>
              <Link href="/handicapvenlige-shelters" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Handicapvenlige shelters</Link>
              <Link href="/guides/pakkeliste-til-sheltertur" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Pakkeliste</Link>
              <Link href="/guides/shelter-for-begyndere-forste-tur" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Begynderguide</Link>
              <Link href="/fakta/shelters-i-danmark" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Fakta om shelters</Link>
              <Link href="/soeg" className="text-sm bg-accent/10 text-accent font-medium px-3 py-1.5 rounded-full hover:bg-accent/20 transition-colors">Søg shelters</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
