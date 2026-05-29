import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShelterListSchema } from "@/components/seo/ShelterListSchema";
import { QuickAnswer } from "@/components/seo/QuickAnswer";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { faqToJsonLd, type FaqItem } from "@/lib/faq";
import { buildQuickAnswer } from "@/lib/quick-answer";
import { slugifySegment } from "@/lib/slug";
import { isStructuredBookable } from "@shared/lib/shelter-detail";
import type { Shelter } from "@/types/shelter";

function shelterHref(region: string | null, kommune: string | null, slug: string): string {
  const r = (region || "").trim();
  if (!r || r === "Danmark") return `/shelter/${slug}`;
  return `/danmark/${slugifySegment(r)}/${kommune ? slugifySegment(kommune) : "ukendt-kommune"}/${slug}`;
}

interface KommuneRow {
  kommune: string;
  count: number;
}

interface CrossFilterRegionPageProps {
  filterKey: string;
  filterLabel: string;
  filterLabelLong: string;
  regionName: string;
  preposition: string;
  parentFilterHref: string;
  shelters: Shelter[];
  kommuneBreakdown: KommuneRow[];
  faqItems: FaqItem[];
  otherRegions: { name: string; href: string }[];
  otherFilters: { label: string; href: string }[];
  relatedLinks: { label: string; href: string }[];
}

export function CrossFilterRegionPage({
  filterLabel,
  filterLabelLong,
  regionName,
  preposition,
  parentFilterHref,
  shelters,
  kommuneBreakdown,
  faqItems,
  otherRegions,
  otherFilters,
  relatedLinks,
}: CrossFilterRegionPageProps) {
  const inRegion = `${preposition} ${regionName}`;
  const regionSlug = slugifySegment(regionName);
  const topShelters = shelters.slice(0, 5);
  const placeCounts = new Map<string, number>();
  for (const shelter of shelters) {
    const place = shelter.place?.trim();
    if (!place) continue;
    placeCounts.set(place, (placeCounts.get(place) ?? 0) + 1);
  }
  const topPlaces = [...placeCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "da");
    })
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, slug: slugifySegment(name) }));
  const avgRating = (() => {
    const rated = shelters.filter((s) => s.google_rating != null);
    if (rated.length === 0) return null;
    const avg = rated.reduce((sum, s) => sum + (s.google_rating ?? 0), 0) / rated.length;
    return Math.round(avg * 10) / 10;
  })();

  const facetNoun = filterLabel === "booking" ? "bookbare shelters" : `shelters med ${filterLabel}`;
  const capPrep = `${preposition.charAt(0).toUpperCase()}${preposition.slice(1)}`;
  // Facet-region-sider har altid >= MIN_SHELTERS (3+), så ental-bøjning
  // trigger aldrig — facetNoun (flertal) kan trygt bruges til begge.
  const quickAnswer = buildQuickAnswer(
    `${capPrep} ${regionName}`,
    {
      count: shelters.length,
      // "kan bookes" er redundant på selve booking-facetten.
      ...(filterLabel !== "booking"
        ? { bookable: shelters.filter((s) => isStructuredBookable(s)).length }
        : {}),
    },
    facetNoun,
    facetNoun
  );

  return (
    <>
      <BreadcrumbSchema items={[
        { label: "Hjem", href: "/" },
        { label: filterLabelLong, href: parentFilterHref },
        { label: regionName },
      ]} />
      <ShelterListSchema
        name={`${filterLabelLong} ${inRegion}`}
        shelters={shelters}
        hrefFn={(s) => {
          const shelter = shelters.find((x) => x.id === s.id);
          return shelterHref(shelter?.region ?? null, shelter?.kommune ?? null, s.slug);
        }}
      />
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-primary/70 py-2">
            <Link href="/" className="py-1 -my-1 hover:text-accent transition-colors">Hjem</Link>
            <ChevronRight size={14} className="text-primary/50 shrink-0" />
            <Link href={parentFilterHref} className="py-1 -my-1 hover:text-accent transition-colors">{filterLabelLong}</Link>
            <ChevronRight size={14} className="text-primary/50" />
            <span className="text-primary font-medium">{regionName}</span>
          </nav>

          <header className="mb-8">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-primary mb-2">
              {filterLabelLong} {inRegion}
            </h1>
            <p className="text-primary/80 text-lg">
              {shelters.length} {filterLabel === "booking" ? "bookbare shelters" : `shelters med ${filterLabel}`} {inRegion}.
              {avgRating && ` Gennemsnitlig bedømmelse: ${avgRating} ud af 5.`}
            </p>
          </header>

          <QuickAnswer
            url={`https://shelterdk.dk${parentFilterHref}/${regionSlug}`}
            heading={`Hurtigt svar om ${facetNoun} ${inRegion}`}
            answer={quickAnswer}
            questionHint={`Siden besvarer spørgsmål som “${facetNoun} ${inRegion}” og “hvor mange ${facetNoun} findes der ${inRegion}”.`}
          />

          {kommuneBreakdown.length > 0 && (
            <section className="mb-8">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">Fordelt på kommuner</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-primary/10">
                      <th className="py-2 pr-4 text-sm font-semibold text-primary/70">Kommune</th>
                      <th className="py-2 text-sm font-semibold text-primary/70 text-right">Antal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kommuneBreakdown.map((row) => (
                      <tr key={row.kommune} className="border-b border-primary/5">
                        <td className="py-2 pr-4 text-sm text-primary">
                          <Link
                            href={`/danmark/${regionSlug}/${slugifySegment(row.kommune)}`}
                            className="hover:text-accent transition-colors"
                          >
                            {row.kommune}
                          </Link>
                        </td>
                        <td className="py-2 text-sm text-primary font-medium text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {topPlaces.length > 0 && (
            <section className="mb-8">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">
                Populære byer {inRegion}
              </h2>
              <div className="flex flex-wrap gap-2">
                {topPlaces.map((place) => (
                  <Link
                    key={place.slug}
                    href={`/by/${place.slug}`}
                    className="rounded-full border border-primary/10 bg-white px-4 py-2 text-sm font-medium text-primary hover:border-accent/30 hover:text-accent transition-colors"
                  >
                    Shelter {place.name}
                    <span className="ml-2 text-primary/40">{place.count}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {topShelters.length > 0 && (
            <section className="mb-8">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">
                Top {topShelters.length} {filterLabelLong.toLowerCase()} {inRegion}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topShelters.map((s) => (
                  <ShelterCard key={s.id} shelter={s} href={shelterHref(s.region ?? null, s.kommune ?? null, s.slug)} />
                ))}
              </div>
            </section>
          )}

          {shelters.length > 0 && (
            <section className="mb-12 -mx-4 sm:-mx-6 lg:-mx-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(380px,45%)] gap-0 min-h-[50vh]">
                <div className="overflow-y-auto lg:max-h-[calc(100vh-12rem)] lg:pr-4 order-2 lg:order-1 px-4 sm:px-6 lg:px-8">
                  <p className="text-primary/70 text-sm mb-4 sticky top-0 bg-background/95 py-2 z-10">
                    {shelters.length} shelters · scroll for flere
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                    {shelters.map((s) => (
                      <ShelterCard key={s.id} shelter={s} href={shelterHref(s.region ?? null, s.kommune ?? null, s.slug)} />
                    ))}
                  </div>
                </div>
                <div className="lg:sticky lg:top-24 lg:self-start rounded-xl overflow-hidden border border-primary/10 bg-primary/5 min-h-[280px] h-[40vh] lg:h-[calc(100vh-8rem)] lg:max-h-[720px] order-1 lg:order-2 mb-6 lg:mb-0 mx-4 sm:mx-6 lg:mx-0">
                  <ShelterMap shelters={shelters} className="w-full h-full" />
                </div>
              </div>
            </section>
          )}

          <section className="mt-12 pt-8 border-t border-primary/10">
            <h2 className="font-serif text-xl font-bold text-primary mb-6">Ofte stillede spørgsmål</h2>
            <dl className="space-y-6">
              {faqItems.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-primary mb-1">{item.question}</dt>
                  <dd className="text-primary/80 leading-relaxed">{item.answer}</dd>
                </div>
              ))}
            </dl>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqToJsonLd(faqItems)) }} />
          </section>

          <section className="mt-8 space-y-4">
            {otherRegions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary/70 mb-2">Se også {filterLabelLong.toLowerCase()} i andre regioner:</h3>
                <div className="flex flex-wrap gap-2">
                  {otherRegions.map((r) => (
                    <Link key={r.href} href={r.href} className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20">{r.name}</Link>
                  ))}
                </div>
              </div>
            )}
            {otherFilters.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary/70 mb-2">Andre faciliteter {inRegion}:</h3>
                <div className="flex flex-wrap gap-2">
                  {otherFilters.map((f) => (
                    <Link key={f.href} href={f.href} className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20">{f.label}</Link>
                  ))}
                </div>
              </div>
            )}
            {relatedLinks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-primary/70 mb-2">Læs mere:</h3>
                <div className="flex flex-wrap gap-2">
                  {relatedLinks.map((l) => (
                    <Link key={l.href} href={l.href} className="text-xs bg-accent/10 text-accent font-medium px-3 py-1 rounded-full hover:bg-accent/20">{l.label}</Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
