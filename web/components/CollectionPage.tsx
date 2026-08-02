import Link from "next/link";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { BreadcrumbSchema } from "@/components/seo/BreadcrumbSchema";
import { ShelterListSchema } from "@/components/seo/ShelterListSchema";
import { QuickAnswer } from "@/components/seo/QuickAnswer";
import { ShelterCard } from "@/components/ShelterCard";
import { ShelterMap } from "@/components/ShelterMap";
import { AdInFeed } from "@/components/AdInFeed";
import { showInFeedAdAt } from "@/lib/adsense";
import { toMapShelters } from "@/lib/map-shelter";
import { buildQuickAnswer } from "@/lib/quick-answer";
import { faqToJsonLd } from "@/lib/faq";
import { getWater } from "@/lib/shelter-detail";
import { isStructuredBookable } from "@shared/lib/shelter-detail";
import { slugifySegment } from "@/lib/slug";
import { canonicalRegionSlug } from "@/lib/cross-page-config";
import type { CollectionConfig } from "@/lib/collection-pages";
import type { Shelter } from "@/types/shelter";

const NO_KOMMUNE_SLUG = "ukendt-kommune";

/**
 * Antal kort der vises. Alle pladser tælles med i overskrift, kort og
 * regionsfordeling, men at rendere dem alle gav en 2,8 MB side på /teltplads
 * (273 pladser) — uspiselig på mobil, hvor størstedelen af trafikken er, og
 * direkte skadeligt for de Core Web Vitals siden skal rangere på.
 */
const MAX_CARDS = 60;

/** Shelter-DETALJER bor på den lange region-slug — ikke den kanoniske hub-slug. */
function shelterHref(shelter: Shelter): string {
  const region = (shelter.region ?? "").trim();
  if (!region || region === "Danmark") return `/shelter/${shelter.slug}`;
  const m = shelter.kommune ? slugifySegment(shelter.kommune) : NO_KOMMUNE_SLUG;
  return `/danmark/${slugifySegment(region)}/${m}/${shelter.slug}`;
}

/**
 * Delt layout for tema-samlesider. Siderne skal kunne rangere på egen hånd, så
 * de har rigtigt indhold — intro, opsummering, FAQ og interne links — og ikke
 * bare en liste med kort.
 */
export function CollectionPage({
  config,
  shelters,
}: {
  config: CollectionConfig;
  shelters: Shelter[];
}) {
  const count = shelters.length;
  const bookable = shelters.filter((s) => isStructuredBookable(s)).length;
  const withWater = shelters.filter((s) => getWater(s) === true).length;
  const quickAnswer = buildQuickAnswer(config.h1, {
    count,
    bookable,
    water: withWater,
  });

  // Regionsfordeling giver både et faktuelt afsnit og interne links videre.
  const byRegion = new Map<string, number>();
  for (const s of shelters) {
    const r = (s.region ?? "").trim();
    if (r && r !== "Danmark") byRegion.set(r, (byRegion.get(r) ?? 0) + 1);
  }
  const regions = [...byRegion.entries()].sort((a, b) => b[1] - a[1]);
  const visible = shelters.slice(0, MAX_CARDS);

  const faqJsonLd = JSON.stringify(
    faqToJsonLd(config.faq.map((f) => ({ question: f.question, answer: f.answer })))
  );

  return (
    <>
      <BreadcrumbSchema
        items={[{ label: "Hjem", href: "/" }, { label: config.h1 }]}
      />
      {count > 0 && (
        <ShelterListSchema
          name={config.h1}
          shelters={shelters}
          hrefFn={(s) => {
            const full = shelters.find((x) => x.id === s.id);
            return full ? shelterHref(full) : `/shelter/${s.slug}`;
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLd }}
      />

      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <nav className="mb-6 text-sm text-primary/70" aria-label="Brødkrummesti">
            <ol className="flex flex-wrap items-center gap-2 list-none m-0 p-0">
              <li>
                <Link href="/" className="hover:text-accent transition-colors">
                  Forside
                </Link>
              </li>
              <li aria-hidden className="text-primary/50">/</li>
              <li className="text-primary font-medium">{config.h1}</li>
            </ol>
          </nav>

          <header className="mb-8">
            <h1 className="font-serif text-3xl lg:text-4xl font-bold text-primary mb-4">
              {config.h1}
            </h1>
            <p className="text-primary/90 text-base lg:text-lg leading-relaxed max-w-3xl">
              {config.intro(count)}
            </p>
          </header>

          <QuickAnswer
            url={`https://shelterdk.dk/${config.slug}`}
            heading={`Hurtigt svar om ${config.h1.toLowerCase()}`}
            answer={quickAnswer}
          />

          {regions.length > 0 && (
            <section className="mb-10 rounded-xl border border-primary/10 bg-primary/[0.03] p-5">
              <h2 className="font-serif text-lg font-bold text-primary mb-3">
                Fordelt på landsdele
              </h2>
              <div className="flex flex-wrap gap-2">
                {regions.map(([region, n]) => (
                  <Link
                    key={region}
                    href={`/danmark/${canonicalRegionSlug(region)}`}
                    className="rounded-full border border-primary/10 bg-white px-4 py-2 text-sm font-medium text-primary transition-colors hover:border-accent/30 hover:text-accent"
                  >
                    {region}
                    <span className="ml-2 text-primary/40">{n}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {count > 0 && (
            <section className="mb-10">
              <div className="mb-4 h-[280px] overflow-hidden rounded-xl border border-primary/10 bg-primary/5 sm:h-[360px]">
                <ShelterMap shelters={toMapShelters(shelters)} className="h-full w-full" />
              </div>
            </section>
          )}

          <section className="mb-12">
            <h2 className="font-serif text-2xl font-bold text-primary mb-5">
              {visible.length < count
                ? `De ${visible.length} bedst bedømte af ${count} pladser`
                : `Alle ${count} pladser`}
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((shelter, i) => (
                <Fragment key={shelter.id}>
                  {showInFeedAdAt(i, visible.length) && <AdInFeed />}
                  <ShelterCard shelter={shelter} href={shelterHref(shelter)} />
                </Fragment>
              ))}
            </div>
            {visible.length < count && (
              <p className="mt-6 text-sm text-primary/70">
                Viser {visible.length} af {count} pladser.{" "}
                <Link href="/soeg" className="text-accent hover:underline">
                  Søg blandt alle shelters
                </Link>{" "}
                for at filtrere på område og faciliteter.
              </p>
            )}
          </section>

          <section className="mb-10">
            <h2 className="font-serif text-2xl font-bold text-primary mb-5">
              Ofte stillede spørgsmål
            </h2>
            <div className="space-y-4">
              {config.faq.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-xl border border-primary/10 bg-white p-5"
                >
                  <summary className="cursor-pointer list-none font-semibold text-primary marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {item.question}
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-accent transition-transform group-open:rotate-90"
                        aria-hidden
                      />
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-primary/80">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>

          {config.related && config.related.length > 0 && (
            <section className="mb-10">
              <h2 className="font-serif text-2xl font-bold text-primary mb-5">
                Se også
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {config.related.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="group rounded-xl border border-primary/10 bg-white p-4 transition-colors hover:border-accent/30"
                  >
                    <span className="block font-medium text-primary group-hover:text-accent transition-colors">
                      {r.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-primary/55">{r.note}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-primary/10 bg-primary/[0.03] p-5">
            <h2 className="font-serif text-lg font-bold text-primary mb-3">
              Nyttige ressourcer
            </h2>
            <ul className="space-y-2 text-sm text-primary/80">
              <li>
                <Link href="/guides/regler-for-shelter-og-teltning-i-danmark" className="text-accent hover:underline">
                  Regler for shelter og teltning
                </Link>{" "}
                – hvad må man hvor
              </li>
              <li>
                <Link href="/guides/pakkeliste-til-sheltertur" className="text-accent hover:underline">
                  Pakkeliste til sheltertur
                </Link>{" "}
                – alt du skal medbringe
              </li>
              <li>
                <Link href="/shelter-booking" className="text-accent hover:underline">
                  Shelters der kan bookes
                </Link>{" "}
                – sikr dig plads i højsæsonen
              </li>
              <li>
                <Link href="/soeg" className="text-accent hover:underline">
                  Søg blandt alle shelters
                </Link>{" "}
                – filtrér på faciliteter og område
              </li>
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
