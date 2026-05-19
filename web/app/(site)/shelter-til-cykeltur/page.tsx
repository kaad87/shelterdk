import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { ChevronRight, Bike, MapPin, Ruler } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import type { CuratedRouteIndex } from "@/types/curated-route";

export const revalidate = 86400;

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Kan man cykle til shelters i Danmark?",
    answer:
      "Ja, mange shelters ligger langs etablerede vandre- og cykelruter. Især Fyn og øerne har et tæt netværk af shelters der er ideelle for cykelture, men også Hærvejen i Jylland og Camønoen på Sjælland passerer adskillige shelters.",
  },
  {
    question: "Hvilke ruter er bedst til cykeltur med shelter?",
    answer:
      "Øhavsstien på Fyn, Faaborg-Ringe Stien, Hærvejen i Jylland og Camønoen på Møn er alle populære ruter med gode sheltermuligheder. De fleste ruter har shelters med jævne mellemrum.",
  },
  {
    question: "Skal man booke shelter på cykelruter?",
    answer:
      "De fleste shelters langs cykelruter er gratis og fungerer efter først-til-mølle-princippet. I højsæsonen (juni-august) kan det dog være klogt at have en alternativ plan, da populære pladser hurtigt bliver optaget.",
  },
  {
    question: "Kan man parkere sin cykel ved shelters?",
    answer:
      "De fleste shelters har plads til at stille cykler, men der er sjældent dedikerede cykelstativer. Medbring gerne en cykellås og stil cyklen tæt på shelteren.",
  },
  {
    question: "Hvor langt er der typisk mellem shelters på cykelruter?",
    answer:
      "Det varierer meget fra rute til rute. På populære ruter som Hærvejen kan der være shelters hver 10-20 km, mens der på mere afsides ruter kan være længere mellem overnatningsmulighederne. Brug vores ruteplanner for at se afstande.",
  },
];

const PAGE_TITLE = "Shelter til cykeltur – find shelters langs cykelruter | ShelterDK";
const PAGE_OG_IMAGE =
  "https://images.unsplash.com/photo-1517949908118-721c4a2f3d80?w=1200&q=80&auto=format&fit=crop";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description:
    "Find shelters langs cykelruter i Danmark. Se ruter med overnatning, afstande og shelters til cykelture i Jylland, på Fyn og Sjælland.",
  alternates: { canonical: "https://shelterdk.dk/shelter-til-cykeltur" },
  openGraph: {
    title: PAGE_TITLE,
    description: "Shelters langs cykelruter i Danmark – planlæg din cykeltur med overnatning.",
    url: "/shelter-til-cykeltur",
    images: [{ url: PAGE_OG_IMAGE, width: 1200, height: 630, alt: "Shelter til cykeltur i Danmark" }],
  },
};

function loadRouteIndex(): CuratedRouteIndex[] {
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

export default function ShelterTilCykelturPage() {
  const allRoutes = loadRouteIndex();

  const topRoutes = [...allRoutes]
    .sort((a, b) => b.shelter_count - a.shelter_count)
    .slice(0, 12);

  const routesByRegion: Record<string, CuratedRouteIndex[]> = {};
  for (const r of allRoutes) {
    if (!routesByRegion[r.region]) routesByRegion[r.region] = [];
    routesByRegion[r.region].push(r);
  }
  for (const routes of Object.values(routesByRegion)) {
    routes.sort((a, b) => b.shelter_count - a.shelter_count);
  }

  const totalShelters = allRoutes.reduce((s, r) => s + r.shelter_count, 0);

  return (
    <>
      <BreadcrumbSchema
        items={[
          { label: "Hjem", href: "/" },
          { label: "Shelter til cykeltur" },
        ]}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <span className="text-primary font-medium">Shelter til cykeltur</span>
          </nav>

          <header className="mb-10">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-3">
              Shelter til cykeltur i Danmark
            </h1>
            <p className="text-primary/80 text-lg leading-relaxed">
              Danmark er perfekt til cykelture med overnatning i shelters. Med {allRoutes.length} vandre-
              og cykelruter og over {totalShelters} shelters langs ruterne kan du planlægge
              flerdages cykeloplevelser i naturen.
            </p>
          </header>

          {/* Key stats */}
          <section className="mb-10 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{allRoutes.length}</p>
              <p className="text-xs text-primary/60 mt-1">Ruter</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{totalShelters}</p>
              <p className="text-xs text-primary/60 mt-1">Shelters langs ruter</p>
            </div>
            <div className="rounded-xl border border-primary/10 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-accent">{Object.keys(routesByRegion).length}</p>
              <p className="text-xs text-primary/60 mt-1">Regioner</p>
            </div>
          </section>

          {/* Top routes */}
          <section className="mb-10">
            <h2 className="font-serif text-xl font-bold text-primary mb-4">
              Populære ruter med flest shelters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {topRoutes.map((r) => (
                <Link
                  key={r.slug}
                  href={`/ruteplanner/${r.slug}`}
                  className="flex items-center gap-3 rounded-xl border border-primary/10 bg-white px-4 py-3 hover:border-accent/30 hover:shadow-sm transition-all"
                >
                  <Bike size={20} className="text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">{r.name}</p>
                    <p className="text-xs text-primary/50">
                      {r.length_km} km · {r.shelter_count} shelters · {r.region}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-primary/30 shrink-0" />
                </Link>
              ))}
            </div>
          </section>

          {/* Routes by region */}
          {Object.entries(routesByRegion).map(([region, routes]) => (
            <section key={region} className="mb-10">
              <h2 className="font-serif text-xl font-bold text-primary mb-4">
                Cykelruter i {region}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {routes.slice(0, 6).map((r) => (
                  <Link
                    key={r.slug}
                    href={`/ruteplanner/${r.slug}`}
                    className="flex items-center justify-between rounded-xl border border-primary/10 bg-white px-4 py-3 hover:border-accent/30 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{r.name}</p>
                      <div className="flex items-center gap-2 text-xs text-primary/50 mt-0.5">
                        <span className="flex items-center gap-1"><Ruler size={12} />{r.length_km} km</span>
                        <span className="flex items-center gap-1"><MapPin size={12} />{r.shelter_count} shelters</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-primary/30 shrink-0" />
                  </Link>
                ))}
              </div>
              {routes.length > 6 && (
                <Link href="/ruteplanner" className="text-sm text-accent hover:underline mt-3 inline-block">
                  Se alle {routes.length} ruter i {region} →
                </Link>
              )}
            </section>
          ))}

          {/* Prose */}
          <section className="prose prose-primary max-w-none text-primary/90 space-y-6">
            <h2 className="font-serif text-xl font-bold text-primary">
              Planlæg din cykeltur med shelter
            </h2>
            <p>
              En cykeltur med overnatning i shelter er en fantastisk måde at opleve dansk natur.
              Du behøver ikke bære tungt campingudstyr – shelteren giver tag over hovedet, og
              mange pladser har bålplads, vand og toilet. Brug vores{" "}
              <Link href="/ruteplanner" className="text-accent hover:underline">ruteplanner</Link>{" "}
              til at finde den rette rute og se hvilke shelters der ligger langs vejen.
            </p>

            <h2 className="font-serif text-xl font-bold text-primary">
              Gode områder til cykeltur
            </h2>
            <p>
              <Link href="/danmark/fyn" className="text-accent hover:underline">Fyn</Link> er
              cykelturistens paradis med flade veje, korte afstande og mange shelters. Øhavsstien
              forbinder øerne i Det Fynske Øhav med færger og cykelvenlige stier.{" "}
              <Link href="/danmark/jylland" className="text-accent hover:underline">Jylland</Link>{" "}
              byder på Hærvejen – Danmarks ældste færdselsåre – med 98 shelters langs ruten.{" "}
              <Link href="/danmark/sjaelland" className="text-accent hover:underline">Sjælland</Link>{" "}
              har Camønoen og Pilgrimsruten med shelters tæt på offentlig transport.
            </p>

            <p>
              Se også:{" "}
              <Link href="/shelter-naer-vand" className="text-accent hover:underline">shelter nær vand</Link>
              {" · "}
              <Link href="/shelter-til-familier" className="text-accent hover:underline">shelter til familier</Link>
              {" · "}
              <Link href="/handicapvenlige-shelters" className="text-accent hover:underline">handicapvenlige shelters</Link>
              {" · "}
              <Link href="/shelter-med-baalplads" className="text-accent hover:underline">shelter med bålplads</Link>
              {" · "}
              <Link href="/shelter-med-vand" className="text-accent hover:underline">shelter med vand</Link>
              {" · "}
              <Link href="/shelter-med-toilet" className="text-accent hover:underline">shelter med toilet</Link>
              {" · "}
              <Link href="/shelter-booking" className="text-accent hover:underline">book shelter</Link>
              {" · "}
              <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">pakkeliste til sheltertur</Link>
              {" · "}
              <Link href="/fakta/shelters-i-danmark" className="text-accent hover:underline">fakta om shelters</Link>.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">
              Ofte stillede spørgsmål om sheltertur på cykel
            </h2>
            <dl className="space-y-6">
              {FAQ_ITEMS.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(FAQ_ITEMS)) }}
            />
          </section>
        </div>
      </div>
    </>
  );
}
